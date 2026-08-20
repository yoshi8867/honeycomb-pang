// 화면 크기에 맞춰 보드/트레이 배치를 계산한다.
// 후보 블록은 보드 타일의 0.5배 크기, 집어올리면 1.0배가 된다.

import { boardPixelSize } from './hex.js';

export const TRAY_SCALE = 0.5;

const PAD = 12;
const GAP = 14;

// 세로로 남는 공간을 보드 위/아래에 나누는 비율. 0.5면 정중앙,
// 조금 위로 올려두는 편이 트레이와의 간격이 자연스럽다.
const BOARD_BIAS = 0.42;

export function computeLayout(cssW, cssH) {
  // 블록 자체는 0.5배지만, 슬롯 영역은 넉넉해야 손가락으로 집기 쉽다
  const trayH = Math.max(78, Math.min(132, cssH * 0.17));
  const availW = cssW - PAD * 2;
  const availH = cssH - trayH - PAD * 2 - GAP;

  // 보드는 가로 (2R+1)*√3*size, 세로 (3R+2)*size 를 차지한다
  const probe = boardPixelSize(1);
  const hexSize = Math.max(6, Math.min(availW / probe.w, availH / probe.h));

  const board = boardPixelSize(hexSize);
  // 트레이는 화면 아래에 고정하고, 보드는 그 위 남은 공간의 한가운데에 둔다
  const trayTop = cssH - PAD - trayH;
  const boardTop = PAD + Math.max(0, (trayTop - GAP - PAD - board.h) * BOARD_BIAS);

  const slotW = availW / 3;

  return {
    w: cssW,
    h: cssH,
    hexSize,
    trayHexSize: hexSize * TRAY_SCALE,
    board: {
      w: board.w,
      h: board.h,
      top: boardTop,
      cx: cssW / 2,
      cy: boardTop + board.h / 2,
    },
    tray: {
      top: trayTop,
      h: trayH,
      slots: Array.from({ length: 3 }, (_, i) => ({
        x: PAD + slotW * i,
        y: trayTop,
        w: slotW,
        h: trayH,
        cx: PAD + slotW * i + slotW / 2,
        cy: trayTop + trayH / 2,
      })),
    },
  };
}
