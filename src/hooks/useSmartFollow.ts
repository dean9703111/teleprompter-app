import { useCallback, useEffect, useRef, useState } from 'react';
import type { Token } from '../utils/pinyinMatcher';
import { createMotion, predictPosition, recordHeard, recordMatch, resetMotion } from '../utils/followMotion';

type Matcher = typeof import('../utils/pinyinMatcher');

export type FollowStatus = 'idle' | 'starting' | 'listening';

interface UseSmartFollowOptions {
  enabled: boolean;
  text: string;
  resolveCursor: (tokens: Token[]) => number;
  onError: (message: string) => void;
}

const SPOKEN_BUFFER_SIZE = 40;
const HEARD_LENGTH = 24;
const RELOCATE_INTERVAL = 700;
const RESTART_DELAY = 300;

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

export const useSmartFollow = ({ enabled, text, resolveCursor, onError }: UseSmartFollowOptions) => {
  const [status, setStatus] = useState<FollowStatus>('idle');
  const [heard, setHeard] = useState('');
  const [similarity, setSimilarity] = useState<number | null>(null);

  const callbacksRef = useRef({ resolveCursor, onError });
  useEffect(() => {
    callbacksRef.current = { resolveCursor, onError };
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
    let recognition: SpeechRecognition | null = null;

    const fail = (message: string) => {
      active = false;
      callbacksRef.current.onError(message);
    };

    const start = () => {
      try {
        recognition?.start();
      } catch {
        // 已在辨識中
      }
    };

    const handleResult = (matcher: Matcher, event: SpeechRecognitionEvent) => {
      const now = performance.now();
      const motion = motionRef.current;
      recordHeard(motion, now);

      let interim = '';
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
      setHeard((heardRef.current + interim).slice(-HEARD_LENGTH));

      const tokens = tokensRef.current;
      const spoken = spokenRef.current.concat(matcher.tokenize(interim));
      let match = matcher.locate(tokens, spoken, motion.index);

      if (!match && now - lastRelocateRef.current > RELOCATE_INTERVAL) {
        lastRelocateRef.current = now;
        match = matcher.relocate(tokens, spoken, motion.index);
      }
      if (!match) return;

      setSimilarity(match.similarity);
      recordMatch(motion, match.index, now);
    };

    setStatus('starting');
    loadMatcher().then(
      (matcher) => {
        if (!active) return;
        tokensRef.current = matcher.tokenize(text);
        readyRef.current = true;
        anchor();

        recognition = new Recognition();
        recognition.lang = getRecognitionLang(text);
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => setStatus('listening');
        recognition.onresult = (event) => handleResult(matcher, event);
        recognition.onerror = (event) => {
          const message = ERROR_MESSAGES[event.error];
          if (message) fail(message);
        };
        // Chrome 靜音一陣子或約一分鐘就會自動結束，需要接續重啟
        recognition.onend = () => {
          if (!active) return;
          restartTimer = window.setTimeout(() => {
            if (active) start();
          }, RESTART_DELAY);
        };
        recognitionRef.current = recognition;
        start();
      },
      () => fail('拼音模組載入失敗，請重新整理頁面'),
    );

    return () => {
      active = false;
      readyRef.current = false;
      window.clearTimeout(restartTimer);
      recognitionRef.current = null;
      if (recognition) {
        recognition.onend = null;
        recognition.abort();
      }
      setStatus('idle');
    };
  }, [enabled, text, anchor]);

  return { status, heard, similarity, reanchor, predict, getTokens };
};
