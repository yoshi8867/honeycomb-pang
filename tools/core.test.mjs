// 좌표계 · 라인 판정 · 점수 계산 검증. `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_CELLS, BOARD_SIDE, LINES, ROW_LETTERS,
  cellName, cellKey, isOnBoard, rowRange, pixelToAxial, axialToPixel, boardPixelSize,
} from '../js/hex.js';
import { Board } from '../js/board.js';
import { SHAPES } from '../js/shapes-data.js';
import { placementScore, lineClearScore } from '../js/game.js';

test('한 변 5칸 육각형은 61칸, 9행', () => {
  assert.equal(BOARD_CELLS.length, 3 * BOARD_SIDE ** 2 - 3 * BOARD_SIDE + 1);
  assert.equal(BOARD_CELLS.length, 61);

  const perRow = ROW_LETTERS.split('').map(
    (L) => BOARD_CELLS.filter((c) => c.name.startsWith(L)).length
  );
  assert.deepEqual(perRow, [5, 6, 7, 8, 9, 8, 7, 6, 5]);
});

test('칸 이름은 a1..a5 / e1..e9 / i1..i5 로 유일하게 매겨진다', () => {
  const names = BOARD_CELLS.map((c) => c.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes('a1') && names.includes('a5'));
  assert.ok(names.includes('e9') && names.includes('i5'));
  assert.ok(!names.includes('a6'), 'a행은 5칸까지만');

  // 이름 -> 좌표 -> 이름 왕복
  for (const c of BOARD_CELLS) assert.equal(cellName(c.q, c.r), c.name);
});

test('라인은 3방향 × 9개 = 27개, 길이는 5~9', () => {
  assert.equal(LINES.length, 27);
  for (const axis of ['row', 'col', 'diag']) {
    const lens = LINES.filter((l) => l.axis === axis).map((l) => l.keys.length);
    assert.deepEqual(lens, [5, 6, 7, 8, 9, 8, 7, 6, 5], `${axis} 방향 길이`);
  }
  // 모든 칸은 정확히 3개 라인에 속한다
  const count = new Map();
  for (const l of LINES) for (const k of l.keys) count.set(k, (count.get(k) || 0) + 1);
  assert.equal(count.size, 61);
  assert.ok([...count.values()].every((v) => v === 3));
});

test('픽셀 <-> 좌표 왕복이 모든 칸에서 일치', () => {
  const size = 24;
  for (const c of BOARD_CELLS) {
    const p = axialToPixel(c.q, c.r, size);
    assert.deepEqual(pixelToAxial(p.x, p.y, size), [c.q, c.r], c.name);
    // 중심에서 조금 벗어나도 같은 칸으로 떨어져야 한다
    assert.deepEqual(pixelToAxial(p.x + size * 0.3, p.y - size * 0.3, size), [c.q, c.r], c.name);
  }
});

test('보드 픽셀 크기는 가로 9헥스, 세로 14헥스분', () => {
  const b = boardPixelSize(10);
  assert.equal(Math.round(b.w), Math.round(9 * Math.sqrt(3) * 10));
  assert.equal(b.h, 140);
});

test('블록은 크기별로 1 / 3 / 11 / 44종', () => {
  for (const [size, expected] of [[1, 1], [2, 3], [3, 11], [4, 44]]) {
    assert.equal(SHAPES.filter((s) => s.size === size).length, expected, `${size}칸`);
  }
  // 대표 타일은 항상 첫 원소이고 (0,0)
  for (const s of SHAPES) {
    assert.deepEqual(s.cells[0], [0, 0], s.id);
    assert.equal(s.cells.length, s.size, s.id);
  }
  // 모든 블록은 빈 보드 어딘가에 놓을 수 있어야 한다
  const empty = new Board();
  for (const s of SHAPES) assert.ok(empty.hasAnyPlacement(s.cells), `${s.id} 배치 불가`);
});

test('보드 밖 / 이미 찬 칸에는 놓을 수 없다', () => {
  const b = new Board();
  const domino = SHAPES.find((s) => s.size === 2).cells;

  assert.ok(!isOnBoard(5, 0), '반지름 밖');
  const [qMin] = rowRange(-4);
  assert.ok(!b.canPlace(domino, qMin - 1, -4), '왼쪽 밖으로 삐져나감');

  b.fill([[0, 0]], '#fff');
  assert.ok(!b.canPlace([[0, 0]], 0, 0), '이미 찬 칸');
  assert.ok(b.canPlace([[0, 0]], 1, 0), '옆 빈 칸');
});

