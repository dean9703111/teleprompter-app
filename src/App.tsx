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
import { PlayArrow, Keyboard } from '@mui/icons-material';
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
      {/* 頂部標題區塊 */}
      <Box
        sx={{
          width: '100%',
          height: '80px',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 4,
        }}
      >
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontSize: { xs: '24px', sm: '32px' },
            fontWeight: 'bold',
            color: '#1e293b',
            textAlign: 'center',
          }}
        >
          提詞器
        </Typography>
      </Box>

      {/* 主要文字輸入區塊 */}
      <Container maxWidth="md">
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
            rows={isMobile ? 8 : 12}
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
                p: 2,
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
                p: 2,
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
                p: 2,
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
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
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
                  gap: 1.5,
                }}
              >
                <Chip
                  label={item.key}
                  sx={{
                    backgroundColor: '#1e40af',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    minWidth: '70px',
                    height: '32px',
                  }}
                />
                <Typography
                  sx={{
                    color: '#334155',
                    fontSize: '15px',
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
