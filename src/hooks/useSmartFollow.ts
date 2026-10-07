import { useCallback, useEffect, useRef, useState } from 'react';
import type { Token } from '../utils/pinyinMatcher';

type Matcher = typeof import('../utils/pinyinMatcher');

export type FollowReason = 'speech' | 'anchor' | 'refresh';
export type FollowStatus = 'idle' | 'starting' | 'listening';

interface UseSmartFollowOptions {
  enabled: boolean;
  text: string;
  resolveCursor: (tokens: Token[]) => number;
  onCursorChange: (index: number, tokens: Token[], reason: FollowReason) => void;
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

export const useSmartFollow = ({ enabled, text, resolveCursor, onCursorChange, onError }: UseSmartFollowOptions) => {
  const [status, setStatus] = useState<FollowStatus>('idle');
  const [heard, setHeard] = useState('');
  const [similarity, setSimilarity] = useState<number | null>(null);

  const callbacksRef = useRef({ resolveCursor, onCursorChange, onError });
  useEffect(() => {
    callbacksRef.current = { resolveCursor, onCursorChange, onError };
  });

  const tokensRef = useRef<Token[]>([]);
  const cursorRef = useRef(-1);
  const spokenRef = useRef<Token[]>([]);
  const heardRef = useRef('');
  const readyRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastRelocateRef = useRef(0);

  const anchor = useCallback(() => {
    const tokens = tokensRef.current;
    cursorRef.current = callbacksRef.current.resolveCursor(tokens);
    spokenRef.current = [];
    heardRef.current = '';
    setHeard('');
    setSimilarity(null);
    callbacksRef.current.onCursorChange(cursorRef.current, tokens, 'anchor');
  }, []);

  // 手動捲動後，以畫面上的位置為準重新定位；中斷辨識，避免還沒結束的那句把位置拉回去
  const reanchor = useCallback(() => {
    if (!readyRef.current) return;
    anchor();
    recognitionRef.current?.abort();
  }, [anchor]);

  const refresh = useCallback(() => {
    if (!readyRef.current) return;
    callbacksRef.current.onCursorChange(cursorRef.current, tokensRef.current, 'refresh');
  }, []);

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
      let match = matcher.locate(tokens, spoken, cursorRef.current);

      const now = performance.now();
      if (!match && now - lastRelocateRef.current > RELOCATE_INTERVAL) {
        lastRelocateRef.current = now;
        match = matcher.relocate(tokens, spoken, cursorRef.current);
      }
      if (!match) return;

      setSimilarity(match.similarity);
      if (match.index === cursorRef.current) return;
      cursorRef.current = match.index;
      callbacksRef.current.onCursorChange(match.index, tokens, 'speech');
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

  return { status, heard, similarity, reanchor, refresh };
};