test('라인은 가득 차야만 사라진다', () => {
  const b = new Board();
  const rowA = LINES.find((l) => l.axis === 'row' && l.keys.length === 5);

  // 4칸만 채우면 클리어 없음
  const partial = rowA.keys.slice(0, 4).map((k) => k.split(',').map(Number));
  b.fill(partial, '#fff');
  assert.equal(b.findCompletedLines(partial).length, 0);

  // 마지막 한 칸을 채우면 클리어
  const last = [rowA.keys[4].split(',').map(Number)];
  b.fill(last, '#fff');
  const done = b.findCompletedLines(last);
  assert.equal(done.length, 1);
  assert.equal(b.clearLines(done).tileHits, 5);
  assert.equal(b.filled.size, 0);
});

test('두 라인이 동시에 완성되면 겹친 칸도 중복 가산', () => {
  const b = new Board();
  const row = LINES.find((l) => l.axis === 'row' && l.keys.length === 5);
  const shared = row.keys[0];
  const col = LINES.find((l) => l.axis === 'col' && l.keys.includes(shared));

  const all = [...new Set([...row.keys, ...col.keys])];
  const last = shared;
  for (const k of all) {
    if (k !== last) b.fill([k.split(',').map(Number)], '#fff');
  }
  const lastCoord = [last.split(',').map(Number)];
  b.fill(lastCoord, '#fff');

  const done = b.findCompletedLines(lastCoord);
  assert.equal(done.length, 2, '두 라인 동시 완성');

  const res = b.clearLines(done);
  // 점수는 길이 합(중복 포함), 삭제는 합집합 한 번만
  assert.equal(res.tileHits, row.keys.length + col.keys.length);
  assert.equal(res.removedKeys.length, all.length);
  assert.equal(res.tileHits, res.removedKeys.length + 1, '겹친 1칸이 두 번 계산됨');
  assert.equal(b.filled.size, 0);
});

test('보너스 블록은 착수 점수가 2배', () => {
  assert.equal(placementScore(1, false), 20);
  assert.equal(placementScore(1, true), 40);
  assert.equal(placementScore(3, false), 60);
  assert.equal(placementScore(3, true), 120);
  assert.equal(placementScore(4, true), 160);
});

test('보너스 타일이 낀 라인은 그 타일만큼 100점씩 더 준다', () => {
  const b = new Board();
  const row = LINES.find((l) => l.axis === 'row' && l.keys.length === 5);
  const coords = row.keys.map((k) => k.split(',').map(Number));

  // 5칸 중 1칸만 보너스
  b.fill(coords.slice(0, 4), '#fff', false);
  b.fill(coords.slice(4), '#ffc93c', true);

  const res = b.clearLines(b.findCompletedLines(coords));
  assert.equal(res.tileHits, 5);
  assert.equal(res.bonusHits, 1);
  assert.equal(res.scoreUnits, 6, '보너스 타일 1개가 한 번 더 계산됨');
  assert.equal(lineClearScore(res.scoreUnits), 600, '기본 500 + 보너스 100');
});

test('보너스 타일이 두 라인에 걸치면 라인마다 각각 2배', () => {
  const b = new Board();
  const row = LINES.find((l) => l.axis === 'row' && l.keys.length === 5);
  const shared = row.keys[0];
  const col = LINES.find((l) => l.axis === 'col' && l.keys.includes(shared));

  const all = [...new Set([...row.keys, ...col.keys])];
  for (const k of all) {
    const coord = [k.split(',').map(Number)];
    b.fill(coord, k === shared ? '#ffc93c' : '#fff', k === shared);
  }

  const done = b.findCompletedLines([shared.split(',').map(Number)]);
  assert.equal(done.length, 2);

  const res = b.clearLines(done);
  assert.equal(res.tileHits, row.keys.length + col.keys.length);
  assert.equal(res.bonusHits, 2, '겹친 보너스 타일이 라인마다 한 번씩');
  assert.equal(res.scoreUnits, res.tileHits + 2);
});

test('보너스가 없으면 점수 계산이 이전과 동일', () => {
  const b = new Board();
  const row = LINES.find((l) => l.axis === 'row' && l.keys.length === 7);
  const coords = row.keys.map((k) => k.split(',').map(Number));
  b.fill(coords, '#fff');

  const res = b.clearLines(b.findCompletedLines(coords));
  assert.equal(res.bonusHits, 0);
  assert.equal(res.scoreUnits, res.tileHits);
  assert.equal(lineClearScore(res.scoreUnits), 700);
});

test('클리어는 놓은 블록과 무관한 칸도 함께 지운다', () => {
  const b = new Board();
  const row = LINES.find((l) => l.axis === 'row' && l.keys.length === 5);
  const other = BOARD_CELLS.find((c) => !row.keys.includes(c.key));

  b.fill([[other.q, other.r]], '#fff');
  const coords = row.keys.map((k) => k.split(',').map(Number));
  b.fill(coords, '#fff');

  const done = b.findCompletedLines(coords);
  b.clearLines(done);
  assert.equal(b.filled.size, 1);
  assert.ok(b.filled.has(cellKey(other.q, other.r)));
});
