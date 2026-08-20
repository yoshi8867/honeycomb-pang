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
function showStartPanel() {
  el.overlay.innerHTML = '';
  el.overlay.append(buildPanel({
    title: 'honeycomb<span>-pang</span>',
    tagline: '90초. 벌집을 채우고 라인을 터뜨려라.',
    rules: true,
    action: '시작',
  }));
  el.overlay.classList.add('show');
}

function showGameOverPanel() {
  const record = game.score >= game.highScore && game.score > 0;
  el.overlay.innerHTML = '';
  el.overlay.append(buildPanel({
    title: '시간 종료',
    scoreValue: game.score,
    record,
    action: '다시 하기',
  }));
  el.overlay.classList.add('show');
}

function buildPanel({ title, tagline, rules, scoreValue, record, action }) {
  const panel = document.createElement('div');
  panel.className = 'panel';

  const h1 = document.createElement('h1');
  h1.innerHTML = title;
  panel.append(h1);

  if (tagline) {
    const p = document.createElement('p');
    p.className = 'tagline';
    p.textContent = tagline;
    panel.append(p);
  }

  if (scoreValue !== undefined) {
    const s = document.createElement('div');
    s.className = 'final-score';
    s.textContent = scoreValue.toLocaleString();
    panel.append(s);
    if (record) {
      const r = document.createElement('p');
      r.className = 'new-record';
      r.textContent = 'NEW RECORD';
      panel.append(r);
    }
  }

  if (rules) {
    const ul = document.createElement('ul');
    ul.className = 'rules';
    for (const html of [
      '블록을 끌어다 벌집에 놓으면 <b>타일당 20점</b>',
      '한 줄이 <b>가득 차면</b> 통째로 사라지고 <b>타일당 100점</b>',
      '가로 · ↗ · ↘ 세 방향, 두 줄이 겹치면 중복으로 가산',
    ]) {
      const li = document.createElement('li');
      li.innerHTML = html;
      ul.append(li);
    }
    panel.append(ul);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = action;
  btn.addEventListener('click', startGame);
  panel.append(btn);

  const best = document.createElement('p');
  best.className = 'best';
  best.innerHTML = `최고 점수 <b>${game.highScore.toLocaleString()}</b>`;
  panel.append(best);

  return panel;
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

