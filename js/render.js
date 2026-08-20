// 캔버스 렌더링 전담. 게임 상태를 읽기만 하고 바꾸지 않는다.

import { BOARD_CELLS, axialToPixel, hexCorners, cellsBounds, cellKey } from './hex.js';

const EMPTY_FILL = '#1c2130';
const EMPTY_STROKE = '#2b3244';
const LABEL_COLOR = 'rgba(226,232,244,0.30)';
const GHOST_OK = 'rgba(255,255,255,0.16)';
const GHOST_BAD = 'rgba(233,84,84,0.28)';

function hexPath(ctx, cx, cy, size) {
  const pts = hexCorners(cx, cy, size);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function drawHex(ctx, cx, cy, size, { fill, stroke, lineWidth = 1.5, alpha = 1 }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  hexPath(ctx, cx, cy, size * 0.94);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  ctx.restore();
}

/** 채워진 타일: 살짝 밝은 위쪽 하이라이트를 얹어 입체감을 준다 */
function drawTile(ctx, cx, cy, size, color, alpha = 1, scale = 1) {
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

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layout = null;
    this.showLabels = false;
  }

  resize(layout, dpr) {
    this.layout = layout;
    this.canvas.width = Math.round(layout.w * dpr);
    this.canvas.height = Math.round(layout.h * dpr);
    this.canvas.style.width = `${layout.w}px`;
    this.canvas.style.height = `${layout.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 보드 좌표 -> 캔버스 픽셀 */
  boardPoint(q, r) {
    const { board, hexSize } = this.layout;
    const p = axialToPixel(q, r, hexSize);
    return { x: board.cx + p.x, y: board.cy + p.y };
  }

  /** 캔버스 픽셀 -> 보드 좌표 (input.js에서 씀) */
  boardOrigin() {
    return { cx: this.layout.board.cx, cy: this.layout.board.cy, size: this.layout.hexSize };
  }

  draw(game, drag) {
    const { ctx, layout } = this;
    ctx.clearRect(0, 0, layout.w, layout.h);
    this.drawBoard(game, drag);
    this.drawGhost(game, drag);
    this.drawTray(game, drag);
    this.drawEffects(game);
    this.drawDragged(drag);
  }

  drawBoard(game, drag) {
    const { ctx, layout } = this;
    const size = layout.hexSize;
    const popping = new Set(
      game.effects.filter((e) => e.type === 'pop').map((e) => cellKey(e.q, e.r))
    );

    for (const cell of BOARD_CELLS) {
      const { x, y } = this.boardPoint(cell.q, cell.r);
      const tile = game.board.filled.get(cell.key);
      if (tile && !popping.has(cell.key)) {
        drawTile(ctx, x, y, size, tile.color);
      } else {
        drawHex(ctx, x, y, size, { fill: EMPTY_FILL, stroke: EMPTY_STROKE });
      }
      if (this.showLabels && !tile) {
        ctx.save();
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = `${Math.max(7, size * 0.38).toFixed(1)}px ui-monospace, Menlo, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cell.name, x, y);
        ctx.restore();
      }
    }
  }

  /** 드래그 중 스냅될 자리를 보드 위에 미리 보여준다 */
  drawGhost(game, drag) {
    if (!drag || !drag.hover) return;
    const { ctx, layout } = this;
    const size = layout.hexSize;
    for (const [q, r] of drag.hover.coords) {
      const { x, y } = this.boardPoint(q, r);
      drawHex(ctx, x, y, size, {
        fill: drag.hover.valid ? GHOST_OK : GHOST_BAD,
        stroke: drag.hover.valid ? 'rgba(255,255,255,0.5)' : 'rgba(233,84,84,0.7)',
        lineWidth: 2,
      });
    }
  }

  drawTray(game, drag) {
    const { ctx, layout } = this;
    for (const cand of game.candidates) {
      const slot = layout.tray.slots[cand.slot];
      if (drag && drag.candidate.uid === cand.uid) {
        this.drawBlock(cand.cells, slot.cx, slot.cy, layout.trayHexSize, cand.color, 0.15);
        continue;
      }
      this.drawBlock(cand.cells, slot.cx, slot.cy, layout.trayHexSize, cand.color, 1);
    }
  }

  /** 블록 하나를 (cx, cy) 중심에 그린다 */
  drawBlock(cells, cx, cy, size, color, alpha = 1) {
    const b = cellsBounds(cells, size);
    const ox = cx - (b.minX + b.w / 2);
    const oy = cy - (b.minY + b.h / 2);
    for (const [q, r] of cells) {
      const p = axialToPixel(q, r, size);
      drawTile(this.ctx, ox + p.x, oy + p.y, size, color, alpha);
    }
  }

  /** 손가락을 따라다니는 블록 (유효한 자리에 스냅되면 그쪽에 그린다) */
  drawDragged(drag) {
    if (!drag) return;
    const { layout } = this;
    const size = layout.hexSize;
    if (drag.hover && drag.hover.valid) {
      for (const [q, r] of drag.hover.coords) {
        const { x, y } = this.boardPoint(q, r);
        drawTile(this.ctx, x, y, size, drag.candidate.color, 0.95);
      }
      return;
    }
    const { cells, color } = { cells: drag.candidate.cells, color: drag.candidate.color };
    const anchor = axialToPixel(cells[drag.grabIndex][0], cells[drag.grabIndex][1], size);
    for (const [q, r] of cells) {
      const p = axialToPixel(q, r, size);
      drawTile(
        this.ctx,
        drag.x - anchor.x + p.x,
        drag.y - drag.lift - anchor.y + p.y,
        size, color, 0.72
      );
    }
  }

  drawEffects(game) {
    const { ctx, layout } = this;
    const now = performance.now();
    const size = layout.hexSize;

    for (const e of game.effects) {
      const t = (now - e.at) / e.ttl;
      if (t < 0 || t > 1) continue;

      if (e.type === 'pop') {
        const { x, y } = this.boardPoint(e.q, e.r);
        drawTile(ctx, x, y, size, e.color, 1 - t, 1 + t * 0.45);
      } else if (e.type === 'score') {
        const x = layout.board.cx + e.unitX * size;
        const y = layout.board.cy + e.unitY * size - t * size * 2.4;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (1 - t) * 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(8,10,16,0.85)';
        const big = e.tone === 'clear';
        ctx.font = `800 ${(size * (big ? 1.05 : 0.72)).toFixed(1)}px system-ui, sans-serif`;
        ctx.lineWidth = size * 0.22;
        ctx.strokeText(e.text, x, y);
        ctx.fillStyle = big ? '#ffd766' : '#e8edf7';
        ctx.fillText(e.text, x, y);
        if (e.sub) {
          ctx.font = `800 ${(size * 0.5).toFixed(1)}px system-ui, sans-serif`;
          ctx.lineWidth = size * 0.16;
          ctx.strokeText(e.sub, x, y + size * 0.95);
          ctx.fillStyle = '#ff9f45';
          ctx.fillText(e.sub, x, y + size * 0.95);
        }
        ctx.restore();
      }
    }
  }
}
