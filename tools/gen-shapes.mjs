// 고정 폴리헥스(fixed polyhex) 열거기.
// 회전/반사를 서로 다른 블록으로 취급한다 (게임에 회전이 없으므로).
// 결과물: js/shapes-data.js (게임용), tools/shapes.html (사람이 고르는 카탈로그)

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]; // axial 이웃 6방향

// --- 좌표 유틸 ---------------------------------------------------------
const key = ([q, r]) => `${q},${r}`;
const byRowThenCol = (a, b) => (a[1] - b[1]) || (a[0] - b[0]);

/** 평행이동 정규화: 정렬 후 첫 셀이 (0,0)이 되도록 옮긴다 */
function normalize(cells) {
  const sorted = [...cells].sort(byRowThenCol);
  const [q0, r0] = sorted[0];
  return sorted.map(([q, r]) => [q - q0, r - r0]);
}
const sig = (cells) => normalize(cells).map(key).join(' ');

// cube 변환 (x=q, y=-q-r, z=r)
const toCube = ([q, r]) => [q, -q - r, r];
const toAxial = ([x, , z]) => [x, z];
const rot60 = ([x, y, z]) => [-z, -x, -y];   // 시계 60도
const mirror = ([x, y, z]) => [x, z, y];     // 반사

/** 회전6 x 반사2 = 12가지 변환 중 사전순 최소값 -> 자유 폴리헥스(free) 식별자 */
function freeSig(cells) {
  let best = null;
  for (let m = 0; m < 2; m++) {
    let cube = cells.map(toCube).map((c) => (m ? mirror(c) : c));
    for (let k = 0; k < 6; k++) {
      const s = sig(cube.map(toAxial));
      if (best === null || s < best) best = s;
      cube = cube.map(rot60);
    }
  }
  return best;
}

// --- 열거 -------------------------------------------------------------
/** 크기 n의 고정 폴리헥스를 모두 만든다 */
function enumerateFixed(n) {
  let frontier = new Map([[sig([[0, 0]]), [[0, 0]]]]);
  for (let size = 1; size < n; size++) {
    const next = new Map();
    for (const cells of frontier.values()) {
      const occupied = new Set(cells.map(key));
      for (const [q, r] of cells) {
        for (const [dq, dr] of DIRS) {
          const cand = [q + dq, r + dr];
          if (occupied.has(key(cand))) continue;
          const grown = [...cells, cand];
          next.set(sig(grown), normalize(grown));
        }
      }
    }
    frontier = next;
  }
  return [...frontier.values()];
}

// --- 그룹핑 -----------------------------------------------------------
/** 자유 형태(family)별로 묶어서, 가족 단위로도 고를 수 있게 한다 */
function groupByFamily(shapes) {
  const families = new Map();
  for (const cells of shapes) {
    const f = freeSig(cells);
    if (!families.has(f)) families.set(f, []);
    families.get(f).push(cells);
  }
  // 방향 수가 적은 순(=대칭성 높은 순), 동률이면 사전순으로 안정 정렬
  return [...families.entries()]
    .sort((a, b) => (a[1].length - b[1].length) || (a[0] < b[0] ? -1 : 1))
    .map(([familySig, members]) => ({
      familySig,
      members: members.sort((x, y) => (sig(x) < sig(y) ? -1 : 1)),
    }));
}

// --- 실행 -------------------------------------------------------------
const SIZES = [1, 2, 3, 4];
const catalog = [];    // { size, family, id, cells }
const familyMeta = []; // { size, family, count, ids }

for (const size of SIZES) {
  const fixed = enumerateFixed(size);
  const families = groupByFamily(fixed);
  let seq = 0;
  families.forEach((fam, fi) => {
    const ids = [];
    for (const cells of fam.members) {
      const id = `h${size}-${String(++seq).padStart(2, '0')}`;
      ids.push(id);
      catalog.push({ size, family: fi + 1, id, cells: normalize(cells) });
    }
    familyMeta.push({ size, family: fi + 1, count: fam.members.length, ids });
  });
  console.log(`크기 ${size}: 고정 ${fixed.length}종 / 자유형태 ${families.length}종`);
}

// --- js/shapes-data.js 출력 ------------------------------------------
const dataLines = catalog.map(
  (s) =>
    `  { id: '${s.id}', size: ${s.size}, family: ${s.family}, cells: [${s.cells
      .map(([q, r]) => `[${q},${r}]`)
      .join(',')}] },`
);

