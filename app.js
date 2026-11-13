import { Elm, PIDS, SerialTransport, BleTransport, DemoTransport } from './obd.js';
import { describe } from './dtc.js';

const $ = s => document.querySelector(s);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const GAUGES = { '0C': 6000, '0D': null, '05': 105 }; // PID -> início da faixa vermelha
const MAX_LOG = 200000; // ponytail: log em memória; gravar em IndexedDB se sessões longas importarem

let elm = null, running = false, supported = [];
const hist = {}, last = {}, log = [], hover = {};
const charted = new Set(Object.keys(GAUGES));

const status = s => { $('#status').textContent = s; };
const DP = { V: 2, 'g/s': 1, 'L/h': 1 };
const fmt = (pid, v) => typeof v === 'string' ? v : v.toFixed(DP[PIDS[pid].unit] ?? 0);

// ---- Conexão ----
const TRANSPORTS = { bUsb: SerialTransport, bBle: BleTransport, bDemo: DemoTransport };
if (!('serial' in navigator)) Object.assign($('#bUsb'), { disabled: true, title: 'Navegador sem Web Serial (use Chrome/Edge no computador)' });
if (!navigator.bluetooth) Object.assign($('#bBle'), { disabled: true, title: 'Navegador sem Web Bluetooth (use Chrome/Edge)' });

for (const id of Object.keys(TRANSPORTS)) $('#' + id).onclick = () => connect(new TRANSPORTS[id]());

async function connect(t) {
  setConnected(true);
  try {
    status('Conectando…');
    await t.open();
    elm = new Elm(t);
    status('Inicializando ELM327 e procurando protocolo (K-line pode levar até 15 s)…');
    const info = await elm.init($('#proto').value);
    supported = info.supported;
    status(`${info.version} · ${info.protocol} · bateria ${info.voltage} · ${supported.length} sensores`);
    buildTiles();
    navigator.wakeLock?.request('screen').catch(() => {});
    running = true;
    loop();
  } catch (e) {
    status('Erro: ' + e.message);
    await t.close().catch(() => {});
    elm = null;
    setConnected(false);
  }
}

$('#bOff').onclick = async () => {
  running = false;
  await elm?.t.close().catch(() => {});
  elm = null;
  setConnected(false);
  status('Desconectado.');
};

function setConnected(on) {
  for (const id of Object.keys(TRANSPORTS)) $('#' + id).disabled = on || (id !== 'bDemo' && $('#' + id).title.startsWith('Navegador'));
  $('#bOff').disabled = !on;
  $('#bRead').disabled = $('#bClear').disabled = !on;
}

// Mostradores e gráficos a cada ciclo; os demais sensores em rodízio, um por ciclo (K-line é lenta).
async function loop() {
  let i = 0;
  while (running) {
    const fast = supported.filter(p => charted.has(p) || p in GAUGES);
    const slow = supported.filter(p => !fast.includes(p));
    for (const p of slow.length ? [...fast, slow[i++ % slow.length]] : fast) {
      if (!running) return;
      const v = await elm.read(p);
      if (v != null) record(p, v);
    }
    render();
    await new Promise(r => setTimeout(r, 50));
  }
}

function record(pid, v) {
  last[pid] = v;
  if (typeof v === 'number') (hist[pid] ??= []).push([Date.now(), v]);
  if (hist[pid]?.length > 3000) hist[pid].shift();
  log.push([new Date().toISOString(), pid, PIDS[pid].name, v]);
  if (log.length > MAX_LOG) log.shift();
}

// ---- Painel ----
function buildTiles() {
  $('#tiles').replaceChildren(...supported.map(pid => {
    const b = document.createElement('button');
    b.className = 'tile' + (charted.has(pid) ? ' on' : '');
    b.id = 't' + pid;
    b.innerHTML = `<small>${PIDS[pid].name}</small><b>—</b><span>${PIDS[pid].unit}</span>`;
    b.onclick = () => {
      if (PIDS[pid].text) return;
      charted.has(pid) ? charted.delete(pid) : charted.add(pid);
      b.classList.toggle('on');
      renderCharts();
    };
    return b;
  }));
  renderCharts();
}

