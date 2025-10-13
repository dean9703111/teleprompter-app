import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
  Chip,
} from '@mui/material';
import { PlayArrow, Keyboard, GitHub, YouTube } from '@mui/icons-material';
import TeleprompterPlayer from './components/TeleprompterPlayer';

function App() {
  const [text, setText] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 字數統計邏輯
  const getTextStats = () => {
    // 中文字數（不包含標點符號）
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    
    // 中文標點符號
    const chinesePunctuation = (text.match(/[\u3000-\u303f\uff00-\uffef]/g) || []).length;
    
    // 英文單詞數
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    
    // 英文標點符號
    const englishPunctuation = (text.match(/[.,!?;:'"()\-]/g) || []).length;
    
    // 總行數
    const totalLines = text ? text.split('\n').length : 0;
    
    return {
      chineseChars,
      chinesePunctuation,
      englishWords,
      englishPunctuation,
      totalLines,
    };
  };

  const stats = getTextStats();

  const handleStartTeleprompter = () => {
    if (text.trim()) {
      setIsFullscreen(true);
    }
  };

  const handleExitFullscreen = () => {
    setIsFullscreen(false);
  };

  if (isFullscreen) {
    return (
      <TeleprompterPlayer
        text={text}
        onExit={handleExitFullscreen}
      />
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="md">
        {/* 標題和作者資訊 */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontSize: { xs: '24px', sm: '32px' },
              fontWeight: 'bold',
              color: '#1e293b',
              mb: 1.5,
            }}
          >
            提詞器
          </Typography>
          
          <Typography
            component="a"
            href="https://medium.com/@dean-lin"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{
              color: '#64748b',
              fontSize: '16px',
              mb: 3,
              textDecoration: 'none',
              transition: 'color 0.2s',
              '&:hover': {
                color: '#1e293b',
                textDecoration: 'underline',
              },
            }}
          >
            作者 林鼎淵 Dean Lin | 追蹤我學習更多資訊
          </Typography>
          
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 1.5,
              mt: 1.5,
            }}
          >
            <Box
              component="a"
              href="https://www.facebook.com/deanlinbao"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#1877f2',
                color: '#ffffff',
                textDecoration: 'none',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              <Typography sx={{ fontSize: 16, fontWeight: 'bold' }}>f</Typography>
            </Box>
            <Box
              component="a"
              href="https://github.com/dean9703111"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#181717',
                color: '#ffffff',
                textDecoration: 'none',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              <GitHub sx={{ fontSize: 18 }} />
            </Box>
            <Box
              component="a"
              href="https://dean-lin.medium.com/"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#000000',
                color: '#ffffff',
                textDecoration: 'none',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              <Typography sx={{ fontSize: 16, fontWeight: 'bold' }}>M</Typography>
            </Box>
            <Box
              component="a"
              href="https://www.youtube.com/@dlcorner"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#ff0000',
                color: '#ffffff',
                textDecoration: 'none',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              <YouTube sx={{ fontSize: 18 }} />
            </Box>
          </Box>
        </Box>

        {/* 主要文字輸入區塊 */}
        <Paper
          elevation={3}
          sx={{
            p: 4,
            borderRadius: 2,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
          }}
        >
          <TextField
            multiline
            fullWidth
            rows={isMobile ? 6 : 8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="請輸入要朗讀的文字內容..."
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '16px',
                lineHeight: 1.6,
                color: '#1e293b',
                '& fieldset': {
                  borderColor: '#e2e8f0',
                },
                '&:hover fieldset': {
                  borderColor: '#2563eb',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#2563eb',
                },
              },
            }}
          />

          {/* 字數統計區塊 */}
          <Box
            sx={{
              mt: 3,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {/* 中文統計 */}
            <Paper
              elevation={1}
              sx={{
                p: 1.5,
                backgroundColor: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: 2,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#92400e',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                中文
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography
                    sx={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#b45309',
                    }}
                  >
                    {stats.chineseChars}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: '#78350f', fontSize: '11px' }}
                  >
                    字數
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#d97706',
                    }}
                  >
                    {stats.chinesePunctuation}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: '#78350f', fontSize: '11px' }}
                  >
                    標點
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* 英文統計 */}
            <Paper
              elevation={1}
              sx={{
                p: 1.5,
                backgroundColor: '#ddd6fe',
                border: '2px solid #8b5cf6',
                borderRadius: 2,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#4c1d95',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                英文
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography
                    sx={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#7c3aed',
                    }}
                  >
                    {stats.englishWords}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: '#5b21b6', fontSize: '11px' }}
                  >
                    單詞
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#a78bfa',
                    }}
                  >
                    {stats.englishPunctuation}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: '#5b21b6', fontSize: '11px' }}
                  >
                    標點
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* 行數統計 */}
            <Paper
              elevation={1}
              sx={{
                p: 1.5,
                backgroundColor: '#d1fae5',
                border: '2px solid #10b981',
                borderRadius: 2,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#064e3b',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                文章
              </Typography>
              <Box>
                <Typography
                  sx={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#059669',
                  }}
                >
                  {stats.totalLines}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: '#065f46', fontSize: '11px' }}
                >
                  總行數
                </Typography>
              </Box>
            </Paper>
          </Box>
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={handleStartTeleprompter}
              disabled={!text.trim()}
              sx={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '18px',
                fontWeight: 'bold',
                px: 4,
                py: 1.5,
                borderRadius: 2,
                '&:hover': {
                  backgroundColor: '#1d4ed8',
                },
                '&:disabled': {
                  backgroundColor: '#64748b',
                },
              }}
            >
              開始提詞
            </Button>
          </Box>
        </Paper>

        {/* 快捷鍵說明區塊 */}
        <Paper
          elevation={2}
          sx={{
            mt: 3,
            p: 3,
            borderRadius: 2,
            backgroundColor: '#dbeafe',
            border: '2px solid #3b82f6',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Keyboard sx={{ fontSize: 28, color: '#1e40af', mr: 1 }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                color: '#1e40af',
                fontSize: '20px',
              }}
            >
              快捷鍵說明
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {[
              { key: 'Space', desc: '播放/暫停' },
              { key: 'Esc', desc: '退出全螢幕' },
              { key: '↑', desc: '加速' },
              { key: '↓', desc: '減速' },
              { key: '+', desc: '放大字體' },
              { key: '-', desc: '縮小字體' },
            ].map((item) => (
              <Box
                key={item.key}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Chip
                  label={item.key}
                  sx={{
                    backgroundColor: '#1e40af',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    minWidth: '60px',
                    height: '28px',
                  }}
                />
                <Typography
                  sx={{
                    color: '#334155',
                    fontSize: '14px',
                  }}
                >
                  {item.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default App;
