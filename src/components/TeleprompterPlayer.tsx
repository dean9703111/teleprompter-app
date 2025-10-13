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
} from '@mui/icons-material';

interface TeleprompterPlayerProps {
  text: string;
  onExit: () => void;
}

const TeleprompterPlayer: React.FC<TeleprompterPlayerProps> = ({ text, onExit }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [fontSize, setFontSize] = useState(48);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const textRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  // 載入儲存的設定
  useEffect(() => {
    const savedSpeed = localStorage.getItem('teleprompter-speed');
    const savedFontSize = localStorage.getItem('teleprompter-fontSize');
    
    if (savedSpeed) setSpeed(parseInt(savedSpeed));
    if (savedFontSize) setFontSize(parseInt(savedFontSize));
  }, []);

  // 儲存設定到 localStorage
  useEffect(() => {
    localStorage.setItem('teleprompter-speed', speed.toString());
  }, [speed]);

  useEffect(() => {
    localStorage.setItem('teleprompter-fontSize', fontSize.toString());
  }, [fontSize]);

  // 計算總高度和進度
  const calculateProgress = useCallback(() => {
    if (!textRef.current) return;
    
    const containerHeight = window.innerHeight - 64; // 扣除控制列高度
    const textHeight = textRef.current.scrollHeight;
    const maxScroll = textHeight - containerHeight;
    
    if (maxScroll <= 0) {
      setProgress(100);
      return;
    }
    
    const currentProgress = (scrollPosition / maxScroll) * 100;
    setProgress(Math.min(100, Math.max(0, currentProgress)));
  }, [scrollPosition]);

  // 滾動動畫
  const animateScroll = useCallback((timestamp: number) => {
    if (!isPlaying || !textRef.current) return;
    
    if (startTimeRef.current === 0) {
      startTimeRef.current = timestamp;
      // 根據當前位置計算已經過的時間
      pausedTimeRef.current = (scrollPosition / (speed * 50)) * 1000;
    }
    
    const elapsed = timestamp - startTimeRef.current + pausedTimeRef.current;
    const newPosition = (elapsed / 1000) * speed * 50; // 50px per second at speed 1
    
    setScrollPosition(newPosition);
    calculateProgress();
    
    // 檢查是否到達底部
    const containerHeight = window.innerHeight - 64;
    const textHeight = textRef.current.scrollHeight;
    const maxScroll = textHeight - containerHeight;
    
    if (newPosition >= maxScroll) {
      setIsPlaying(false);
      setScrollPosition(maxScroll);
      return;
    }
    
    animationRef.current = requestAnimationFrame(animateScroll);
  }, [isPlaying, speed, calculateProgress, scrollPosition]);

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
    
    if (!textRef.current) return;
    
    // 使用實際的 deltaY 值，提供更自然的滾動感受
    const containerHeight = window.innerHeight - 64;
    const textHeight = textRef.current.scrollHeight;
    const maxScroll = textHeight - containerHeight;
    
    const newPosition = Math.max(0, Math.min(maxScroll, scrollPosition + e.deltaY));
    setScrollPosition(newPosition);
    calculateProgress();
    
    // 手動滾動時重置時間參考，確保下次播放從當前位置開始
    startTimeRef.current = 0;
    pausedTimeRef.current = 0;
  }, [scrollPosition, calculateProgress]);

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
    setScrollPosition(0);
    setProgress(0);
    startTimeRef.current = 0;
    pausedTimeRef.current = 0;
  };

  // 當文字改變時重置
  useEffect(() => {
    resetPlayback();
  }, [text]);

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

      {/* 文字顯示區 */}
      <Box
        ref={textRef}
        sx={{
          position: 'absolute',
          top: '60px',
          left: 0,
          right: 0,
          bottom: '4px',
          padding: 4,
          fontSize: `${fontSize}px`,
          fontWeight: 'bold',
          lineHeight: 1.4,
          textAlign: 'center',
          transform: `translateY(-${scrollPosition}px)`,
          transition: isPlaying ? 'none' : 'transform 0.1s ease-out',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
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