function render() {
  for (const [pid, red] of Object.entries(GAUGES)) gauge($('#g' + pid), pid, last[pid], red);
  for (const pid of supported) if (pid in last) $('#t' + pid + ' b').textContent = fmt(pid, last[pid]);
  if (!$('#graficos').hidden) for (const pid of charted) chart(pid);
}

function fit(cv) {
  const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1;
  if (cv.width !== Math.round(r.width * d)) { cv.width = r.width * d; cv.height = r.height * d; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  return { ctx, w: r.width, h: r.height };
}

function gauge(cv, pid, v, red) {
  const { ctx, w, h } = fit(cv), p = PIDS[pid];
  const cx = w / 2, cy = h * 0.56, r = Math.min(w / 2, h * 0.56) * 0.8;
  const a0 = 0.75 * Math.PI, span = 1.5 * Math.PI;
  const frac = x => Math.max(0, Math.min(1, (x - p.min) / (p.max - p.min)));
  const arc = (f0, f1, color, width) => {
    ctx.beginPath(); ctx.arc(cx, cy, r, a0 + span * f0, a0 + span * f1);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
  };
  arc(0, 1, css('--line'), 10);
  if (red) arc(frac(red), 1, css('--critical'), 4);
  const hot = red && v >= red;
  if (v != null) arc(0, Math.max(frac(v), 0.001), hot ? css('--critical') : css('--series'), 10);

  ctx.fillStyle = css('--muted'); ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const a = a0 + span * i / 4, val = p.min + (p.max - p.min) * i / 4;
    ctx.fillText(pid === '0C' ? val / 1000 + 'k' : Math.round(val), cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22));
  }
  ctx.fillStyle = css('--text'); ctx.font = `600 ${Math.round(r * 0.42)}px ui-monospace, Consolas, monospace`;
  ctx.fillText(v == null ? '—' : Math.round(v), cx, cy);
  ctx.fillStyle = css('--text2'); ctx.font = '13px system-ui';
  ctx.fillText(p.unit, cx, cy + r * 0.38);
  ctx.fillText(p.name + (hot ? ' ⚠' : ''), cx, cy + r * 0.85);
}

// ---- Gráficos ----
function renderCharts() {
  const list = supported.filter(p => charted.has(p));
  $('#charts').replaceChildren(...list.map(pid => {
    const d = document.createElement('div');
    d.className = 'chart';
    d.innerHTML = `<h3>${PIDS[pid].name} <span class="hint">(${PIDS[pid].unit})</span></h3><canvas id="c${pid}" role="img" aria-label="Gráfico de ${PIDS[pid].name}"></canvas>`;
    const cv = d.querySelector('canvas');
    cv.onpointermove = e => { hover[pid] = e.offsetX; chart(pid); };
    cv.onpointerleave = () => { delete hover[pid]; chart(pid); };
    return d;
  }));
  if (!list.length) $('#charts').innerHTML = '<p class="hint">Nenhum sensor selecionado. Toque nos mostradores do Painel para adicionar.</p>';
  if (!$('#graficos').hidden) list.forEach(chart);
}

