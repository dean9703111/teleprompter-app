// 「有效字元」= 文字或數字；拼音 token 與畫面 DOM 都用同一個定義計數，才能互相對位
const SIGNIFICANT = /[\p{L}\p{N}]/u;

export const isSignificant = (ch: string) => SIGNIFICANT.test(ch);

export interface CharPosition {
  node: Text;
  offset: number;
  length: number;
}

export const buildCharIndex = (root: Node): CharPosition[] => {
  const positions: CharPosition[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text;
    let offset = 0;
    for (const ch of textNode.data) {
      if (isSignificant(ch)) {
        positions.push({ node: textNode, offset, length: ch.length });
      }
      offset += ch.length;
    }
  }

  return positions;
};

// 把 token 位置（可含小數）換成連續的內容座標 Y：每一行佔「與上一行、下一行中心的中點」之間，
// 行內的字平均分布；相鄰行共用分界點所以只會往前，念到行中間時該行剛好在跟讀線上
// measureCenter(i)：第 i 個 token 在內容座標中的垂直中心，量不到時回傳 null
export const createReadingLine = (
  count: number,
  measureCenter: (i: number) => number | null,
  fallbackLineHeight: number,
) => {
  const centers = new Float64Array(count).fill(NaN);
  const positions = new Float64Array(count).fill(NaN);

  const centerOf = (i: number): number => {
    if (Number.isNaN(centers[i])) {
      centers[i] = measureCenter(i) ?? (i > 0 ? centerOf(i - 1) : 0);
    }
    return centers[i];
  };

  const fillLine = (i: number) => {
    const center = centerOf(i);
    let first = i;
    while (first > 0 && Math.abs(centerOf(first - 1) - center) < 2) first--;
    let last = i;
    while (last < count - 1 && Math.abs(centerOf(last + 1) - center) < 2) last++;

    const prev = first > 0 ? centerOf(first - 1) : center - fallbackLineHeight;
    const next = last < count - 1 ? centerOf(last + 1) : center + fallbackLineHeight;
    const top = (prev + center) / 2;
    const bottom = (center + next) / 2;
    const size = last - first + 1;
    for (let k = first; k <= last; k++) {
      positions[k] = top + ((k - first + 0.5) / size) * (bottom - top);
    }
  };

  const positionOf = (i: number) => {
    if (Number.isNaN(positions[i])) fillLine(i);
    return positions[i];
  };

  return (position: number) => {
    if (!count) return null;
    const clamped = Math.max(0, Math.min(count - 1, position));
    const i = Math.floor(clamped);
    const fraction = clamped - i;
    const y = positionOf(i);
    return fraction && i + 1 < count ? y + (positionOf(i + 1) - y) * fraction : y;
  };
};

export const createCharRange = (index: CharPosition[], from: number, to: number): Range | null => {
  const first = index[from];
  const last = index[to - 1];
  if (!first || !last || to <= from) return null;

  const range = document.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset + last.length);
  return range;
};
