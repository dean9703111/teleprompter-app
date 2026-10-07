import { useCallback, useEffect, useRef, useState } from 'react';
import type { Token } from '../utils/pinyinMatcher';
import { createMotion, predictPosition, recordHeard, recordMatch, recordVoice, resetMotion } from '../utils/followMotion';
import { createVoiceDetector, getRms } from '../utils/voiceActivity';

type Matcher = typeof import('../utils/pinyinMatcher');

export type FollowStatus = 'idle' | 'starting' | 'listening';

interface UseSmartFollowOptions {
  enabled: boolean;
  text: string;
  resolveCursor: (tokens: Token[]) => number;
  // 畫面上看得到的 token 區間 [from, to)
  resolveVisible: (tokens: Token[]) => [number, number] | null;
  onError: (message: string) => void;
}

const SPOKEN_BUFFER_SIZE = 40;
const HEARD_LENGTH = 24;
const RELOCATE_INTERVAL = 700;
const RESTART_DELAY = 100;
// Chrome 辨識一直講不停頓時，大約 17 秒（80 字）後就不再回傳結果，但仍顯示在聆聽（實測）；
// 講話途中重開，新的一段約 6 秒後才有第一個結果（實測）。
// 所以：明明在講話（麥克風 VOICE_RECENT 內聽得到人聲）卻 STALL_TIMEOUT 沒有新文字，就立刻重開；
// 新的一段還沒出過結果時給它 NEW_SESSION_GRACE 慢慢接上，免得還沒恢復又被重開。
// 辨識不到的這段期間，由 followMotion 依語速繼續推進
const STALL_TIMEOUT = 2000;
const VOICE_RECENT = 1000;
const NEW_SESSION_GRACE = 10000;
// 沒有音量偵測（拿不到麥克風串流）時，只能在完全沒有新文字這麼久後重開
const FALLBACK_STALL_TIMEOUT = 5000;
const METER_INTERVAL = 50;
// network 錯誤常是暫時的，連續發生這麼多次（中間都沒有辨識結果）才放棄
const MAX_NETWORK_RETRIES = 3;

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': '麥克風權限被拒絕，請在網址列允許使用麥克風',
  'service-not-allowed': '瀏覽器不允許語音辨識（Safari 需在系統設定開啟「聽寫」）',
  'audio-capture': '找不到可用的麥克風',
  network: '語音辨識連線失敗（Chrome / Edge 的語音辨識需要網路）',
  'language-not-supported': '此瀏覽器不支援這個語言的語音辨識',
};

// pinyin-pro 字典不小，開啟跟讀時才載入
let matcherPromise: Promise<Matcher> | null = null;
const loadMatcher = () => {
  matcherPromise ??= import('../utils/pinyinMatcher').catch((error) => {
    matcherPromise = null;
    throw error;
  });
  return matcherPromise;
};

const getRecognitionConstructor = () => window.SpeechRecognition ?? window.webkitSpeechRecognition;

const getRecognitionLang = (text: string) => {
  if (!/\p{Script=Han}/u.test(text)) return 'en-US';
  return navigator.language.toLowerCase().startsWith('zh') ? navigator.language : 'zh-TW';
};

