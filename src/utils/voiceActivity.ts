// 用麥克風音量判斷「有沒有在講話」，與語音辨識無關：辨識卡住時靠它決定要不要繼續推進、何時重啟辨識

// 背景噪音估計：音量低於它就直接更新，否則每幀緩慢上升（約 17 秒翻倍），適應環境變吵
const FLOOR_RISE = 1.002;
// 音量超過背景噪音這麼多倍才算人聲
const VOICE_RATIO = 3;
// 很安靜的環境下，背景噪音接近 0，至少要這個音量才算人聲
const MIN_VOICE_RMS = 0.002;

export const createVoiceDetector = () => {
  let floor = 0;
  return (rms: number) => {
    floor = floor === 0 || rms < floor ? rms : floor * FLOOR_RISE;
    return rms > Math.max(floor * VOICE_RATIO, MIN_VOICE_RMS);
  };
};

export const getRms = (samples: Float32Array) => {
  let sum = 0;
  for (const v of samples) sum += v * v;
  return Math.sqrt(sum / samples.length);
};
