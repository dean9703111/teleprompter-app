import React from 'react';
import { Box, Slider, TextField, Typography } from '@mui/material';

interface SettingSliderProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  isMobile: boolean;
  showLabel: boolean;
}

const SettingSlider: React.FC<SettingSliderProps> = ({ icon, label, value, min, max, onChange, isMobile, showLabel }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    {icon}
    {showLabel && (
      <Typography variant="body2" sx={{ minWidth: '40px', fontSize: isMobile ? '16px' : '14px' }}>
        {label}
      </Typography>
    )}
    <Slider
      value={value}
      onChange={(_, next) => onChange(next as number)}
      min={min}
      max={max}
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
      value={value}
      onChange={(e) => {
        const next = parseInt(e.target.value);
        if (next >= min && next <= max) {
          onChange(next);
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
);

export default SettingSlider;
