// 게임 규칙 · 점수 · 타이머 · 후보 블록 관리. DOM/캔버스는 모른다.

import { Board } from './board.js';
import { makeCandidate } from './shapes.js';
import { axialToPixel } from './hex.js';

export const RULES = {
  durationMs: 90_000,       // 플레이 시간 90초
  pointsPerPlacedTile: 20,  // 놓은 타일 1개당
  pointsPerClearedTile: 100,// 사라진 타일 1개당 (라인 중복 시 중복 계산)
  bonusMultiplier: 2,       // 보너스 타일은 놓을 때도, 사라질 때도 2배
  refreshPenaltyMs: 1_000,  // 리프레시 1초 페널티
  candidateSlots: 3,
};

const HIGH_SCORE_KEY = 'honeycomb-pang.highScore';

/** 착수 점수. 보너스 블록은 전체가 보너스 타일이라 통째로 2배. */
export const placementScore = (tileCount, bonus) =>
  tileCount * RULES.pointsPerPlacedTile * (bonus ? RULES.bonusMultiplier : 1);

/** 클리어 점수. scoreUnits는 board.clearLines()가 계산한 (라인 길이 합 + 보너스 타일 수). */
export const lineClearScore = (scoreUnits) => scoreUnits * RULES.pointsPerClearedTile;

export class Game {
  constructor() {
    this.board = new Board();
    this.state = 'ready';   // ready | playing | over
    this.score = 0;
    this.candidates = [];
    this.effects = [];      // 렌더러가 소비하는 일회성 이펙트
    this.startedAt = 0;
    this.penaltyMs = 0;
    this.lastRemaining = RULES.durationMs;
    this.highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
  }

  start() {
    this.board.reset();
    this.state = 'playing';
    this.score = 0;
    this.penaltyMs = 0;
    this.effects.length = 0;
    this.startedAt = performance.now();
    this.lastRemaining = RULES.durationMs;
    this.candidates = Array.from({ length: RULES.candidateSlots }, (_, i) => makeCandidate(i));
  }

  remainingMs(now = performance.now()) {
    if (this.state === 'ready') return RULES.durationMs;
    if (this.state === 'over') return this.lastRemaining;
    return Math.max(0, RULES.durationMs - (now - this.startedAt) - this.penaltyMs);
  }

  /** 매 프레임 호출. 시간이 다 되면 게임을 끝낸다. */
  tick(now = performance.now()) {
    if (this.state !== 'playing') return;
    this.lastRemaining = this.remainingMs(now);
    if (this.lastRemaining <= 0) this.finish();
  }

  finish() {
    this.state = 'over';
    this.lastRemaining = 0;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(HIGH_SCORE_KEY, String(this.score));
    }
  }

  /** 후보 3개를 모두 새로 뽑는다. 1초 페널티. */
  refresh() {
    if (this.state !== 'playing') return false;
    this.penaltyMs += RULES.refreshPenaltyMs;
    this.candidates = Array.from({ length: RULES.candidateSlots }, (_, i) => makeCandidate(i));
    return true;
  }

  /**
   * 후보 블록을 대표 타일 기준 (q, r)에 놓는다.
   * @returns 성공 시 결과 요약, 실패 시 null
   */
  place(candidate, q, r) {
    if (this.state !== 'playing') return null;
    const coords = this.board.resolve(candidate.cells, q, r);
    if (!coords) return null;

    this.board.fill(coords, candidate.color, candidate.bonus);

    const placeScore = placementScore(coords.length, candidate.bonus);
    this.score += placeScore;

    const lines = this.board.findCompletedLines(coords);
    let clearScore = 0;
    let cleared = null;
    if (lines.length) {
      cleared = this.board.clearLines(lines);
      clearScore = lineClearScore(cleared.scoreUnits);
      this.score += clearScore;
    }

    // 사용한 슬롯만 새로 채운다
    const slot = candidate.slot;
    this.candidates = this.candidates.map((c) =>
      c.uid === candidate.uid ? makeCandidate(slot) : c
    );

    this.pushEffects({ coords, placeScore, lines, cleared, clearScore, bonus: !!candidate.bonus });

    return { coords, placeScore, lines, clearScore, cleared, bonus: !!candidate.bonus };
  }

  /** 점수 팝업 · 소멸 애니메이션 큐잉 */
  pushEffects({ coords, placeScore, lines, cleared, clearScore, bonus }) {
    const now = performance.now();
    const center = (cs) => {
      const pts = cs.map(([q, r]) => axialToPixel(q, r, 1));
      return {
        q: pts.reduce((a, p) => a + p.x, 0) / pts.length,
        r: pts.reduce((a, p) => a + p.y, 0) / pts.length,
      };
    };

    const c = center(coords);
    this.effects.push({
      type: 'score', at: now, ttl: bonus ? 1100 : 900,
      unitX: c.q, unitY: c.r,
      text: `+${placeScore}`,
      sub: bonus ? 'BONUS ×2' : undefined,
      tone: bonus ? 'bonus' : 'place',
    });

    if (cleared) {
      for (const cell of cleared.removedCells) {
        this.effects.push({
          type: 'pop', at: now, ttl: 340,
          q: cell.q, r: cell.r, color: cell.color, bonus: cell.bonus,
        });
      }
      const cc = center(cleared.removedCells.map((x) => [x.q, x.r]));
      const lineText = lines.length > 1 ? `${lines.length} LINES!` : 'LINE!';
      this.effects.push({
        type: 'score', at: now + 120, ttl: 1100,
        unitX: cc.q, unitY: cc.r,
        text: `+${clearScore}`,
        sub: cleared.bonusHits ? `${lineText} BONUS ×2` : lineText,
        tone: cleared.bonusHits ? 'bonus' : 'clear',
      });
    }
  }

  /** 수명이 끝난 이펙트 제거 */
  pruneEffects(now = performance.now()) {
    this.effects = this.effects.filter((e) => now - e.at < e.ttl);
  }
}
