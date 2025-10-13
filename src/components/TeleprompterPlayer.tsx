import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Slider,
  TextField,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  Speed,
  FormatSize,
  VerticalSplit,
  Close,
  Splitscreen,
} from '@mui/icons-material';

interface TeleprompterPlayerProps {
  text: string;
  onExit: () => void;
}

const TeleprompterPlayer: React.FC<TeleprompterPlayerProps> = ({ text, onExit }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [fontSize, setFontSize] = useState(48);
  const [progress, setProgress] = useState(0);
  const [gapWidth, setGapWidth] = useState(0); // 間隔寬度 0-30%
  const [paragraphSplit, setParagraphSplit] = useState(100); // 段落分割長度 10-200
  const [renderedLinesHtml, setRenderedLinesHtml] = useState<string>('');
  
  const textRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const measureSpanRef = useRef<HTMLSpanElement | null>(null);

  // 載入儲存的設定
  useEffect(() => {
    const savedSpeed = localStorage.getItem('teleprompter-speed');
    const savedFontSize = localStorage.getItem('teleprompter-fontSize');
    const savedGapWidth = localStorage.getItem('teleprompter-gapWidth');
    const savedParagraphSplit = localStorage.getItem('teleprompter-paragraphSplit');
    
    if (savedSpeed) setSpeed(parseInt(savedSpeed));
    if (savedFontSize) setFontSize(parseInt(savedFontSize));
    if (savedGapWidth) setGapWidth(parseInt(savedGapWidth));
    if (savedParagraphSplit) setParagraphSplit(parseInt(savedParagraphSplit));
  }, []);

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

  // 計算總高度和進度
  const calculateProgress = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const maxScroll = container.scrollHeight - container.clientHeight;
    
    if (maxScroll <= 0) {
      setProgress(100);
      return;
    }
    
    const currentProgress = (container.scrollTop / maxScroll) * 100;
    setProgress(Math.min(100, Math.max(0, currentProgress)));
  }, []);

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
  }, [calculateProgress]);

  // 快捷鍵處理
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        setIsPlaying(!isPlaying);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSpeed(prev => Math.min(20, prev + 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSpeed(prev => Math.max(1, prev - 1));
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
  }, [isPlaying, onExit]);

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

  // 渲染繞柱子的文字
  const renderLinesWithPillar = useCallback(() => {
    if (gapWidth === 0 || !containerRef.current || !measureSpanRef.current) {
      setRenderedLinesHtml('');
      return;
    }

    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const computedStyle = getComputedStyle(container);
    const padL = parseFloat(computedStyle.paddingLeft) || 0;
    const padR = parseFloat(computedStyle.paddingRight) || 0;
    const contentWidth = containerWidth - padL - padR;
    
    const pillarWidthPx = (containerWidth * gapWidth) / 100;
    const centerX = padL + contentWidth / 2;
    const pillarLeft = centerX - pillarWidthPx / 2;
    const pillarRight = centerX + pillarWidthPx / 2;
    const margin = 8;

    const measureSpan = measureSpanRef.current;
    measureSpan.style.fontSize = `${fontSize}px`;
    measureSpan.style.fontFamily = 'inherit';

    const escapeHtml = (text: string) => {
      return text.replace(/[<>&"]/g, (c) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'
      }[c] || c));
    };

    let html = '';
    const paras = processedText.replace(/\r/g, '').split('\n');

    for (let pi = 0; pi < paras.length; ++pi) {
      let para = paras[pi];
      if (!para) {
        html += `<div style="display:flex;align-items:flex-start;width:100%;min-height:1em;margin-bottom:0.1em;flex-wrap:nowrap;overflow:hidden;">
          <span style="display:inline-block;white-space:pre;max-width:48vw;overflow-wrap:break-word;word-break:break-all;">&nbsp;</span>
          <span style="display:inline-block;height:1em;flex-shrink:0;width:${gapWidth}%;"></span>
          <span style="display:inline-block;white-space:pre;max-width:48vw;overflow-wrap:break-word;word-break:break-all;"></span>
        </div>`;
        continue;
      }

      while (para.length > 0) {
        let left = '', right = '';
        let i = 1;

        // 填充左邊直到碰到柱子
        for (; i <= para.length; ++i) {
          measureSpan.textContent = para.slice(0, i);
          if (measureSpan.offsetWidth < pillarLeft - padL - margin) {
            left = para.slice(0, i);
          } else {
            left = para.slice(0, i - 1);
            right = para.slice(i - 1);
            break;
          }
        }

        if (right === '' && left !== para) {
          right = para;
          left = '';
        }

        // 填充右邊
        let rightSeg = '';
        if (right) {
          let j = 1;
          for (; j <= right.length; ++j) {
            measureSpan.textContent = right.slice(0, j);
            if (measureSpan.offsetWidth < (contentWidth - (pillarRight - padL) - margin)) {
              rightSeg = right.slice(0, j);
            } else {
              rightSeg = right.slice(0, j - 1);
              break;
            }
          }
        }

        if (right && rightSeg === '' && right.length > 0) {
          rightSeg = right;
        }

        html += `<div style="display:flex;align-items:flex-start;width:100%;min-height:1em;margin-bottom:0.1em;flex-wrap:nowrap;overflow:hidden;">
          <span style="display:inline-block;white-space:pre;max-width:48vw;overflow-wrap:break-word;word-break:break-all;">${escapeHtml(left) || '&nbsp;'}</span>
          <span style="display:inline-block;height:1em;flex-shrink:0;width:${gapWidth}%;"></span>
          <span style="display:inline-block;white-space:pre;max-width:48vw;overflow-wrap:break-word;word-break:break-all;">${escapeHtml(rightSeg)}</span>
        </div>`;

        if (right) {
          para = right.slice(rightSeg.length);
        } else {
          para = '';
        }
      }
    }

    setRenderedLinesHtml(html);
  }, [processedText, fontSize, gapWidth]);

  // 當相關參數變化時重新渲染
  useEffect(() => {
    renderLinesWithPillar();
  }, [renderLinesWithPillar]);

  // 監聽視窗大小變化，重新計算排版
  useEffect(() => {
    const handleResize = () => {
      if (gapWidth > 0) {
        renderLinesWithPillar();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gapWidth, renderLinesWithPillar]);

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          zIndex: 1001,
        }}
      >
        {/* 播放控制 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            onClick={() => setIsPlaying(!isPlaying)}
            sx={{
              backgroundColor: isPlaying ? '#ef4444' : '#22c55e',
              color: '#ffffff',
              minWidth: '80px',
              height: '40px',
              fontSize: '14px',
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: isPlaying ? '#dc2626' : '#16a34a',
              },
            }}
          >
            {isPlaying ? '⏸ 暫停' : '▶ 播放'}
          </Button>
        </Box>

        {/* 中央控制區 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* 速度控制 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Speed sx={{ fontSize: '16px' }} />
            <Typography variant="body2" sx={{ minWidth: '40px' }}>
              速度
            </Typography>
            <Slider
              value={speed}
              onChange={(_, value) => setSpeed(value as number)}
              min={1}
              max={20}
              sx={{
                width: '80px',
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
              value={speed}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= 20) {
                  setSpeed(value);
                }
              }}
              size="small"
              sx={{
                width: '60px',
                marginLeft: '0.5em',
                '& .MuiOutlinedInput-root': {
                  height: '32px',
                  fontSize: '12px',
                  color: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,255,255,0.5)',
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
            <FormatSize sx={{ fontSize: '16px' }} />
            <Typography variant="body2" sx={{ minWidth: '40px' }}>
              字體
            </Typography>
            <Slider
              value={fontSize}
              onChange={(_, value) => setFontSize(value as number)}
              min={35}
              max={100}
              sx={{
                width: '80px',
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
                marginLeft: '0.5em',
                '& .MuiOutlinedInput-root': {
                  height: '32px',
                  fontSize: '12px',
                  color: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,255,255,0.5)',
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
            <VerticalSplit sx={{ fontSize: '16px' }} />
            <Typography variant="body2" sx={{ minWidth: '40px' }}>
              間隔
            </Typography>
            <Slider
              value={gapWidth}
              onChange={(_, value) => setGapWidth(value as number)}
              min={0}
              max={30}
              sx={{
                width: '80px',
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
                marginLeft: '0.5em',
                '& .MuiOutlinedInput-root': {
                  height: '32px',
                  fontSize: '12px',
                  color: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,255,255,0.5)',
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
            <Splitscreen sx={{ fontSize: '16px' }} />
            <Typography variant="body2" sx={{ minWidth: '40px' }}>
              分段
            </Typography>
            <Slider
              value={paragraphSplit}
              onChange={(_, value) => setParagraphSplit(value as number)}
              min={10}
              max={200}
              sx={{
                width: '80px',
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
                marginLeft: '0.5em',
                '& .MuiOutlinedInput-root': {
                  height: '32px',
                  fontSize: '12px',
                  color: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,255,255,0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#2563eb',
                  },
                },
              }}
            />
          </Box>
        </Box>

        {/* 退出按鈕 */}
        <Button
          variant="outlined"
          onClick={onExit}
          startIcon={<Close />}
          sx={{
            color: '#ffffff',
            borderColor: 'rgba(255,255,255,0.3)',
            minWidth: '80px',
            height: '40px',
            fontSize: '14px',
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.5)',
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          退出
        </Button>
      </Box>

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
        }}
      >
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
              dangerouslySetInnerHTML={{ __html: renderedLinesHtml }}
            />
          </Box>
        )}
      </Box>

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
