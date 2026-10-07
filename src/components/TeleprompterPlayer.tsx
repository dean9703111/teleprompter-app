import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Slider,
  TextField,
  Typography,
  LinearProgress,
  Drawer,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Speed,
  FormatSize,
  VerticalSplit,
  Close,
  Splitscreen,
  Settings,
  Mic,
  AlignVerticalTop,
} from '@mui/icons-material';
import { useSmartFollow, type FollowReason } from '../hooks/useSmartFollow';
import type { Token } from '../utils/pinyinMatcher';
import { buildCharIndex, createCharRange, type CharPosition } from '../utils/textIndex';

const FOLLOW_EASING = 0.1;
const FOLLOW_ANCHOR_MIN = 10;
const FOLLOW_ANCHOR_MAX = 60;
const READ_HIGHLIGHT = 'teleprompter-read';
const supportsHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS;

interface TeleprompterPlayerProps {
  text: string;
  onExit: () => void;
}

const TeleprompterPlayer: React.FC<TeleprompterPlayerProps> = ({ text, onExit }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(() => {
    const saved = localStorage.getItem('teleprompter-speed');
    return saved ? parseInt(saved) : 10;
  });
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('teleprompter-fontSize');
    return saved ? parseInt(saved) : 48;
  });
  const [progress, setProgress] = useState(0);
  const [gapWidth, setGapWidth] = useState(() => {
    const saved = localStorage.getItem('teleprompter-gapWidth');
    return saved ? parseInt(saved) : 0;
  });
  const [paragraphSplit, setParagraphSplit] = useState(() => {
    const saved = localStorage.getItem('teleprompter-paragraphSplit');
    return saved ? parseInt(saved) : 100;
  });
  const [renderedLinesHtml, setRenderedLinesHtml] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState(0); // 預計完成時間（秒）
  const [settingsOpen, setSettingsOpen] = useState(false); // 設定面板開關
  const [isFollowing, setIsFollowing] = useState(false); // 智慧跟讀
  const [followError, setFollowError] = useState<string | null>(null);
  const [followAnchor, setFollowAnchor] = useState(() => {
    // 跟讀時，目前念到的那一行停在畫面高度的百分比
    const saved = localStorage.getItem('teleprompter-followAnchor');
    return saved ? parseInt(saved) : 25;
  });
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // 768px 以下視為手機
  const isNarrow = useMediaQuery('(max-width:1200px)'); // 1200px 以下隱藏文字
  
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const measureSpanRef = useRef<HTMLSpanElement | null>(null);
  const pillarBoxRef = useRef<HTMLDivElement>(null);
  const charIndexRef = useRef<CharPosition[] | null>(null);
  const followTargetRef = useRef<number | null>(null);
  const followFrameRef = useRef<number | undefined>(undefined);
  const reanchorTimerRef = useRef<number | undefined>(undefined);

  // 儲存設定到 localStorage
  useEffect(() => {
    localStorage.setItem('teleprompter-speed', speed.toString());
  }, [speed]);

  useEffect(() => {
    localStorage.setItem('teleprompter-fontSize', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('teleprompter-gapWidth', gapWidth.toString());
  }, [gapWidth]);

  useEffect(() => {
    localStorage.setItem('teleprompter-paragraphSplit', paragraphSplit.toString());
  }, [paragraphSplit]);

  useEffect(() => {
    localStorage.setItem('teleprompter-followAnchor', followAnchor.toString());
  }, [followAnchor]);

  // 計算總高度和進度
  const calculateProgress = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const maxScroll = container.scrollHeight - container.clientHeight;
    
    if (maxScroll <= 0) {
      setProgress(100);
      setEstimatedTime(0);
      return;
    }
    
    const currentProgress = (container.scrollTop / maxScroll) * 100;
    setProgress(Math.min(100, Math.max(0, currentProgress)));

    // 計算剩餘滾動距離和預計時間
    const remainingScroll = maxScroll - container.scrollTop;
    const scrollSpeed = speed * 50; // px per second
    const estimatedSeconds = remainingScroll / scrollSpeed;
    setEstimatedTime(Math.max(0, Math.ceil(estimatedSeconds)));
  }, [speed]);

  // 智慧跟讀：畫面字元索引（DOM 重新渲染後失效）
  const getCharIndex = useCallback(() => {
    const cached = charIndexRef.current;
    if (cached?.length && cached[0].node.isConnected && cached[cached.length - 1].node.isConnected) {
      return cached;
    }
    const index = containerRef.current ? buildCharIndex(containerRef.current) : [];
    charIndexRef.current = index;
    return index;
  }, []);

  const stepFollowScroll = useCallback(() => {
    const container = containerRef.current;
    const target = followTargetRef.current;
    if (!container || target === null) {
      followFrameRef.current = undefined;
      return;
    }

    const before = container.scrollTop;
    const diff = target - before;
    if (Math.abs(diff) < 1) {
      container.scrollTop = target;
      followTargetRef.current = null;
    } else {
      container.scrollTop = before + Math.sign(diff) * Math.max(1, Math.abs(diff) * FOLLOW_EASING);
    }
    calculateProgress();

    if (followTargetRef.current === null || container.scrollTop === before) {
      followTargetRef.current = null;
      followFrameRef.current = undefined;
      return;
    }
    followFrameRef.current = requestAnimationFrame(stepFollowScroll);
  }, [calculateProgress]);

  const scrollFollowTo = useCallback((token: Token) => {
    const container = containerRef.current;
    const rect = createCharRange(getCharIndex(), token.start, token.start + 1)?.getBoundingClientRect();
    if (!container || !rect) return;

    const lineCenter = rect.top + rect.height / 2 - container.getBoundingClientRect().top + container.scrollTop;
    const maxScroll = container.scrollHeight - container.clientHeight;
    const target = lineCenter - (container.clientHeight * followAnchor) / 100;
    followTargetRef.current = Math.max(0, Math.min(maxScroll, target));
    if (followFrameRef.current === undefined) {
      followFrameRef.current = requestAnimationFrame(stepFollowScroll);
    }
  }, [getCharIndex, stepFollowScroll, followAnchor]);

  // 已念過的文字變暗（CSS Custom Highlight API，不動 DOM）
  const highlightRead = useCallback((token: Token | undefined) => {
    if (!supportsHighlight) return;
    const range = token ? createCharRange(getCharIndex(), 0, token.end) : null;
    if (range) {
      CSS.highlights.set(READ_HIGHLIGHT, new Highlight(range));
    } else {
      CSS.highlights.delete(READ_HIGHLIGHT);
    }
  }, [getCharIndex]);

  // 以畫面上「跟讀線」所在那一行為起點，回傳它前一個 token
  const resolveFollowCursor = useCallback((tokens: Token[]) => {
    const container = containerRef.current;
    if (!container || !tokens.length) return -1;

    const index = getCharIndex();
    const anchorY = container.getBoundingClientRect().top + (container.clientHeight * followAnchor) / 100;
    let lo = 0;
    let hi = tokens.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const rect = createCharRange(index, tokens[mid].start, tokens[mid].start + 1)?.getBoundingClientRect();
      if (rect && rect.bottom <= anchorY) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo - 1;
  }, [getCharIndex, followAnchor]);

  const handleFollowCursor = useCallback((index: number, tokens: Token[], reason: FollowReason) => {
    const token = tokens[index];
    highlightRead(token);
    if (token && reason !== 'anchor') scrollFollowTo(token);
  }, [highlightRead, scrollFollowTo]);

  const handleFollowError = useCallback((message: string) => {
    setFollowError(message);
    setIsFollowing(false);
  }, []);

  const follow = useSmartFollow({
    enabled: isFollowing,
    text,
    resolveCursor: resolveFollowCursor,
    onCursorChange: handleFollowCursor,
    onError: handleFollowError,
  });
  const { reanchor: reanchorFollow, refresh: refreshFollow } = follow;

  const toggleFollow = useCallback(() => {
    if (!isFollowing) {
      setIsPlaying(false);
      setFollowError(null);
    }
    setIsFollowing(!isFollowing);
  }, [isFollowing]);

  const scheduleReanchor = useCallback(() => {
    followTargetRef.current = null;
    window.clearTimeout(reanchorTimerRef.current);
    reanchorTimerRef.current = window.setTimeout(reanchorFollow, 300);
  }, [reanchorFollow]);

  // 手機觸控捲動也要重新定位
  useEffect(() => {
    const container = containerRef.current;
    if (!isFollowing || !container) return;
    container.addEventListener('touchmove', scheduleReanchor, { passive: true });
    return () => container.removeEventListener('touchmove', scheduleReanchor);
  }, [isFollowing, scheduleReanchor]);

  // 關閉跟讀或離開時清掉高亮與捲動
  useEffect(() => {
    if (!isFollowing) return;
    return () => {
      followTargetRef.current = null;
      if (followFrameRef.current !== undefined) cancelAnimationFrame(followFrameRef.current);
      followFrameRef.current = undefined;
      window.clearTimeout(reanchorTimerRef.current);
      if (supportsHighlight) CSS.highlights.delete(READ_HIGHLIGHT);
    };
  }, [isFollowing]);

  useEffect(() => {
    if (!followError) return;
    const timer = setTimeout(() => setFollowError(null), 6000);
    return () => clearTimeout(timer);
  }, [followError]);

  // 滾動動畫
  const animateScroll = useCallback((timestamp: number) => {
    const container = containerRef.current;
    if (!isPlaying || !container) return;
    
    if (startTimeRef.current === 0) {
      startTimeRef.current = timestamp;
      // 根據當前位置計算已經過的時間
      pausedTimeRef.current = (container.scrollTop / (speed * 50)) * 1000;
    }
    
    const elapsed = timestamp - startTimeRef.current + pausedTimeRef.current;
    const newPosition = (elapsed / 1000) * speed * 50; // 50px per second at speed 1
    
    container.scrollTop = newPosition;
    calculateProgress();
    
    // 檢查是否到達底部
    const maxScroll = container.scrollHeight - container.clientHeight;
    
    if (newPosition >= maxScroll) {
      setIsPlaying(false);
      container.scrollTop = maxScroll;
      return;
    }
    
    animationRef.current = requestAnimationFrame(animateScroll);
  }, [isPlaying, speed, calculateProgress]);

  // 開始/暫停播放
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = 0; // 重置時間參考，讓 animateScroll 重新初始化
      animationRef.current = requestAnimationFrame(animateScroll);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, animateScroll]);

  // 手動滾動處理
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const container = containerRef.current;
    if (!container) return;
    
    // 使用實際的 deltaY 值，提供更自然的滾動感受
    const maxScroll = container.scrollHeight - container.clientHeight;
    
    const newPosition = Math.max(0, Math.min(maxScroll, container.scrollTop + e.deltaY));
    container.scrollTop = newPosition;
    calculateProgress();
    
    // 手動滾動時重置時間參考，確保下次播放從當前位置開始
    startTimeRef.current = 0;
    pausedTimeRef.current = 0;

    if (isFollowing) scheduleReanchor();
  }, [calculateProgress, isFollowing, scheduleReanchor]);

  // 快捷鍵處理
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (isFollowing) {
          setIsFollowing(false);
        } else {
          setIsPlaying(!isPlaying);
        }
        break;
      case 'KeyM':
        if (e.target instanceof HTMLInputElement) break;
        e.preventDefault();
        toggleFollow();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isFollowing) {
          setFollowAnchor(prev => Math.max(FOLLOW_ANCHOR_MIN, prev - 5));
        } else {
          setSpeed(prev => Math.min(20, prev + 1));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (isFollowing) {
          setFollowAnchor(prev => Math.min(FOLLOW_ANCHOR_MAX, prev + 5));
        } else {
          setSpeed(prev => Math.max(1, prev - 1));
        }
        break;
      case 'Equal':
      case 'NumpadAdd':
        e.preventDefault();
        setFontSize(prev => Math.min(100, prev + 5));
        break;
      case 'Minus':
      case 'NumpadSubtract':
        e.preventDefault();
        setFontSize(prev => Math.max(35, prev - 5));
        break;
      case 'Escape':
        onExit();
        break;
    }
  }, [isPlaying, isFollowing, toggleFollow, onExit]);

  // 事件監聽器
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [handleKeyDown, handleWheel]);

  // 重置播放狀態
  const resetPlayback = () => {
    setIsPlaying(false);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    setProgress(0);
    startTimeRef.current = 0;
    pausedTimeRef.current = 0;
  };

  // 當文字改變時重置
  useEffect(() => {
    resetPlayback();
  }, [text]);

  // 計算文字長度（英文單詞算 2 個字符）
  const calculateTextLength = (text: string): number => {
    let length = 0;
    const tokens = text.match(/[a-zA-Z]+|[^a-zA-Z]/g) || [];
    
    tokens.forEach(token => {
      if (/[a-zA-Z]+/.test(token)) {
        // 英文單詞算 2 個字符
        length += 2;
      } else {
        // 其他字符（中文、標點等）算 1 個字符
        length += token.length;
      }
    });
    
    return length;
  };

  // 應用段落分割
  const applyParagraphSplit = useCallback((inputText: string) => {
    if (paragraphSplit <= 0) return inputText;

    const lines = inputText.split('\n');
    const result: string[] = [];

    lines.forEach((line) => {
      const lineLength = calculateTextLength(line);
      
      if (lineLength <= paragraphSplit) {
        result.push(line);
      } else {
        // 將長文字分割成多個段落，保持英文單詞完整
        const tokens = line.match(/[a-zA-Z]+|[^a-zA-Z]/g) || [];
        let currentLine = '';
        let currentLength = 0;

        tokens.forEach(token => {
          const tokenLength = /[a-zA-Z]+/.test(token) ? 2 : token.length;
          
          if (currentLength + tokenLength <= paragraphSplit) {
            currentLine += token;
            currentLength += tokenLength;
          } else {
            // 當前行已滿，開始新行
            if (currentLine) {
              result.push(currentLine);
            }
            currentLine = token;
            currentLength = tokenLength;
          }
        });

        // 添加最後一行
        if (currentLine) {
          result.push(currentLine);
        }
      }
    });

    return result.join('\n');
  }, [paragraphSplit]);

  // 處理後的文字（應用段落分割）
  const processedText = applyParagraphSplit(text);

  // 格式化預計時間
  const formatEstimatedTime = useCallback((seconds: number): string => {
    if (seconds <= 0) return '0s';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }, []);

  // 渲染繞柱子的文字
  const renderLinesWithPillar = useCallback(() => {
    const box = pillarBoxRef.current;
    if (gapWidth === 0 || !box || !measureSpanRef.current) {
      setRenderedLinesHtml('');
      return;
    }

    // 以實際文字框（扣掉 padding）計算：左右欄等寬，中間是 gapWidth% 的柱子
    const computedStyle = getComputedStyle(box);
    const padL = parseFloat(computedStyle.paddingLeft) || 0;
    const padR = parseFloat(computedStyle.paddingRight) || 0;
    const contentWidth = box.clientWidth - padL - padR;
    const margin = 8;
    const columnWidth = Math.max(0, (contentWidth * (100 - gapWidth)) / 200 - margin);

    // 量測字型要跟顯示的一樣是粗體，英數字寬度才不會低估
    const measureSpan = measureSpanRef.current;
    measureSpan.style.fontSize = `${fontSize}px`;
    measureSpan.style.fontFamily = 'inherit';
    measureSpan.style.fontWeight = 'bold';

    const escapeHtml = (text: string) => {
      return text.replace(/[<>&"]/g, (c) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'
      }[c] || c));
    };

    const fitLength = (segment: string) => {
      for (let i = 1; i <= segment.length; ++i) {
        measureSpan.textContent = segment.slice(0, i);
        if (measureSpan.offsetWidth > columnWidth) return i - 1;
      }
      return segment.length;
    };

    const renderRow = (left: string, right: string) =>
      `<div style="display:flex;align-items:flex-start;width:100%;min-height:1em;margin-bottom:0.1em;flex-wrap:nowrap;overflow:hidden;">` +
      `<span style="display:inline-block;flex-shrink:0;width:${columnWidth}px;white-space:pre;">${left}</span>` +
      `<span style="display:inline-block;height:1em;flex-shrink:0;width:${gapWidth}%;"></span>` +
      `<span style="display:inline-block;max-width:${columnWidth}px;white-space:pre;">${right}</span>` +
      `</div>`;

    let html = '';
    const paras = processedText.replace(/\r/g, '').split('\n');

    for (const paragraph of paras) {
      if (!paragraph) {
        html += renderRow('&nbsp;', '');
        continue;
      }

      let para = paragraph;
      while (para.length > 0) {
        const left = para.slice(0, fitLength(para));
        const rest = para.slice(left.length);
        // 欄寬連一個字都放不下時至少放一個字，避免整段塞進右欄
        const right = rest.slice(0, Math.max(1, fitLength(rest)));
        html += renderRow(escapeHtml(left) || '&nbsp;', escapeHtml(right));
        para = rest.slice(right.length);
      }
    }

    setRenderedLinesHtml(html);
  }, [processedText, fontSize, gapWidth]);

  // 當相關參數變化時重新渲染（加入延遲避免拖拉時過於頻繁）
  useEffect(() => {
    const timer = setTimeout(() => {
      renderLinesWithPillar();
    }, 50); // 50ms 延遲
    return () => clearTimeout(timer);
  }, [renderLinesWithPillar]);

  // 同一個物件 React 才不會每次 render 都重設 innerHTML
  const pillarHtml = useMemo(() => ({ __html: renderedLinesHtml }), [renderedLinesHtml]);

  // 排版改變後，跟讀高亮與位置重新對齊
  useEffect(() => {
    charIndexRef.current = null;
    refreshFollow();
  }, [processedText, renderedLinesHtml, gapWidth, fontSize, followAnchor, refreshFollow]);

  // 監聽視窗大小變化，重新計算排版（防抖處理）
  useEffect(() => {
    let resizeTimer: number;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (gapWidth > 0) {
          renderLinesWithPillar();
        }
        // 重新計算預計時間
        calculateProgress();
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [gapWidth, renderLinesWithPillar, calculateProgress]);

  // 初始計算預計時間
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateProgress();
    }, 100);
    return () => clearTimeout(timer);
  }, [processedText, fontSize, calculateProgress]);

  // 設定控制項組件（可重用）
  const settingsControls = useMemo(() => (
    <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 3 : 2, width: isMobile ? '100%' : 'auto' }}>
      {/* 速度控制（跟讀時換成跟讀位置，自動捲動速度用不到） */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isFollowing ? <AlignVerticalTop sx={{ fontSize: '20px' }} /> : <Speed sx={{ fontSize: '20px' }} />}
        {!isNarrow && (
          <Typography variant="body2" sx={{ minWidth: '40px', fontSize: isMobile ? '16px' : '14px' }}>
            {isFollowing ? '位置' : '速度'}
          </Typography>
        )}
        <Slider
          value={isFollowing ? followAnchor : speed}
          onChange={(_, value) => (isFollowing ? setFollowAnchor : setSpeed)(value as number)}
          min={isFollowing ? FOLLOW_ANCHOR_MIN : 1}
          max={isFollowing ? FOLLOW_ANCHOR_MAX : 20}
          sx={{
            flex: 1,
            minWidth: isMobile ? 'auto' : '60px',
            marginRight: isMobile ? '12px' : '8px',
            color: '#2563eb',
            '& .MuiSlider-track': {
              backgroundColor: '#2563eb',
            },
            '& .MuiSlider-rail': {
              backgroundColor: '#e2e8f0',
            },
          }}
        />
        <TextField
          value={isFollowing ? followAnchor : speed}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (isFollowing) {
              if (value >= FOLLOW_ANCHOR_MIN && value <= FOLLOW_ANCHOR_MAX) setFollowAnchor(value);
            } else if (value >= 1 && value <= 20) {
              setSpeed(value);
            }
          }}
          size="small"
          sx={{
            width: '60px',
            '& .MuiOutlinedInput-root': {
              height: '36px',
              fontSize: '14px',
              color: isMobile ? '#000000' : '#ffffff',
              backgroundColor: isMobile ? '#ffffff' : 'rgba(255,255,255,0.1)',
              '& fieldset': {
                borderColor: isMobile ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
              },
              '&:hover fieldset': {
                borderColor: isMobile ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#2563eb',
              },
            },
          }}
        />
      </Box>

      {/* 字體大小控制 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FormatSize sx={{ fontSize: '20px' }} />
        {!isNarrow && (
          <Typography variant="body2" sx={{ minWidth: '40px', fontSize: isMobile ? '16px' : '14px' }}>
            字體
          </Typography>
        )}
        <Slider
          value={fontSize}
          onChange={(_, value) => setFontSize(value as number)}
          min={35}
          max={100}
          sx={{
            flex: 1,
            minWidth: isMobile ? 'auto' : '60px',
            marginRight: isMobile ? '12px' : '8px',
            color: '#2563eb',
            '& .MuiSlider-track': {
              backgroundColor: '#2563eb',
            },
            '& .MuiSlider-rail': {
              backgroundColor: '#e2e8f0',
            },
          }}
        />
        <TextField
          value={fontSize}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (value >= 35 && value <= 100) {
              setFontSize(value);
            }
          }}
          size="small"
          sx={{
            width: '60px',
            '& .MuiOutlinedInput-root': {
              height: '36px',
              fontSize: '14px',
              color: isMobile ? '#000000' : '#ffffff',
              backgroundColor: isMobile ? '#ffffff' : 'rgba(255,255,255,0.1)',
              '& fieldset': {
                borderColor: isMobile ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
              },
              '&:hover fieldset': {
                borderColor: isMobile ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#2563eb',
              },
            },
          }}
        />
      </Box>

      {/* 間隔寬度控制 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <VerticalSplit sx={{ fontSize: '20px', mr: 0.5 }} />
        {!isNarrow && (
          <Typography variant="body2" sx={{ minWidth: '40px', fontSize: isMobile ? '16px' : '14px' }}>
            間隔
          </Typography>
        )}
        <Slider
          value={gapWidth}
          onChange={(_, value) => setGapWidth(value as number)}
          min={0}
          max={30}
          sx={{
            flex: 1,
            minWidth: isMobile ? 'auto' : '60px',
            marginRight: isMobile ? '12px' : '8px',
            color: '#2563eb',
            '& .MuiSlider-track': {
              backgroundColor: '#2563eb',
            },
            '& .MuiSlider-rail': {
              backgroundColor: '#e2e8f0',
            },
          }}
        />
        <TextField
          value={gapWidth}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (value >= 0 && value <= 30) {
              setGapWidth(value);
            }
          }}
          size="small"
          sx={{
            width: '60px',
            '& .MuiOutlinedInput-root': {
              height: '36px',
              fontSize: '14px',
              color: isMobile ? '#000000' : '#ffffff',
              backgroundColor: isMobile ? '#ffffff' : 'rgba(255,255,255,0.1)',
              '& fieldset': {
                borderColor: isMobile ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
              },
              '&:hover fieldset': {
                borderColor: isMobile ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#2563eb',
              },
            },
          }}
        />
      </Box>

      {/* 段落分割控制 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Splitscreen sx={{ fontSize: '20px' }} />
        {!isNarrow && (
          <Typography variant="body2" sx={{ minWidth: '40px', fontSize: isMobile ? '16px' : '14px' }}>
            分段
          </Typography>
        )}
        <Slider
          value={paragraphSplit}
          onChange={(_, value) => setParagraphSplit(value as number)}
          min={10}
          max={200}
          sx={{
            flex: 1,
            minWidth: isMobile ? 'auto' : '60px',
            marginRight: isMobile ? '12px' : '8px',
            color: '#2563eb',
            '& .MuiSlider-track': {
              backgroundColor: '#2563eb',
            },
            '& .MuiSlider-rail': {
              backgroundColor: '#e2e8f0',
            },
          }}
        />
        <TextField
          value={paragraphSplit}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (value >= 10 && value <= 200) {
              setParagraphSplit(value);
            }
          }}
          size="small"
          sx={{
            width: '60px',
            '& .MuiOutlinedInput-root': {
              height: '36px',
              fontSize: '14px',
              color: isMobile ? '#000000' : '#ffffff',
              backgroundColor: isMobile ? '#ffffff' : 'rgba(255,255,255,0.1)',
              '& fieldset': {
                borderColor: isMobile ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
              },
              '&:hover fieldset': {
                borderColor: isMobile ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#2563eb',
              },
            },
          }}
        />
      </Box>
    </Box>
  ), [speed, fontSize, gapWidth, paragraphSplit, isMobile, isNarrow, isFollowing, followAnchor]);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
        overflow: 'hidden',
        zIndex: 1000,
      }}
    >
      {/* 頂部控制列 */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          backgroundColor: 'rgba(0,0,0,0.8)',
          // 桌面版：控制項在螢幕正中央，左右按鈕放不下時才往旁邊讓
          display: isMobile ? 'flex' : 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          columnGap: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          zIndex: 1001,
        }}
      >
        {/* 播放控制 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifySelf: 'start', whiteSpace: 'nowrap' }}>
          <Button
            variant="contained"
            onClick={() => {
              setIsFollowing(false);
              setIsPlaying(!isPlaying);
            }}
            sx={{
              backgroundColor: isPlaying ? '#ef4444' : '#22c55e',
              color: '#ffffff',
              minWidth: isNarrow ? '40px' : (isMobile ? '70px' : '80px'),
              height: '40px',
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: isPlaying ? '#dc2626' : '#16a34a',
              },
            }}
          >
            {isNarrow ? (isPlaying ? '⏸' : '▶') : (isPlaying ? '⏸ 暫停' : '▶ 播放')}
          </Button>
          <Button
            variant="outlined"
            onClick={toggleFollow}
            title="智慧跟讀：念到哪裡就捲到哪裡（M）"
            startIcon={isNarrow ? undefined : <Mic />}
            sx={{
              color: '#ffffff',
              borderColor: isFollowing ? '#2563eb' : 'rgba(255,255,255,0.3)',
              backgroundColor: isFollowing ? '#2563eb' : 'transparent',
              minWidth: isNarrow ? '40px' : (isMobile ? '70px' : '80px'),
              height: '40px',
              px: 1,
              fontSize: isMobile ? '13px' : '14px',
              fontWeight: 'bold',
              '&:hover': {
                borderColor: isFollowing ? '#1d4ed8' : 'rgba(255,255,255,0.5)',
                backgroundColor: isFollowing ? '#1d4ed8' : 'rgba(255,255,255,0.1)',
              },
            }}
          >
            {isNarrow ? <Mic /> : '跟讀'}
          </Button>
        </Box>

        {/* 中央控制區 - 桌面版顯示完整控制項（真正的螢幕中央） */}
        {!isMobile && settingsControls}

        {/* 手機版顯示設定按鈕 */}
        {isMobile && (
          <Button
            variant="outlined"
            onClick={() => setSettingsOpen(true)}
            startIcon={isNarrow ? undefined : <Settings />}
            sx={{
              color: '#ffffff',
              borderColor: 'rgba(255,255,255,0.3)',
              minWidth: isNarrow ? '40px' : '70px',
              height: '40px',
              fontSize: '13px',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.5)',
                backgroundColor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            {isNarrow ? <Settings /> : '設定'}
          </Button>
        )}

        {/* 退出按鈕 */}
        <Button
          variant="outlined"
          onClick={onExit}
          startIcon={isNarrow ? undefined : <Close />}
          sx={{
            color: '#ffffff',
            borderColor: 'rgba(255,255,255,0.3)',
            minWidth: isNarrow ? '40px' : (isMobile ? '70px' : '80px'),
            height: '40px',
            fontSize: isMobile ? '13px' : '14px',
            justifySelf: 'end',
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.5)',
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          {isNarrow ? <Close /> : '退出'}
        </Button>
      </Box>

      {/* 設定面板 Drawer（手機版） */}
      <Drawer
        anchor="bottom"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            backgroundColor: '#ffffff',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            maxHeight: '80vh',
            padding: 3,
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000000' }}>
            設定
          </Typography>
          <IconButton onClick={() => setSettingsOpen(false)}>
            <Close />
          </IconButton>
        </Box>
        {settingsControls}
      </Drawer>

      {/* 隱藏的測量元素 */}
      <span
        ref={measureSpanRef}
        style={{
          visibility: 'hidden',
          position: 'fixed',
          left: '-9999px',
          top: 0,
          whiteSpace: 'pre',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          zIndex: -99,
          pointerEvents: 'none',
        }}
      />

      {/* 文字顯示區 */}
      <Box
        ref={containerRef}
        sx={{
          position: 'absolute',
          top: '60px',
          left: 0,
          right: 0,
          bottom: '4px',
          overflowY: 'auto',
          overflowX: 'hidden',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none',
          [`&::highlight(${READ_HIGHLIGHT}), & *::highlight(${READ_HIGHLIGHT})`]: {
            color: 'rgba(255,255,255,0.35)',
          },
        }}
      >
        {/* 上方空白區 - 50% 螢幕高度 */}
        <Box sx={{ height: '50vh', pointerEvents: 'none' }} />

        {gapWidth === 0 ? (
          // 無間隔模式 - 原始顯示
          <Box
            ref={textRef}
            sx={{
              padding: 4,
              fontSize: `${fontSize}px`,
              fontWeight: 'bold',
              lineHeight: 1.4,
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {processedText}
          </Box>
        ) : (
          // 分欄模式 - 繞柱子排版
          <Box
            ref={pillarBoxRef}
            sx={{
              position: 'relative',
              padding: 4,
              fontSize: `${fontSize}px`,
              fontWeight: 'bold',
              lineHeight: 1.4,
            }}
          >
            {/* 隱形柱子（不顯示） */}

            {/* 文字行 */}
            <Box
              sx={{ position: 'relative', zIndex: 2 }}
              dangerouslySetInnerHTML={pillarHtml}
            />
          </Box>
        )}

        {/* 下方空白區 - 50% 螢幕高度 */}
        <Box sx={{ height: '50vh', pointerEvents: 'none' }} />
      </Box>

      {/* 跟讀位置標記（對齊文字區 top: 60px、bottom: 4px） */}
      {isFollowing && (
        <Box
          sx={{
            position: 'fixed',
            left: '8px',
            top: `calc(60px + (100vh - 64px) * ${followAnchor / 100})`,
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '10px solid transparent',
            borderBottom: '10px solid transparent',
            borderLeft: '14px solid #2563eb',
            zIndex: 1001,
            pointerEvents: 'none',
            transition: 'top 0.2s ease',
          }}
        />
      )}

      {/* 智慧跟讀狀態 */}
      {(isFollowing || followError) && (
        <Box
          sx={{
            position: 'fixed',
            left: isMobile ? '16px' : '32px',
            bottom: '16px',
            zIndex: 1100,
            maxWidth: isMobile ? 'calc(100vw - 32px)' : '50vw',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            fontSize: '14px',
            color: followError ? '#fca5a5' : 'rgba(255,255,255,0.75)',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '0.75em',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            '@keyframes followPulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.3 },
            },
          }}
        >
          {followError ?? (
            <>
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  flexShrink: 0,
                  borderRadius: '50%',
                  backgroundColor: follow.status === 'listening' ? '#ef4444' : '#94a3b8',
                  animation: follow.status === 'listening' ? 'followPulse 1.2s ease-in-out infinite' : 'none',
                }}
              />
              {follow.status === 'listening' ? '聆聽中' : '啟動中…'}
              {follow.similarity !== null && ` · 相似 ${Math.round(follow.similarity * 100)}%`}
              {follow.heard && (
                <Box component="span" sx={{ color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {follow.heard}
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {/* 預計完成時間顯示 */}
      {!isFollowing && (
        <Box
          sx={{
            position: 'fixed',
            top: isMobile ? '68px' : '70px',
            right: isMobile ? '16px' : '32px',
            zIndex: 1100,
            fontSize: isMobile ? '1.4rem' : '2.2rem',
            color: '#fff',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '1em',
            padding: isMobile ? '0.2em 0.8em' : '0.3em 1.1em',
            pointerEvents: 'none',
            textAlign: 'center',
            minWidth: isMobile ? '2.5em' : '3.5em',
            backdropFilter: 'blur(4px)',
          }}
        >
          {formatEstimatedTime(estimatedTime)}
        </Box>
      )}

      {/* 進度指示器 */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: 'rgba(255,255,255,0.3)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: '#ffffff',
          },
          zIndex: 1001,
        }}
      />
    </Box>
  );
};

export default TeleprompterPlayer;
