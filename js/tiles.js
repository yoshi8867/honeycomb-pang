// 타일 한 개를 그리는 방법만 모아둔 모듈.
// 보드든 트레이든 이펙트든 전부 여기를 거치므로, 여기만 바꾸면 전부 바뀐다.
// tools/bonus-styles.html 도 이 파일을 그대로 import 해서 미리보기를 그린다.

import { hexCorners } from './hex.js';

export function hexPath(ctx, cx, cy, size) {
  const pts = hexCorners(cx, cy, size);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** 일반 타일: 단색 + 위쪽 하이라이트로 입체감 */
export function drawPlainTile(ctx, cx, cy, size, color, alpha = 1, scale = 1) {
  const s = size * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  hexPath(ctx, cx, cy, s * 0.94);
  ctx.fillStyle = color;
  ctx.fill();
  const g = ctx.createLinearGradient(cx, cy - s, cx, cy + s);
  g.addColorStop(0, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,12,18,0.55)';
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.stroke();
  ctx.restore();
}

// --- 보너스 타일 디자인 후보 -------------------------------------------
// 공통 언어: 두꺼운 흰 테두리 + ×2 표기. 차이는 색과 글자색뿐이다.
//   fill       위→아래 그라디언트 색 (1개면 단색)
//   ink        ×2 글자색
//   inkStroke  글자 외곽선 (밝은 바탕에서 흰 글자를 읽히게 할 때만)
//   diag       그라디언트를 대각선 방향으로
//   span       그라디언트 범위 (기본 1. 색이 3개 이상이면 줄여야 끝 색이 안 잘린다)
//   popup      점수 팝업 글자색 (타일 색과 어울리도록 스타일마다 따로)

export const BONUS_STYLES = [
  {
    id: 'gold', name: '골드',
    note: '벌집 테마에 가장 잘 맞는다. 일반 팔레트에 노랑이 없어 겹치지 않음.',
    fill: ['#ffd85e', '#f0a500'], ink: '#5a3600',
    popup: '#ffd85e',
  },
  {
    id: 'obsidian', name: '옵시디언',
    note: '보드에서 유일하게 어두운 타일이라 대비가 가장 강하다.',
    fill: ['#39414f', '#151922'], ink: '#ffffff',
    popup: '#c9d3e6',
  },
  {
    id: 'crimson', name: '크림슨',
    note: '강렬하지만 팔레트의 빨강·주황과 계열이 겹친다.',
    fill: ['#ff5a5f', '#c2183c'], ink: '#ffffff',
    popup: '#ff8a8f',
  },
  {
    id: 'violet', name: '바이올렛',
    note: '차분한 편. 팔레트의 보라와 다소 겹친다.',
    fill: ['#b57bff', '#6d28d9'], ink: '#ffffff',
    popup: '#c9a4ff',
  },
  {
    id: 'aqua', name: '아쿠아',
    note: '밝아서 눈에 잘 띈다. 팔레트의 청록과 계열이 겹친다.',
    fill: ['#7ff0ff', '#0891b2'], ink: '#04323d',
    popup: '#7ff0ff',
  },
  {
    id: 'magenta', name: '마젠타',
    note: '채도가 높아 시선을 끈다. 팔레트의 핑크와 겹친다.',
    fill: ['#ff7ad0', '#c2185b'], ink: '#ffffff',
    popup: '#ff9ad9',
  },
  {
    id: 'rainbow', name: '레인보우',
    note: '어떤 색과도 겹치지 않는다. 다만 조금 시끄러울 수 있다.',
    fill: ['#ff5f6d', '#ffc371', '#47e6b1', '#5b8cff'], diag: true, span: 0.58,
    ink: '#ffffff', inkStroke: 'rgba(20,16,40,0.75)',
    popup: '#ffd9a0',
  },
  {
    id: 'sunset', name: '선셋',
    note: '따뜻한 그라디언트. 골드보다 화려하다.',
    fill: ['#ffb03c', '#ff3c78'], diag: true,
    ink: '#ffffff', inkStroke: 'rgba(80,10,40,0.6)',
    popup: '#ffb06b',
  },
  {
    id: 'ink', name: '잉크블루',
    note: '어둡고 차분하다. 옵시디언보다는 색이 있다.',
    fill: ['#3f6fe0', '#16277a'], ink: '#ffffff',
    popup: '#8fb0ff',
  },
  {
    id: 'lime', name: '형광 라임',
    note: '가장 밝다. 팔레트의 라임·초록과 겹치는 게 부담.',
    fill: ['#e8ff5a', '#8bc400'], ink: '#2a3d00',
    popup: '#dcff7a',
  },
];

export const BONUS_STYLE_BY_ID = new Map(BONUS_STYLES.map((s) => [s.id, s]));

/** 실제로 쓸 디자인. tools/bonus-styles.html 에서 고른 id를 여기 넣는다. */
export const ACTIVE_BONUS_STYLE = 'gold';

export const activeBonusStyle = () => BONUS_STYLE_BY_ID.get(ACTIVE_BONUS_STYLE);

/**
 * 두꺼운 흰 테두리와 ×2 사이의 좁은 띠만 실제로 보이기 때문에,
 * 색이 여러 개인 스타일은 span을 줄여 그 띠 안에 모든 색이 들어오게 한다.
 */
function bonusFill(ctx, cx, cy, s, style) {
  const cols = style.fill;
  if (cols.length === 1) return cols[0];
  const k = s * (style.span ?? 1);
  const g = style.diag
    ? ctx.createLinearGradient(cx - k, cy - k, cx + k, cy + k)
    : ctx.createLinearGradient(cx, cy - k, cx, cy + k);
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
  return g;
}

/**
 * 보너스 타일: 두꺼운 흰 테두리 + 가운데 ×2.
 * 테두리는 육각형 안쪽에 들어오도록 반지름을 줄여서 그린다.
 */
export function drawBonusTile(ctx, cx, cy, size, alpha = 1, scale = 1, style) {
  const st = style || BONUS_STYLE_BY_ID.get(ACTIVE_BONUS_STYLE);
  const s = size * scale;
  const R = s * 0.94;
  const lw = s * 0.2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';

  hexPath(ctx, cx, cy, R);
  ctx.fillStyle = bonusFill(ctx, cx, cy, s, st);
  ctx.fill();

  hexPath(ctx, cx, cy, R - lw / 2);
  ctx.strokeStyle = st.ring || '#ffffff';
  ctx.lineWidth = lw;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${(s * 0.58).toFixed(1)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const ty = cy + s * 0.03;
  if (st.inkStroke) {
    ctx.lineWidth = s * 0.13;
    ctx.strokeStyle = st.inkStroke;
    ctx.strokeText('×2', cx, ty);
  }
  ctx.fillStyle = st.ink;
  ctx.fillText('×2', cx, ty);

  ctx.restore();
}

/** 보드·트레이 공용 진입점 */
export function drawTile(ctx, cx, cy, size, color, alpha = 1, scale = 1, bonus = false) {
  if (bonus) drawBonusTile(ctx, cx, cy, size, alpha, scale);
  else drawPlainTile(ctx, cx, cy, size, color, alpha, scale);
}
