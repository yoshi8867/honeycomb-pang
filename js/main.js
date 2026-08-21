// 엔트리 포인트: DOM 배선 + 게임 루프.

import { Game, RULES } from './game.js';
import { Renderer } from './render.js';
import { DragController } from './input.js';
import { computeLayout } from './layout.js';

const $ = (id) => document.getElementById(id);

const el = {
  app: $('app'),
  stage: $('stage'),
  canvas: $('game'),
  score: $('score'),
  time: $('time'),
  timerFill: $('timer-fill'),
  best: $('best'),
  overlay: $('overlay'),
  btnStart: $('btn-start'),
  btnRefresh: $('btn-refresh'),
  btnLabels: $('btn-labels'),
};

// 저장 키는 옛 이름 그대로 (game.js의 HIGH_SCORE_KEY와 같은 이유)
const LABELS_KEY = 'honeycomb-pang.showLabels';

const game = new Game();
const renderer = new Renderer(el.canvas);
const drag = new DragController(el.canvas, game, renderer);

renderer.showLabels = localStorage.getItem(LABELS_KEY) === '1';
el.btnLabels.setAttribute('aria-pressed', String(renderer.showLabels));
el.best.textContent = game.highScore.toLocaleString();

// --- 크기 조정 -------------------------------------------------------
function resize() {
  const w = el.stage.clientWidth;
  const h = el.stage.clientHeight;
  if (!w || !h) return;
  renderer.resize(computeLayout(w, h), Math.min(window.devicePixelRatio || 1, 3));
}

new ResizeObserver(resize).observe(el.stage);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
resize();

// --- 오버레이 --------------------------------------------------------
// 시작 화면은 index.html에 그대로 들어있다 (JS 로딩 전에도 바로 보이도록).
// 여기서는 게임오버 화면만 만든다 — 게임 이름과 규칙 문구가 두 군데로 갈라지지 않게.
function showGameOverPanel() {
  const record = game.score >= game.highScore && game.score > 0;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const h1 = document.createElement('h1');
  h1.textContent = '시간 종료';
  panel.append(h1);

  const score = document.createElement('div');
  score.className = 'final-score';
  score.textContent = game.score.toLocaleString();
  panel.append(score);

  if (record) {
    const r = document.createElement('p');
    r.className = 'new-record';
    r.textContent = 'NEW RECORD';
    panel.append(r);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = '다시 하기';
  btn.addEventListener('click', startGame);
  panel.append(btn);

  const best = document.createElement('p');
  best.className = 'best';
  best.innerHTML = `최고 점수 <b>${game.highScore.toLocaleString()}</b>`;
  panel.append(best);

  el.overlay.replaceChildren(panel);
  el.overlay.classList.add('show');
}

function startGame() {
  game.start();
  el.overlay.classList.remove('show');
  el.btnRefresh.disabled = false;
  resize();
}

el.btnStart.addEventListener('click', startGame);

el.btnRefresh.addEventListener('click', () => {
  if (game.refresh()) {
    el.btnRefresh.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }],
      { duration: 160 }
    );
  }
});

el.btnLabels.addEventListener('click', () => {
  renderer.showLabels = !renderer.showLabels;
  el.btnLabels.setAttribute('aria-pressed', String(renderer.showLabels));
  localStorage.setItem(LABELS_KEY, renderer.showLabels ? '1' : '0');
});

// --- 루프 ------------------------------------------------------------
let wasPlaying = false;

function frame(now) {
  game.tick(now);
  game.pruneEffects(now);

  if (renderer.layout) renderer.draw(game, drag.drag);

  el.score.textContent = game.score.toLocaleString();

  const remaining = game.remainingMs(now);
  el.time.textContent = (remaining / 1000).toFixed(1);
  el.timerFill.style.transform = `scaleX(${remaining / RULES.durationMs})`;
  el.app.classList.toggle('hurry', game.state === 'playing' && remaining <= 10_000);

  if (wasPlaying && game.state === 'over') {
    el.btnRefresh.disabled = true;
    el.best.textContent = game.highScore.toLocaleString();
    showGameOverPanel();
  }
  wasPlaying = game.state === 'playing';

  requestAnimationFrame(frame);
}

el.btnRefresh.disabled = true;
requestAnimationFrame(frame);

// 브라우저 콘솔 / 자동 테스트에서 상태를 들여다보기 위한 핸들
window.__hp = { game, renderer, drag, startGame };

