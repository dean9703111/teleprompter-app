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

export const createCharRange = (index: CharPosition[], from: number, to: number): Range | null => {
  const first = index[from];
  const last = index[to - 1];
  if (!first || !last || to <= from) return null;

  const range = document.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset + last.length);
  return range;
};
