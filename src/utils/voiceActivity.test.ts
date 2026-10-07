import { describe, expect, it } from 'vitest';
import { createVoiceDetector } from './voiceActivity';

describe('createVoiceDetector', () => {
  it('安靜時不算人聲，講話時算', () => {
    const isVoice = createVoiceDetector();
    for (let i = 0; i < 20; i++) expect(isVoice(0.0005)).toBe(false);
    expect(isVoice(0.02)).toBe(true);
    expect(isVoice(0.0006)).toBe(false);
  });

  it('環境變吵後會適應，不會一直當成人聲', () => {
    const isVoice = createVoiceDetector();
    isVoice(0.0005);
    // 持續 30 秒（每幀 50ms）穩定的 0.004 背景聲
    let last = true;
    for (let i = 0; i < 600; i++) last = isVoice(0.004);
    expect(last).toBe(false);
  });
});