function chart(pid) {
  const cv = $('#c' + pid);
  if (!cv) return;
  const { ctx, w, h } = fit(cv);
  const now = Date.now(), win = +$('#win').value * 1000;
  const pts = (hist[pid] ?? []).filter(([t]) => t >= now - win);
  const L = 44, R = 8, T = 8, B = 20, pw = w - L - R, ph = h - T - B;
  let lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1]));
  if (!pts.length) { lo = PIDS[pid].min; hi = PIDS[pid].max; }
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const X = t => L + pw * (1 - (now - t) / win), Y = v => T + ph * (1 - (v - lo) / (hi - lo));

  ctx.font = '11px system-ui'; ctx.textBaseline = 'middle';
  for (let i = 0; i <= 3; i++) {
    const v = lo + (hi - lo) * i / 3, y = Y(v);
    ctx.strokeStyle = css('--line'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke();
    ctx.fillStyle = css('--muted'); ctx.textAlign = 'right';
    ctx.fillText(fmt(pid, v), L - 6, y);
  }
  ctx.textAlign = 'left'; ctx.fillText(`-${win / 1000}s`, L, h - 8);
  ctx.textAlign = 'right'; ctx.fillText('agora', w - R, h - 8);
  if (!pts.length) return;

  ctx.strokeStyle = css('--series'); ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([t, v], i) => i ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v)));
  ctx.stroke();

  // Crosshair + tooltip no ponto mais próximo do cursor (ou o último, sem hover)
  const hx = hover[pid];
  const [t, v] = hx == null ? pts.at(-1) : pts.reduce((a, b) => Math.abs(X(b[0]) - hx) < Math.abs(X(a[0]) - hx) ? b : a);
  const x = X(t), y = Y(v);
  if (hx != null) {
    ctx.strokeStyle = css('--muted'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke();
  }
  ctx.fillStyle = css('--series'); ctx.strokeStyle = css('--panel'); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); ctx.stroke();
  const label = `${fmt(pid, v)} ${PIDS[pid].unit}` + (hx == null ? '' : ` · ${new Date(t).toLocaleTimeString('pt-BR')}`);
  ctx.font = '600 12px system-ui';
  const tw = ctx.measureText(label).width + 12, bx = Math.min(Math.max(x - tw / 2, L), w - R - tw), by = y > T + 30 ? y - 28 : y + 10;
  ctx.fillStyle = css('--bg'); ctx.strokeStyle = css('--line'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(bx, by, tw, 20, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = css('--text'); ctx.textAlign = 'left';
  ctx.fillText(label, bx + 6, by + 10);
}

$('#win').onchange = () => charted.forEach(chart);

$('#bCsv').onclick = () => {
  const csv = 'data_hora;pid;sensor;valor\n' + log.map(r => r.join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); // BOM: Excel pt-BR abre acentuado
  a.download = `obd-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
  a.click();
};

// ---- Códigos de erro ----
const KINDS = [['03', 'stored', 'Armazenado'], ['07', 'pending', 'Pendente'], ['0A', 'permanent', 'Permanente']];

$('#bRead').onclick = async () => {
  $('#dtcOut').textContent = 'Lendo…';
  const rows = [];
  for (const [mode, cls, label] of KINDS)
    for (const code of await elm.dtcs(mode)) rows.push(`<tr><td class="code">${code}</td><td>${describe(code)}</td><td><span class="badge ${cls}">${label}</span></td></tr>`);
  $('#dtcOut').innerHTML = rows.length
    ? `<table><tr><th>Código</th><th>Descrição</th><th>Tipo</th></tr>${rows.join('')}</table>`
    : '<p class="ok">✔ Nenhum código de falha encontrado.</p>';
};

$('#bClear').onclick = async () => {
  if (!confirm('Apagar os códigos e a luz de injeção? Faça com a ignição ligada e o motor desligado. Os dados de prontidão (readiness) também serão zerados.')) return;
  await elm.clearDtcs();
  $('#dtcOut').textContent = 'Códigos apagados. Leia novamente para confirmar.';
};

// ---- Abas ----
for (const b of document.querySelectorAll('nav button')) b.onclick = () => {
  for (const o of document.querySelectorAll('nav button')) {
    o.setAttribute('aria-selected', o === b);
    $('#' + o.dataset.tab).hidden = o !== b;
  }
  if (b.dataset.tab === 'graficos') charted.forEach(chart);
};

render();
