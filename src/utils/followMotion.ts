// 依語速推估目前念到的位置：兩次辨識結果之間持續往前推，下一次比對到再校正

// 辨識結果大約落後實際說話 0.3~0.5 秒，預測時補上
const RECOGNITION_LAG = 0.4;
// 最多比最後一次比對超前多少秒的內容
const MAX_LEAD = 1.2;
// 超過這段時間沒有辨識結果，視為停頓，不再往前推
const SPEAKING_TIMEOUT = 800;
// 辨識沒有結果、但麥克風聽得到人聲（Chrome 辨識卡住）時，依語速繼續推進，最多超前最後一次比對這麼多秒
const MAX_COAST_LEAD = 10;
// 超過這段時間麥克風沒有人聲，就不再靠語速推進
const VOICE_TIMEOUT = 400;
// 只有「從最後一次辨識結果起一直在出聲」才靠語速推進；中間安靜過的話，要連續出聲這麼久才算在講話，
// 避免沒說話時滑鼠、呼吸等短促雜音讓畫面暴衝
const SUSTAINED_VOICE = 1000;
const RATE_WINDOW = 6000;
const MIN_RATE_SPAN = 1500;
const MAX_RATE = 8;
// 預測超前、實際比對落後在這個範圍內就等它追上，不倒退；至少要涵蓋最大超前量，否則畫面會上下抖。
// 靠語速推進（coasted）多走的部分另外加進容許範圍
const REWIND_TOLERANCE = Math.ceil(MAX_RATE * MAX_LEAD) + 2;
// 倒退要連續兩次比對都落在差不多的位置才算數，單次誤判（稿子裡相似的句子）不會讓畫面往上跳
const REWIND_CONFIRM_RANGE = 15;
const JUMP_DISTANCE = 40;

export interface FollowMotion {
  index: number;
  at: number;
  rate: number;
  heardAt: number;
  voiceAt: number;
  // 目前這段連續人聲的起點
  voiceRunStart: number;
  predictedAt: number;
  display: number;
  // 靠語速推進、還沒被辨識結果追上的量
  coasted: number;
  // 等待第二次比對確認的倒退位置
  pendingRewind: number | null;
  history: { t: number; index: number }[];
}

export const createMotion = (): FollowMotion => ({
  index: -1,
  at: 0,
  rate: 0,
  heardAt: 0,
  voiceAt: 0,
  voiceRunStart: 0,
  predictedAt: 0,
  display: -1,
  coasted: 0,
  pendingRewind: null,
  history: [],
});

// 重新定位（開始跟讀、手動捲動）時使用；語速保留
export const resetMotion = (motion: FollowMotion, index: number, now: number) => {
  motion.index = index;
  motion.display = index;
  motion.at = now;
  motion.coasted = 0;
  motion.pendingRewind = null;
  motion.history = [];
};

export const recordHeard = (motion: FollowMotion, now: number) => {
  motion.heardAt = now;
};

// 麥克風偵測到人聲（與辨識結果無關）
export const recordVoice = (motion: FollowMotion, now: number) => {
  if (now - motion.voiceAt > VOICE_TIMEOUT) motion.voiceRunStart = now;
  motion.voiceAt = now;
};

const isStillSpeaking = (motion: FollowMotion, now: number) =>
  now - motion.voiceAt < VOICE_TIMEOUT &&
  (motion.voiceRunStart <= motion.heardAt || now - motion.voiceRunStart >= SUSTAINED_VOICE);

export const recordMatch = (motion: FollowMotion, index: number, now: number) => {
  const isRewind = index < motion.display - REWIND_TOLERANCE - motion.coasted;
  if (isRewind) {
    const pending = motion.pendingRewind;
    const confirmed = pending !== null && index >= pending && index <= pending + REWIND_CONFIRM_RANGE;
    if (!confirmed) {
      motion.pendingRewind = index;
      return;
    }
  }
  motion.pendingRewind = null;

  const isJump = index > motion.index + JUMP_DISTANCE;
  if (isRewind || isJump) {
    motion.history = [];
    motion.display = index;
    motion.coasted = 0;
  }

  if (index !== motion.index || !motion.history.length) {
    motion.history.push({ t: now, index });
    motion.history = motion.history.filter((entry) => now - entry.t <= RATE_WINDOW);
    const first = motion.history[0];
    const span = now - first.t;
    if (span >= MIN_RATE_SPAN) {
      motion.rate = Math.min(MAX_RATE, Math.max(0, ((index - first.index) / span) * 1000));
    }
  }

  motion.index = index;
  motion.at = now;
  motion.display = Math.max(motion.display, index);
  // 還沒追上的推進量繼續保留在容許範圍內，追上多少就扣多少
  motion.coasted = Math.min(motion.coasted, Math.max(0, motion.display - index - REWIND_TOLERANCE));
};

export const predictPosition = (motion: FollowMotion, now: number, maxIndex: number) => {
  const elapsed = Math.max(0, now - motion.predictedAt) / 1000;
  motion.predictedAt = now;
  if (motion.index < 0) return motion.display;

  let predicted = motion.index;
  if (motion.rate > 0 && now - motion.heardAt < SPEAKING_TIMEOUT) {
    const lead = Math.min((now - motion.at) / 1000 + RECOGNITION_LAG, MAX_LEAD);
    predicted += motion.rate * lead;
  } else if (motion.rate > 0 && isStillSpeaking(motion, now)) {
    // 辨識卡住但還在講：從目前顯示位置依語速往前推，辨識恢復後再校正
    const coasting = Math.min(motion.display + motion.rate * elapsed, motion.index + motion.rate * MAX_COAST_LEAD);
    motion.coasted += Math.max(0, Math.min(maxIndex, coasting) - motion.display);
    predicted = coasting;
  }

  motion.display = Math.min(maxIndex, Math.max(motion.display, predicted));
  return motion.display;
};
