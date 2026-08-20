// 포인터 드래그 앤 드롭.
// 스냅 기준은 "손가락이 집은 타일"이다. 대표 타일은 사람이 부르기 쉬우라고 정한 이름일 뿐,
// 조작에는 쓰지 않는다.

import { axialToPixel, pixelToAxial, cellsBounds, isOnBoard } from './hex.js';

const LIFT_RATIO = 2.2;   // 손가락에 가리지 않게 블록을 위로 띄우는 정도 (헥스 크기 배수)

export class DragController {
  constructor(canvas, game, renderer) {
    this.canvas = canvas;
    this.game = game;
    this.renderer = renderer;
    this.drag = null;
    this.onPlace = null;    // 배치 성공 시 콜백

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', () => this.cancel());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  localPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /** 트레이의 어느 슬롯을 눌렀는지 */
  hitSlot(x, y) {
    const { tray } = this.renderer.layout;
    if (y < tray.top - 8 || y > tray.top + tray.h + 8) return -1;
    return tray.slots.findIndex((s) => x >= s.x && x <= s.x + s.w);
  }

  /** 트레이에 그려진 블록에서 포인터와 가장 가까운 타일의 인덱스 */
  nearestTile(cand, slot, x, y) {
    const size = this.renderer.layout.trayHexSize;
    const b = cellsBounds(cand.cells, size);
    const ox = slot.cx - (b.minX + b.w / 2);
    const oy = slot.cy - (b.minY + b.h / 2);
    let best = 0;
    let bestD = Infinity;
    cand.cells.forEach(([q, r], i) => {
      const p = axialToPixel(q, r, size);
      const d = (ox + p.x - x) ** 2 + (oy + p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  onDown(e) {
    if (this.game.state !== 'playing' || this.drag) return;
    const { x, y } = this.localPoint(e);
    const slotIndex = this.hitSlot(x, y);
    if (slotIndex < 0) return;
    const cand = this.game.candidates.find((c) => c.slot === slotIndex);
    if (!cand) return;

    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* 캡처 불가여도 진행 */ }

    const slot = this.renderer.layout.tray.slots[slotIndex];
    this.drag = {
      pointerId: e.pointerId,
      candidate: cand,
      grabIndex: this.nearestTile(cand, slot, x, y),
      x, y,
      lift: this.renderer.layout.hexSize * LIFT_RATIO,
      hover: null,
    };
    this.updateHover();
  }

  onMove(e) {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    e.preventDefault();
    const { x, y } = this.localPoint(e);
    this.drag.x = x;
    this.drag.y = y;
    this.updateHover();
  }

  /** 집은 타일이 올라간 보드 칸을 기준으로 블록 전체의 착지 위치를 계산 */
  updateHover() {
    const d = this.drag;
    const { cx, cy, size } = this.renderer.boardOrigin();
    const [gq, gr] = pixelToAxial(d.x - cx, d.y - d.lift - cy, size);

    if (!isOnBoard(gq, gr)) { d.hover = null; return; }

    const [dq, dr] = d.candidate.cells[d.grabIndex];
    const aq = gq - dq;
    const ar = gr - dr;
    const coords = d.candidate.cells.map(([q, r]) => [aq + q, ar + r]);

    d.hover = {
      anchor: [aq, ar],
      coords: coords.filter(([q, r]) => isOnBoard(q, r)),
      valid: this.game.board.canPlace(d.candidate.cells, aq, ar),
    };
    if (d.hover.valid) d.hover.coords = coords;
  }

  onUp(e) {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    e.preventDefault();
    const d = this.drag;
    this.drag = null;

    if (d.hover && d.hover.valid) {
      const result = this.game.place(d.candidate, d.hover.anchor[0], d.hover.anchor[1]);
      if (result && this.onPlace) this.onPlace(result);
    }
    // 유효하지 않으면 아무것도 하지 않는다 -> 블록은 원래 슬롯에 그대로 남는다
  }

  cancel() {
    this.drag = null;
  }
}