export const useSmartFollow = ({ enabled, text, resolveCursor, resolveVisible, onError }: UseSmartFollowOptions) => {
  const [status, setStatus] = useState<FollowStatus>('idle');
  const [heard, setHeard] = useState('');
  const [similarity, setSimilarity] = useState<number | null>(null);

  const callbacksRef = useRef({ resolveCursor, resolveVisible, onError });
  useEffect(() => {
    callbacksRef.current = { resolveCursor, resolveVisible, onError };
  });

  const tokensRef = useRef<Token[]>([]);
  const motionRef = useRef(createMotion());
  const spokenRef = useRef<Token[]>([]);
  const heardRef = useRef('');
  const readyRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastRelocateRef = useRef(0);

  const anchor = useCallback(() => {
    resetMotion(motionRef.current, callbacksRef.current.resolveCursor(tokensRef.current), performance.now());
    spokenRef.current = [];
    heardRef.current = '';
    setHeard('');
    setSimilarity(null);
  }, []);

  // 手動捲動後，以畫面上的位置為準重新定位；中斷辨識，避免還沒結束的那句把位置拉回去
  const reanchor = useCallback(() => {
    if (!readyRef.current) return;
    anchor();
    recognitionRef.current?.abort();
  }, [anchor]);

  // 每一幀呼叫：回傳目前推估念到的 token 位置（含小數），尚未就緒時回傳 null
  const predict = useCallback((now: number) => {
    if (!readyRef.current) return null;
    return predictPosition(motionRef.current, now, tokensRef.current.length - 1);
  }, []);

  const getTokens = useCallback(() => tokensRef.current, []);

  useEffect(() => {
    if (!enabled) return;

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      callbacksRef.current.onError('此瀏覽器不支援語音辨識，請改用 Chrome、Edge 或 Safari');
      return;
    }

    let active = true;
    let restartTimer: number | undefined;
    let meterTimer: number | undefined;
    let watchdogTimer: number | undefined;
    let audioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let lastActivity = performance.now();
    let sessionStart = performance.now();
    // 目前這一段是否已經回傳過結果
    let sessionHeard = false;
    let lastVoiceAt = 0;
    // 換段的時間點；新的一段回傳第一個結果後清掉
    let switchAt: number | null = null;
    let lastTranscript = '';
    let interim = '';
    let interimTokens: Token[] = [];
    let networkErrors = 0;
    // 目前這一段辨識；每段都用新的物件，舊的那段被換掉後送來的事件一律忽略
    let recognition: SpeechRecognition | null = null;
    let startSession = () => {};

    const fail = (message: string) => {
      active = false;
      callbacksRef.current.onError(message);
    };

    // 只保留一個待執行的重啟
    const scheduleStart = () => {
      window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(() => startSession(), RESTART_DELAY);
    };

    // 把還沒定案的內容當成定案，丟掉目前這段辨識，開新的一段
    const replaceSession = (reason: string) => {
      const old = recognition;
      if (!old) return;
      console.debug(`[smart-follow] ${reason}`);
      switchAt = performance.now();
      spokenRef.current = spokenRef.current.concat(interimTokens).slice(-SPOKEN_BUFFER_SIZE);
      heardRef.current = (heardRef.current + interim).slice(-HEARD_LENGTH);
      interim = '';
      interimTokens = [];
      lastActivity = performance.now();
      recognition = null;
      recognitionRef.current = null;
      old.abort();
      scheduleStart();
    };

    const handleResult = (matcher: Matcher, event: SpeechRecognitionEvent) => {
      const now = performance.now();
      networkErrors = 0;
      const motion = motionRef.current;
      recordHeard(motion, now);
      sessionHeard = true;
      if (switchAt !== null) {
        console.debug(`[smart-follow] 換段後第一個辨識結果：${Math.round(now - switchAt)} ms`);
        switchAt = null;
      }

      interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          spokenRef.current = spokenRef.current.concat(matcher.tokenize(transcript)).slice(-SPOKEN_BUFFER_SIZE);
          heardRef.current = (heardRef.current + transcript).slice(-HEARD_LENGTH);
        } else {
          interim += transcript;
        }
      }
      interimTokens = matcher.tokenize(interim);
      setHeard((heardRef.current + interim).slice(-HEARD_LENGTH));

      // 只有文字真的有變才算有在辨識，避免卡住時重複送出同樣的結果
      const transcript = heardRef.current + interim;
      if (transcript !== lastTranscript) {
        lastTranscript = transcript;
        lastActivity = now;
      }

      const tokens = tokensRef.current;
      const spoken = spokenRef.current.concat(interimTokens);
      const visible = callbacksRef.current.resolveVisible(tokens) ?? undefined;
      let match = matcher.locate(tokens, spoken, motion.index, visible);

      if (!match && now - lastRelocateRef.current > RELOCATE_INTERVAL) {
        lastRelocateRef.current = now;
        match = matcher.relocate(tokens, spoken, motion.index);
      }
      if (!match) return;

      setSimilarity(match.similarity);
      recordMatch(motion, match.index, now);
    };

    // 麥克風音量：判斷有沒有在講話；拿不到串流時退回只看辨識結果
    const startMeter = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return;
      }
      if (!active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const isVoice = createVoiceDetector();

      meterTimer = window.setInterval(() => {
        const now = performance.now();
        analyser.getFloatTimeDomainData(samples);
        if (isVoice(getRms(samples))) {
          lastVoiceAt = now;
          recordVoice(motionRef.current, now);
        }
      }, METER_INTERVAL);
    };

    setStatus('starting');
    loadMatcher().then(
      (matcher) => {
        if (!active) return;
        tokensRef.current = matcher.tokenize(text);
        readyRef.current = true;
        anchor();

        startSession = () => {
          if (!active || recognition) return;
          sessionStart = performance.now();
          sessionHeard = false;
          const current = new Recognition();
          const isCurrent = () => active && recognition === current;

          current.lang = getRecognitionLang(text);
          current.continuous = true;
          current.interimResults = true;
          current.maxAlternatives = 1;
          current.onstart = () => {
            if (!isCurrent()) return;
            lastActivity = sessionStart = performance.now();
            console.debug(
              switchAt === null ? '[smart-follow] 開始辨識' : `[smart-follow] 開始辨識（換段後 ${Math.round(sessionStart - switchAt)} ms）`,
            );
            setStatus('listening');
          };
          current.onresult = (event) => {
            if (isCurrent()) handleResult(matcher, event);
          };
          current.onerror = (event) => {
            if (!isCurrent()) return;
            console.debug('[smart-follow] 辨識錯誤', event.error);
            // 暫時性的 network 錯誤交給 onend 重啟
            if (event.error === 'network' && ++networkErrors < MAX_NETWORK_RETRIES) return;
            const message = ERROR_MESSAGES[event.error];
            if (message) fail(message);
          };
          // Chrome 靜音一陣子或約一分鐘就會結束，接續開新的一段（短暫重開不切換狀態，避免閃爍）
          current.onend = () => {
            if (!isCurrent()) return;
            console.debug('[smart-follow] 辨識結束');
            switchAt = performance.now();
            recognition = null;
            recognitionRef.current = null;
            scheduleStart();
          };

          recognition = current;
          recognitionRef.current = current;
          try {
            current.start();
          } catch {
            recognition = null;
            recognitionRef.current = null;
            scheduleStart();
          }
        };

        startSession();
        startMeter();

        watchdogTimer = window.setInterval(() => {
          if (!recognition) return;
          const now = performance.now();
          if (!sessionHeard) {
            if (now - sessionStart > NEW_SESSION_GRACE) replaceSession('新的一段一直沒有辨識結果，重新啟動');
            return;
          }
          const speaking = audioContext ? now - lastVoiceAt < VOICE_RECENT : true;
          const timeout = audioContext ? STALL_TIMEOUT : FALLBACK_STALL_TIMEOUT;
          if (speaking && now - lastActivity > timeout) replaceSession('沒有新的辨識文字，重新啟動');
        }, 250);
      },
      () => fail('拼音模組載入失敗，請重新整理頁面'),
    );

    return () => {
      active = false;
      readyRef.current = false;
      window.clearTimeout(restartTimer);
      window.clearInterval(meterTimer);
      window.clearInterval(watchdogTimer);
      stream?.getTracks().forEach((track) => track.stop());
      audioContext?.close();
      recognitionRef.current = null;
      recognition?.abort();
      setStatus('idle');
    };
  }, [enabled, text, anchor]);

  return { status, heard, similarity, reanchor, predict, getTokens };
};
