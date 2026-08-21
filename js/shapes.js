// 후보 블록 풀 구성과 랜덤 뽑기.
// 어떤 블록을 쓸지 / 크기별 등장 확률은 전부 아래 CONFIG에서 조절한다.

import { SHAPES } from './shapes-data.js';

export const CONFIG = {
  /**
   * 크기별 등장 가중치. 같은 크기 안에서는 균등.
   * 균등하게 59종 전부에서 뽑으면 74%가 4칸이라 보드가 순식간에 막힌다.
   */
  sizeWeights: { 1: 5, 2: 20, 3: 40, 4: 35 },

  /**
   * 크기별로 실제 사용할 블록.
   * 'all' 이거나, ['h4-01', 'h4-07', ...] 처럼 id 배열.
   * 4칸 블록 44종 목록은 tools/shapes.html 에서 확인.
   */
  enabled: {
    1: 'all',
    2: 'all',
    3: 'all',
    4: 'all',
  },

  /** 후보 블록이 통째로 보너스 블록으로 나올 확률 */
  bonusChance: 0.15,
};

// 보너스 타일의 금색과 헷갈리지 않도록 노랑/금 계열은 일부러 뺐다
export const BLOCK_COLORS = [
  '#a3d13a', '#f0713a', '#e2593c', '#d9418f',
  '#8a5cf6', '#3b82f6', '#22a06b', '#12b5c9',
];

/** 보너스 타일은 색이 아니라 질감으로 구분한다 (render.js의 drawBonusTile) */
export const BONUS_COLOR = '#ffc93c';

/** CONFIG를 반영한 { size: [shape, ...] } 풀. CONFIG 변경 시 rebuildPool() 호출. */
let pool = null;

export function rebuildPool() {
  pool = new Map();
  for (const size of Object.keys(CONFIG.sizeWeights).map(Number)) {
    const allow = CONFIG.enabled[size];
    const list = SHAPES.filter(
      (s) => s.size === size && (allow === 'all' || allow.includes(s.id))
    );
    if (list.length) pool.set(size, list);
  }
  if (!pool.size) throw new Error('사용 가능한 블록이 하나도 없습니다 - CONFIG.enabled 확인');
  return pool;
}

/** 가중치를 반영해 블록 하나를 뽑는다 */
export function randomShape() {
  if (!pool) rebuildPool();
  const sizes = [...pool.keys()];
  const total = sizes.reduce((sum, s) => sum + (CONFIG.sizeWeights[s] || 0), 0);
  let roll = Math.random() * total;
  let picked = sizes[sizes.length - 1];
  for (const s of sizes) {
    roll -= CONFIG.sizeWeights[s] || 0;
    if (roll <= 0) { picked = s; break; }
  }
  const list = pool.get(picked);
  return list[(Math.random() * list.length) | 0];
}

let candidateSeq = 0;

/** 트레이에 올릴 후보 블록 하나 생성. 보너스 블록은 전체가 보너스 타일이다. */
export function makeCandidate(slot) {
  const shape = randomShape();
  const bonus = Math.random() < CONFIG.bonusChance;
  return {
    uid: ++candidateSeq,
    slot,                 // 0,1,2 -> x, y, z
    shape,
    cells: shape.cells,   // cells[0]이 대표 타일
    bonus,
    color: bonus ? BONUS_COLOR : BLOCK_COLORS[(Math.random() * BLOCK_COLORS.length) | 0],
  };
}

export const SLOT_NAMES = ['x', 'y', 'z'];
