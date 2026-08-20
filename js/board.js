// 보드 상태와 규칙 판정. 렌더링/입력은 전혀 모른다.

import { BOARD_CELLS, LINES, LINES_BY_CELL, cellKey, isOnBoard } from './hex.js';

export class Board {
  constructor() {
    this.reset();
  }

  reset() {
    /** key -> { q, r, color } , 비어있으면 항목 없음 */
    this.filled = new Map();
  }

  isEmpty(q, r) {
    return isOnBoard(q, r) && !this.filled.has(cellKey(q, r));
  }

  /**
   * 대표 타일(cells[0])을 (q, r)에 맞췄을 때 블록이 차지하는 칸들.
   * 보드 밖이거나 이미 찬 칸이 하나라도 있으면 null.
   */
  resolve(cells, q, r) {
    const out = [];
    for (const [dq, dr] of cells) {
      const cq = q + dq;
      const cr = r + dr;
      if (!this.isEmpty(cq, cr)) return null;
      out.push([cq, cr]);
    }
    return out;
  }

  canPlace(cells, q, r) {
    return this.resolve(cells, q, r) !== null;
  }

  /** 보드 어디든 놓을 자리가 있는지 (게임오버/힌트 판정용) */
  hasAnyPlacement(cells) {
    for (const c of BOARD_CELLS) {
      if (this.canPlace(cells, c.q, c.r)) return true;
    }
    return false;
  }

  /** 실제로 채운다. 호출 전에 resolve()로 검증할 것. */
  fill(coords, color) {
    for (const [q, r] of coords) {
      this.filled.set(cellKey(q, r), { q, r, color });
    }
  }

  /**
   * 방금 채운 칸들이 속한 라인 중 "꽉 찬" 라인을 찾는다.
   * 라인 전체가 채워져야 클리어 (라인 길이는 5~9로 제각각).
   */
  findCompletedLines(touchedCoords) {
    const candidates = new Set();
    for (const [q, r] of touchedCoords) {
      for (const i of LINES_BY_CELL.get(cellKey(q, r)) || []) candidates.add(i);
    }
    const done = [];
    for (const i of candidates) {
      const line = LINES[i];
      if (line.keys.every((k) => this.filled.has(k))) done.push(line);
    }
    return done;
  }

  /**
   * 라인들을 지운다. 여러 라인이 겹치는 칸은 라인마다 중복으로 점수를 주되,
   * 실제 삭제는 합집합 한 번만.
   * @returns { removedKeys, tileHits } tileHits = 라인 길이의 총합(중복 포함)
   */
  clearLines(lines) {
    const removed = new Set();
    let tileHits = 0;
    for (const line of lines) {
      tileHits += line.keys.length;
      for (const k of line.keys) removed.add(k);
    }
    const cells = [...removed].map((k) => this.filled.get(k)).filter(Boolean);
    for (const k of removed) this.filled.delete(k);
    return { removedKeys: [...removed], removedCells: cells, tileHits };
  }
}