mkdirSync(join(ROOT, 'js'), { recursive: true });
writeFileSync(
  join(ROOT, 'js', 'shapes-data.js'),
  [
    '// 자동 생성 파일 - 직접 수정하지 말 것. `node tools/gen-shapes.mjs` 로 재생성.',
    '// cells: axial 좌표 [q, r]. 첫 원소가 항상 대표 타일 (0,0) = 가장 위 행의 가장 왼쪽.',
    'export const SHAPES = [',
    dataLines.join('\n'),
    '];',
    '',
    '/** id -> 도형 조회 */',
    'export const SHAPE_BY_ID = new Map(SHAPES.map((s) => [s.id, s]));',
    '',
  ].join('\n'),
  'utf8'
);

// --- tools/shapes.html 출력 ------------------------------------------
const HEX_R = 15;

function svgFor(cells) {
  const pts = cells.map(([q, r]) => [
    HEX_R * Math.sqrt(3) * (q + r / 2),
    HEX_R * 1.5 * r,
  ]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = HEX_R + 3;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const hexes = pts
    .map(([cx, cy], i) => {
      const d = Array.from({ length: 6 }, (_, k) => {
        const a = (Math.PI / 180) * (60 * k - 90);
        return `${(cx + HEX_R * Math.cos(a)).toFixed(2)},${(cy + HEX_R * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
      return `<polygon points="${d}" class="${i === 0 ? 'anchor' : 'cell'}"/>`;
    })
    .join('');
  const vb = `${minX.toFixed(2)} ${minY.toFixed(2)} ${(maxX - minX).toFixed(2)} ${(maxY - minY).toFixed(2)}`;
  return `<svg viewBox="${vb}" width="100%" height="84" preserveAspectRatio="xMidYMid meet">${hexes}</svg>`;
}

let body = '';
for (const size of SIZES) {
  const items = catalog.filter((s) => s.size === size);
  const fams = familyMeta.filter((f) => f.size === size);
  body += `<section><h2>${size}칸 블록 &mdash; 총 ${items.length}종 <span class="hint">(형태 ${fams.length}가지)</span></h2>`;
  for (const fam of fams) {
    body += `<div class="family"><h3>형태 ${size}-${fam.family} <span class="hint">${fam.count}방향</span></h3><div class="grid">`;
    for (const id of fam.ids) {
      const s = items.find((x) => x.id === id);
      body += `<figure><div class="art">${svgFor(s.cells)}</div><figcaption>${s.id}</figcaption></figure>`;
    }
    body += '</div></div>';
  }
  body += '</section>';
}

const css = `
  :root { color-scheme: dark; --bg:#12151c; --card:#1b202b; --line:#2b3242;
          --fg:#e6e9f0; --dim:#8b93a7; --hex:#f0b429; --anchor:#e8590c; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px 64px; background:var(--bg); color:var(--fg);
         font:15px/1.6 system-ui,-apple-system,"Segoe UI","Noto Sans KR",sans-serif; }
  header, section { max-width:960px; margin-left:auto; margin-right:auto; }
  header { margin-bottom:28px; }
  h1 { font-size:22px; margin:0 0 8px; }
  header p { margin:4px 0; color:var(--dim); font-size:14px; }
  code { background:var(--card); padding:1px 5px; border-radius:4px; font-size:13px; }
  section { margin-bottom:40px; }
  h2 { font-size:17px; border-bottom:1px solid var(--line); padding-bottom:8px; margin:32px 0 4px; }
  .family { margin-top:20px; }
  h3 { font-size:14px; color:var(--dim); font-weight:600; margin:0 0 8px; }
  .hint { font-weight:400; opacity:.7; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(92px,1fr)); gap:10px; }
  figure { margin:0; background:var(--card); border:1px solid var(--line);
           border-radius:10px; padding:8px 6px 6px; text-align:center; }
  .art { display:flex; align-items:center; justify-content:center; height:84px; }
  figcaption { font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--dim); margin-top:4px; }
  polygon { stroke:var(--bg); stroke-width:2; }
  .cell { fill:var(--hex); }
  .anchor { fill:var(--anchor); }
`;

writeFileSync(
  join(ROOT, 'tools', 'shapes.html'),
  [
    '<!doctype html>',
    '<html lang="ko"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>honeycomb-pang · 블록 카탈로그</title>',
    `<style>${css}</style></head><body>`,
    '<header>',
    '  <h1>honeycomb-pang · 블록 카탈로그</h1>',
    '  <p>회전을 각각 다른 블록으로 세었을 때의 전체 목록입니다. 주황색 칸이 <b>대표 타일</b>(가장 위 행의 가장 왼쪽).</p>',
    '  <p>쓰고 싶은 것만 <code>h4-07</code> 같은 id로, 또는 <code>형태 4-3</code> 처럼 형태 단위로 알려주세요.</p>',
    '</header>',
    body,
    '</body></html>',
    '',
  ].join('\n'),
  'utf8'
);

console.log(`\n총 ${catalog.length}종 생성 -> js/shapes-data.js, tools/shapes.html`);
