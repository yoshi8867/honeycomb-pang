// 육각 격자의 좌표계 전담 모듈.
// 내부 계산은 전부 axial 좌표 [q, r]로 하고, a1~i5 같은 이름은 표시용으로만 쓴다.
// (행마다 칸 수가 다르고 e행을 기점으로 좌우 오프셋이 뒤집히기 때문에
//  행/열 인덱스로 직접 계산하면 대각선 라인 판정이 틀어진다.)

export const BOARD_SIDE = 5;                    // 한 변 5칸
export const BOARD_RADIUS = BOARD_SIDE - 1;     // 중심에서 4칸
export const ROW_LETTERS = 'abcdefghi';         // 2*SIDE-1 = 9행

const SQRT3 = Math.sqrt(3);

export const cellKey = (q, r) => `${q},${r}`;

/** 행 r에서 q가 가질 수 있는 범위 */
export function rowRange(r) {
  return [
    Math.max(-BOARD_RADIUS, -BOARD_RADIUS - r),
    Math.min(BOARD_RADIUS, BOARD_RADIUS - r),
  ];
}

export const isOnBoard = (q, r) =>
  Math.max(Math.abs(q), Math.abs(-q - r), Math.abs(r)) <= BOARD_RADIUS;

/** a1, b3, e9 ... 표시용 이름 */
export function cellName(q, r) {
  const [qMin] = rowRange(r);
  return ROW_LETTERS[r + BOARD_RADIUS] + (q - qMin + 1);
}

/** 보드의 모든 칸. 위 행부터, 각 행은 왼쪽부터. */
export const BOARD_CELLS = (() => {
  const cells = [];
  for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++) {
    const [qMin, qMax] = rowRange(r);
    for (let q = qMin; q <= qMax; q++) {
      cells.push({ q, r, key: cellKey(q, r), name: cellName(q, r) });
    }
  }
  return cells;
})();

/**
 * 클리어 판정 대상이 되는 27개 라인.
 * axis 3종 = 가로(r 고정) / 좌상단→우하단(q 고정) / 좌하단→우상단(s=-q-r 고정)
 */
export const LINES = (() => {
  const buckets = { row: new Map(), col: new Map(), diag: new Map() };
  for (const c of BOARD_CELLS) {
    const idx = { row: c.r, col: c.q, diag: -c.q - c.r };
    for (const axis of ['row', 'col', 'diag']) {
      const i = idx[axis];
      if (!buckets[axis].has(i)) buckets[axis].set(i, []);
      buckets[axis].get(i).push(c.key);
    }
  }
  const lines = [];
  for (const axis of ['row', 'col', 'diag']) {
    for (const [index, keys] of [...buckets[axis].entries()].sort((a, b) => a[0] - b[0])) {
      lines.push({ axis, index, keys });
    }
  }
  return lines;
})();

/** 어떤 칸이 속한 라인들 (배치 후 그 칸 주변만 검사하면 되도록) */
export const LINES_BY_CELL = (() => {
  const map = new Map();
  LINES.forEach((line, i) => {
    for (const k of line.keys) {
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(i);
    }
  });
  return map;
})();

// --- 픽셀 변환 (pointy-top 육각형) -------------------------------------

export const axialToPixel = (q, r, size) => ({
  x: size * SQRT3 * (q + r / 2),
  y: size * 1.5 * r,
});

const unsign = (v) => (v === 0 ? 0 : v);   // -0 이 새어나가지 않도록

function axialRound(qf, rf) {
  let x = qf, z = rf, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return [unsign(rx), unsign(rz)];
}

export const pixelToAxial = (x, y, size) =>
  axialRound((SQRT3 / 3 * x - y / 3) / size, (2 / 3 * y) / size);

/** 중심 (cx, cy), 외접원 반지름 size인 육각형의 꼭짓점 6개 */
export function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
  }
  return pts;
}

/** 여러 칸을 감싸는 픽셀 바운딩 박스 */
export function cellsBounds(cells, size) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [q, r] of cells) {
    const { x, y } = axialToPixel(q, r, size);
    minX = Math.min(minX, x - size * SQRT3 / 2);
    maxX = Math.max(maxX, x + size * SQRT3 / 2);
    minY = Math.min(minY, y - size);
    maxY = Math.max(maxY, y + size);
  }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

/** 보드 전체 크기: 가로 (2R+1)*√3*size, 세로 (3R+2)*size */
export const boardPixelSize = (size) => ({
  w: (2 * BOARD_RADIUS + 1) * SQRT3 * size,
  h: (3 * BOARD_RADIUS + 2) * size,
});
