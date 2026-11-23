/* Dashboard semanal · Campo Singue · Gente Oil Ecuador
   Lee window.DASH_DATA (data/data.js, generado por scripts/excel_to_json.py) y dibuja todo. */
(() => {
const D = window.DASH_DATA;
const $ = (s, r = document) => r.querySelector(s);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { oil: css('--oil'), water: css('--water'), gas: css('--gas'), deliv: css('--deliv'), good: css('--good'),
            warn: css('--warn'), bad: css('--bad'), acc: css('--accent'), txt: css('--text'), mut: css('--muted') };
const MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MESL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fmt = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d });
const dm = s => { const [y, m, d] = s.split('-'); return `${+d}/${+m}`; };
const dShort = s => { const [y, m, d] = s.split('-'); return `${+d} ${MES[+m - 1]}`; };
const sum = a => a.reduce((x, y) => x + (y || 0), 0);
const mean = a => a.length ? sum(a) / a.length : null;

Chart.defaults.color = '#bcd3e8';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.borderColor = 'rgba(255,255,255,.08)';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(4,16,32,.95)';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,.15)';
Chart.defaults.plugins.tooltip.borderWidth = 1;

const charts = {};
const mk = (id, cfg) => { charts[id]?.destroy(); charts[id] = new Chart($('#' + id), cfg); return charts[id]; };
const base = (extra = {}) => ({ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
  animation: { duration: 700 }, ...extra });
const tipNum = (d = 0) => ({ callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y, d)}` } });

const state = { w: D.weeks.length - 1, prod: new Set(['oil', 'deliv', 'water']), fc: '2026', day: '90', lift: 'all', month: null };
const W = () => D.weeks[state.w];
const prevW = () => D.weeks[state.w - 1];

/* ---------- Encabezado + selector de semana ---------- */
function weekLabel(w) {
  const [, m1, d1] = w.start.split('-'), [, m2, d2] = w.end.split('-');
  return m1 === m2 ? `${+d1}–${+d2} ${MES[+m1 - 1]}` : `${+d1} ${MES[+m1 - 1]} – ${+d2} ${MES[+m2 - 1]}`;
}
function renderHead() {
  const bar = $('#weekbar'); bar.innerHTML = '';
  D.weeks.forEach((w, i) => {
    const b = document.createElement('button'); b.textContent = weekLabel(w); b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === state.w);
    b.onclick = () => { state.w = i; renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    bar.appendChild(b);
  });
  const w = W();
  $('#range').textContent = `Semana del ${dShort(w.start)} al ${dShort(w.end)} de ${w.end.slice(0, 4)}`;
  const p = $('#partial');
  p.hidden = !w.partial;
  if (w.partial) p.textContent = 'Semana cargada desde la propuesta Power BI (PDF): incluye promedios, series diarias de producción y pérdidas, pero no la serie diaria de agua y gas.';
  const lg = $('#logo'); lg.onload = () => lg.hidden = false; lg.src = 'img/logo.png';
}

/* ---------- KPIs ---------- */
const KPI = [
  { k: 'oil',   l: 'Petróleo',        u: 'BOPD', c: C.oil,   good: 1,  pct: 1 },
  { k: 'water', l: 'Agua',            u: 'BWPD', c: C.water, good: -1, pct: 1 },
  { k: 'gas',   l: 'Gas',             u: 'MPCD', c: C.gas,   good: 0,  pct: 1 },
  { k: 'wc',    l: 'Corte de agua',   u: '%',    c: '#7fd1ff', good: -1, dec: 2 },
  { k: 'deliv', l: 'Entrega SSHH',    u: 'BOPD', c: C.deliv, good: 1,  pct: 1 },
  { k: 'bsw',   l: 'BSW entrega',     u: '%',    c: '#ff7aa8', good: -1, dec: 3, spark: false },
];
function spark(vals, color) {
  const v = vals.filter(x => x != null); if (v.length < 2) return '';
  const mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 100},${27 - ((x - mn) / r) * 24}`).join(' ');
  return `<svg viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function counter(el, to, dec) {
  const t0 = performance.now(), dur = 900;
  const step = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e, dec); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function renderKPIs() {
  const w = W(), pw = prevW(), box = $('#kpis'); box.innerHTML = '';
  KPI.forEach((m, i) => {
    const v = w.avg[m.k], dec = m.dec || 0, el = document.createElement('div');
    el.className = 'kpi fade'; el.style.setProperty('--c', m.c); el.style.animationDelay = i * 60 + 'ms';
    let dHtml = '<div class="d flat">Primera semana cargada</div>';
    if (pw && pw.avg[m.k] != null && v != null) {
      const diff = v - pw.avg[m.k], rel = m.pct ? diff / pw.avg[m.k] * 100 : diff;
      const cls = Math.abs(rel) < (m.pct ? 0.05 : 0.005) ? 'flat' : (m.good === 0 ? 'flat' : (diff * m.good > 0 ? 'up' : 'down'));
      const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '■';
      dHtml = `<div class="d ${cls}">${arrow} ${fmt(Math.abs(rel), m.pct ? 1 : (m.dec || 1))}${m.pct ? ' %' : ' pp'} vs sem. anterior</div>`;
    }
    const sp = m.spark === false ? '' : spark(w.days.map(d => m.k === 'bsw' ? null : d[m.k]), m.c);
    el.innerHTML = `<div class="l">${m.l}</div><div class="v"><span data-v>0</span><small>${m.u}</small></div>${dHtml}${sp}`;
    box.appendChild(el);
    if (v != null) counter($('[data-v]', el), v, dec); else $('[data-v]', el).textContent = '—';
  });
}

/* ---------- 1 · Producción semanal ---------- */
const PS = [
  { k: 'oil', l: 'Petróleo', c: C.oil, ax: 'y' }, { k: 'deliv', l: 'Entrega', c: C.deliv, ax: 'y' },
  { k: 'gas', l: 'Gas', c: C.gas, ax: 'y' }, { k: 'water', l: 'Agua', c: C.water, ax: 'y2' }, { k: 'fluid', l: 'Fluido total', c: '#c6a8ff', ax: 'y2' },
];
function pills(id, items, isOn, onTap, multi) {
  const box = $('#' + id); box.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button'); b.className = 'pill'; b.textContent = it.l; b.style.setProperty('--c', it.c || C.acc);
    b.setAttribute('aria-pressed', isOn(it)); b.onclick = () => onTap(it); box.appendChild(b);
  });
}
function renderProd() {
  const w = W();
  pills('prodPills', PS, p => state.prod.has(p.k), p => { state.prod.has(p.k) ? (state.prod.size > 1 && state.prod.delete(p.k)) : state.prod.add(p.k); renderProd(); });
  const sel = PS.filter(p => state.prod.has(p.k)), right = sel.some(p => p.ax === 'y2'), left = sel.some(p => p.ax === 'y');
  mk('cProd', { type: 'line', data: { labels: w.days.map(d => dm(d.date)),
    datasets: sel.map(p => ({ label: p.l, data: w.days.map(d => d[p.k]), yAxisID: p.ax, borderColor: p.c, backgroundColor: p.c + '33',
      fill: false, tension: .35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.5 })) },
    options: base({ plugins: { tooltip: tipNum(0) }, scales: {
      y: { display: left, position: 'left', grace: '8%', title: { display: true, text: 'BOPD / MPCD' } },
      y2: { display: right, position: 'right', grace: '8%', grid: { drawOnChartArea: !left }, title: { display: true, text: 'BWPD / BPD' } } } }) });
  const T = $('#tProd');
  T.innerHTML = `<thead><tr><th>Fecha</th><th>Petróleo</th><th>Agua</th><th>Fluido</th><th>Gas</th><th>Corte agua %</th><th>Entrega</th></tr></thead><tbody>` +
    w.days.map(d => `<tr><td>${dm(d.date)}</td><td>${fmt(d.oil)}</td><td>${fmt(d.water)}</td><td>${fmt(d.fluid)}</td><td>${fmt(d.gas)}</td><td>${fmt(d.wc, 2)}</td><td>${fmt(d.deliv)}</td></tr>`).join('') +
    `</tbody><tfoot><tr><td>Semana</td><td>${fmt(sum(w.days.map(d => d.oil)))}</td><td>${fmt(sum(w.days.map(d => d.water)))}</td><td>${fmt(sum(w.days.map(d => d.fluid)))}</td><td>${fmt(sum(w.days.map(d => d.gas)))}</td><td>—</td><td>${fmt(sum(w.days.map(d => d.deliv)))}</td></tr>
    <tr><td>Promedio</td><td>${fmt(w.avg.oil)}</td><td>${fmt(w.avg.water)}</td><td>${fmt(w.avg.fluid)}</td><td>${fmt(w.avg.gas)}</td><td>${fmt(w.avg.wc, 2)}</td><td>${fmt(w.avg.deliv)}</td></tr></tfoot>`;
}

/* ---------- Cumplimiento (gauge + meses) ---------- */
const fcMap = () => Object.fromEntries(D.forecast.map(f => [f.m, f]));
const ful = f => f && f.actual != null && f.plan ? f.actual / f.plan : null;
const fcol = v => v == null ? C.mut : v >= 1 ? C.good : v >= .9 ? C.warn : C.bad;
function renderFulfil() {
  const fc = D.forecast.filter(f => f.m.startsWith('2026'));
  const last = [...fc].reverse().find(f => f.actual != null);
  if (!state.month) state.month = last.m;
  const f = fcMap()[last.m], v = ful(f), lastDay = D.daily2026[D.daily2026.length - 1][0];
  mk('cGauge', { type: 'doughnut', data: { datasets: [{ data: [Math.min(v, 1) * 100, 100 - Math.min(v, 1) * 100], backgroundColor: [fcol(v), 'rgba(255,255,255,.1)'], borderWidth: 0, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, rotation: -90, circumference: 180, cutout: '74%', plugins: { legend: { display: false }, tooltip: { enabled: false } } } });
  $('#gaugeC').innerHTML = `${fmt(v * 100, 0)} %<small>${MESL[+last.m.slice(5) - 1]} ${last.m.slice(0, 4)}</small>`;
  $('#gaugeT').textContent = `Promedio del mes al ${dShort(lastDay)}: ${fmt(f.actual)} BOPD vs plan ${fmt(f.plan)} BOPD.`;
  const box = $('#months'); box.innerHTML = '';
  fc.filter(x => x.actual != null).forEach(x => {
    const r = ful(x), b = document.createElement('button'); b.className = 'm' + (x.m === state.month ? ' on' : ''); b.style.setProperty('--c', fcol(r));
    b.innerHTML = `<b>${fmt(r * 100, 0)}%</b><span>${MES[+x.m.slice(5) - 1]}</span>`;
    b.onclick = () => { state.month = x.m; renderFulfil(); }; box.appendChild(b);
  });
  const s = fcMap()[state.month];
  $('#monthDetail').textContent = `${MESL[+state.month.slice(5) - 1]}: real ${fmt(s.actual)} · plan ${fmt(s.plan)} BOPD (${fmt(ful(s) * 100, 1)} %)`;
}

/* ---------- Producción vs plan ---------- */
function renderForecast() {
  const R = [{ k: '2026', l: '2026' }, { k: '2025', l: '2025–26' }, { k: 'all', l: 'Todo' }];
  pills('fcPills', R, r => state.fc === r.k, r => { state.fc = r.k; renderForecast(); });
  const from = state.fc === '2026' ? '2026-01' : state.fc === '2025' ? '2025-01' : '0000';
  const rows = D.forecast.filter(f => f.m >= from);
  mk('cForecast', { data: { labels: rows.map(f => MES[+f.m.slice(5) - 1] + (state.fc === '2026' ? '' : ' ' + f.m.slice(2, 4))),
    datasets: [
      { type: 'bar', label: 'Real', data: rows.map(f => f.actual), backgroundColor: C.oil, borderRadius: 5, order: 2 },
      { type: 'line', label: 'Plan vigente', data: rows.map(f => f.plan), borderColor: '#fff', borderDash: [6, 4], pointRadius: 2, borderWidth: 2, tension: .25, order: 1 },
      { type: 'line', label: 'Propuesta original (oct-2020)', data: rows.map(f => f.original), borderColor: '#35d6d0', pointRadius: 0, borderWidth: 1.5, tension: .25, order: 1, hidden: state.fc === '2026' } ] },
    options: base({ plugins: { tooltip: tipNum(0) }, scales: { y: { beginAtZero: true, title: { display: true, text: 'BOPD' } }, x: { ticks: { maxRotation: 0, autoSkip: state.fc !== '2026', maxTicksLimit: 14 } } } }) });
}

/* ---------- Serie diaria 2026 ---------- */
function seriesAll() {
  const m = new Map(D.daily2026.map(r => [r[0], r]));
  D.weeks.forEach(w => w.days.forEach(d => { if (d.oil != null) m.set(d.date, [d.date, d.oil, d.water, d.gas, d.wc, d.deliv]); }));
  return [...m.values()].sort((a, b) => a[0] < b[0] ? -1 : 1);
}
function renderDaily() {
  const R = [{ k: '30', l: '30 días' }, { k: '90', l: '90 días' }, { k: 'all', l: 'Marzo–hoy' }];
  pills('dayPills', R, r => state.day === r.k, r => { state.day = r.k; renderDaily(); });
  let rows = seriesAll(); if (state.day !== 'all') rows = rows.slice(-+state.day);
  const map = Object.fromEntries(rows.map(r => [r[0], r])), out = [];
  for (let t = new Date(rows[0][0] + 'T00:00:00Z'); t <= new Date(rows[rows.length - 1][0] + 'T00:00:00Z'); t = new Date(t.getTime() + 864e5)) {
    const k = t.toISOString().slice(0, 10); out.push(map[k] || [k, null, null, null, null, null]);
  }
  mk('cDaily', { type: 'line', data: { labels: out.map(r => dm(r[0])), datasets: [
    { label: 'Petróleo (BOPD)', data: out.map(r => r[1]), borderColor: C.oil, backgroundColor: C.oil + '44', fill: true, pointRadius: 0, borderWidth: 2, tension: .25, yAxisID: 'y', spanGaps: false },
    { label: 'Corte de agua (%)', data: out.map(r => r[4]), borderColor: C.water, pointRadius: 0, borderWidth: 2, tension: .25, yAxisID: 'y2', spanGaps: false } ] },
    options: base({ plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y, c.datasetIndex ? 2 : 0)}` } } }, scales: {
      y: { beginAtZero: true, position: 'left' }, y2: { position: 'right', min: 80, max: 95, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } },
      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } } } }) });
  const all = seriesAll(), vals = all.map(r => r[1]).filter(x => x != null).sort((a, b) => a - b), med = vals[vals.length >> 1];
  const okDay = r => r[1] != null && r[1] >= med * .5, good = all.filter(okDay), head = good.slice(0, 31), tail = good.slice(-30);
  const o1 = mean(head.map(r => r[1])), o2 = mean(tail.map(r => r[1])), c1 = mean(head.map(r => r[4])), c2 = mean(tail.map(r => r[4]));
  const low = all.filter(r => !okDay(r));
  const stop = low.length ? ` Días con producción bajo la mitad de la mediana (${fmt(med)} BOPD), excluidos del promedio: <b>${low.map(r => dm(r[0])).join(', ')}</b> (mínimo ${fmt(Math.min(...low.map(r => r[1])))} BOPD).` : '';
  $('#dailyInsight').innerHTML = `Desde marzo, el petróleo pasó de <b>${fmt(o1)}</b> a <b>${fmt(o2)}</b> BOPD en los últimos 30 días operativos (<b>${o2 > o1 ? '+' : ''}${fmt((o2 / o1 - 1) * 100, 0)} %</b>), y el corte de agua bajó de ${fmt(c1, 1)} % a ${fmt(c2, 1)} %.${stop} El Excel no trae datos de abril.`;
}

/* ---------- 2 · Agua ---------- */
function renderWater() {
  const w = W(), s = w.injSummary, box = $('#wells'); box.innerHTML = '';
  [['A10 WDW', s.a10], ['A11 WDW', s.a11]].forEach(([n, x]) => box.insertAdjacentHTML('beforeend',
    `<div class="well"><h4>${n}</h4><div class="r"><span>Agua</span><b>${fmt(x.water)} bbl</b></div><div class="r"><span>Presión</span><b>${fmt(x.psi)} psi</b></div>
     <div class="r"><span>SST</span><b>${fmt(x.sst)} ppm</b></div><div class="r"><span>Aceite</span><b>${fmt(x.oil)} ppm</b></div><div class="r"><span>Salinidad</span><b>${fmt(s.salinity)} ppm</b></div></div>`));
  const inj = s.a10.water + s.a11.water;
  $('#waterNote').innerHTML = `Inyectado <b>${fmt(inj)}</b> BWPD vs producido <b>${fmt(w.avg.water)}</b> BWPD (${fmt(inj / w.avg.water * 100, 1)} %). Yacimiento receptor: Tiyuyacu.`;
  const has = w.injection && w.injection.length; $('#waterChartBox').hidden = !has;
  if (!has) { $('#waterNote').innerHTML += ' <br>Esta semana solo trae promedios, sin serie diaria.'; return; }
  mk('cWater', { data: { labels: w.injection.map(d => dm(d.date)), datasets: [
    { type: 'bar', label: 'A10 agua (bbl)', data: w.injection.map(d => d.a10), backgroundColor: C.water, borderRadius: 4, yAxisID: 'y' },
    { type: 'bar', label: 'A11 agua (bbl)', data: w.injection.map(d => d.a11), backgroundColor: '#7fd1ff', borderRadius: 4, yAxisID: 'y' },
    { type: 'line', label: 'A10 presión (psi)', data: w.injection.map(d => d.p10), borderColor: C.acc, pointRadius: 3, borderWidth: 2, yAxisID: 'y2' },
    { type: 'line', label: 'A11 presión (psi)', data: w.injection.map(d => d.p11), borderColor: '#ffd166', pointRadius: 3, borderWidth: 2, yAxisID: 'y2' } ] },
    options: base({ plugins: { tooltip: tipNum(0) }, scales: { y: { beginAtZero: true, position: 'left', grace: '10%' }, y2: { position: 'right', grid: { drawOnChartArea: false }, grace: '20%' } } }) });
}

/* ---------- 3 · Gas ---------- */
function renderGas() {
  const w = W(), g = w.gasSummary;
  mk('cGas', { type: 'doughnut', data: { labels: ['Energía (combustible)', 'Quemado'], datasets: [{ data: [g.fuelPct, g.flaredPct], backgroundColor: [C.good, '#ff7a45'], borderWidth: 0, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed, 1)} %` } } } } });
  $('#gasC').innerHTML = `${fmt(g.flaredPct, 1)} %<small>quemado</small>`;
  $('#gasInfo').innerHTML = `
    <div class="stat"><span>Gas producido (semana)</span><b>${fmt(g.produced / 1000, 2)} MMpc</b></div>
    <div class="stat"><span>Uso en energía</span><b>${fmt(g.fuel, 1)} Mscf · ${fmt(g.fuelPerDay, 0)}/d</b></div>
    <div class="stat"><span>Energía vs quemado</span><b>${fmt(g.fuelPct, 1)} % / ${fmt(g.flaredPct, 1)} %</b></div>
    <div class="stat warn"><span>Microturbina</span><b>Fuera de servicio</b></div>
    <p class="mini">Todo el gas combustible lo consume la planta de tratamiento (PTG). Microturbina fuera de servicio por problemas del compresor.</p>`;
  const has = w.gas && w.gas.length; $('#gasChartBox').hidden = !has;
  if (has) mk('cGasDay', { type: 'bar', data: { labels: w.gas.map(d => dm(d.date)), datasets: [
    { label: 'Combustible (MPCD)', data: w.gas.map(d => d.fuel), backgroundColor: C.good, borderRadius: 4, stack: 's' },
    { label: 'Quemado (MPCD)', data: w.gas.map(d => d.flared), backgroundColor: '#ff7a45', borderRadius: 4, stack: 's' } ] },
    options: base({ plugins: { tooltip: tipNum(0) }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }) });
}

/* ---------- 4 · Entrega ---------- */
function renderDeliv() {
  const w = W(), diff = w.avg.deliv - w.avg.oil;
  $('#delivKpi').innerHTML = `<div class="stat"><span>Entrega promedio</span><b>${fmt(w.avg.deliv)} BOPD</b></div>
    <div class="stat"><span>BSW en estación</span><b>${fmt(w.avg.bsw, 3)} %</b></div>
    <div class="stat"><span>Producción promedio</span><b>${fmt(w.avg.oil)} BOPD</b></div>
    <div class="stat ${Math.abs(diff) > 60 ? 'warn' : ''}"><span>Entrega − producción</span><b>${diff > 0 ? '+' : ''}${fmt(diff)} BOPD</b></div>`;
  mk('cDeliv', { type: 'line', data: { labels: w.days.map(d => dm(d.date)), datasets: [
    { label: 'Producción', data: w.days.map(d => d.oil), borderColor: C.oil, pointRadius: 3, borderWidth: 2.5, tension: .3 },
    { label: 'Entrega SSHH', data: w.days.map(d => d.deliv), borderColor: C.deliv, backgroundColor: C.deliv + '22', fill: true, pointRadius: 3, borderWidth: 2.5, tension: .3 } ] },
    options: base({ plugins: { tooltip: tipNum(0) }, scales: { y: { grace: '15%' } } }) });
}

/* ---------- Levantamiento artificial ---------- */
function renderLift() {
  const w = W(), st = w.rldStats;
  mk('cLift', { type: 'doughnut', data: { labels: ['En rango', 'Upthrust', 'Downthrust'], datasets: [{ data: [st.inrange * 100, st.upthrust * 100, st.downthrust * 100], backgroundColor: [C.good, C.warn, C.bad], borderWidth: 0, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed, 2)} %` } } } } });
  $('#liftC').innerHTML = `${fmt(st.inrange * 100, 2)} %<small>en rango</small>`;
  const up = w.rld.filter(r => r.status === 'upthrust').map(r => r.well), sd = w.rld.filter(r => r.status === 'shutdown').map(r => r.well);
  const over = w.rld.filter(r => r.target && r.days >= r.target).length, withT = w.rld.filter(r => r.target).length;
  $('#liftInfo').innerHTML = `
    <div class="stat"><span>Upthrust</span><b>${fmt(st.upthrust * 100, 2)} % · ${up.join(', ') || '—'}</b></div>
    <div class="stat"><span>Downthrust</span><b>${fmt(st.downthrust * 100, 0)} %</b></div>
    <div class="stat ${sd.length ? 'warn' : ''}"><span>Apagados por ESP</span><b>${sd.join(', ') || '—'}</b></div>
    <div class="stat"><span>Sobre run life objetivo</span><b>${over} de ${withT} pozos</b></div>`;
  const F = [{ k: 'all', l: 'Todos' }, { k: 'ok', l: 'En rango', c: C.good }, { k: 'upthrust', l: 'Upthrust', c: C.warn }, { k: 'shutdown', l: 'Apagados', c: '#8c9bb0' }];
  pills('liftPills', F, f => state.lift === f.k, f => { state.lift = f.k; renderLift(); });
  const rows = [...w.rld].filter(r => state.lift === 'all' || r.status === state.lift).sort((a, b) => b.days - a.days);
  const max = Math.max(...w.rld.map(r => Math.max(r.days, r.target || 0))) * 1.04, bars = $('#bars'); bars.innerHTML = '';
  rows.forEach(r => {
    const el = document.createElement('div'); el.className = 'bar';
    el.title = `${r.well} · ${r.pump}\nRun life: ${fmt(r.days)} días${r.target ? ` (objetivo ${fmt(r.target)})` : ''}`;
    const lab = { ok: '', upthrust: '<span class="badge" style="color:' + C.warn + '">UP</span>', shutdown: '<span class="badge">OFF</span>' }[r.status];
    el.innerHTML = `<span class="w">${r.well}${lab}</span><div class="track"><div class="fill ${r.status}"></div>${r.target ? `<i class="tick" style="left:${r.target / max * 100}%"></i>` : ''}</div><span class="val">${fmt(r.days)} d</span>`;
    bars.appendChild(el); requestAnimationFrame(() => requestAnimationFrame(() => $('.fill', el).style.width = r.days / max * 100 + '%'));
  });
}

/* ---------- Pérdidas y novedades ---------- */
function renderLosses() {
  const w = W(), b = $('#losses');
  if (!w.losses.length) { b.innerHTML = `<div class="empty">${w.partial ? 'Esta semana no trae detalle de pérdidas en la fuente cargada (PDF).' : '✔ Sin pérdidas de producción reportadas en la semana.'}</div>`; return; }
  const rec = sum(w.losses.map(l => l.rec)), non = sum(w.losses.map(l => l.nonrec));
  b.innerHTML = `<div class="scroll"><table><thead><tr><th>Fecha</th><th>Pozo</th><th>Recuperable</th><th>No recuperable</th><th style="text-align:left">Comentario</th></tr></thead><tbody>` +
    w.losses.map(l => `<tr><td>${dm(l.date)}</td><td>${l.well}</td><td>${fmt(l.rec, 2)}</td><td>${fmt(l.nonrec, 2)}</td><td style="text-align:left">${l.note}</td></tr>`).join('') +
    `<tr class="tot"><td>Total</td><td></td><td>${fmt(rec, 2)}</td><td>${fmt(non, 2)}</td><td style="text-align:left">${fmt(rec + non, 2)} BOPD</td></tr></tbody></table></div>`;
}
function renderNotes() {
  const w = W(), n = w.notes || [], sec = $('#sec-notes'), box = $('#notes'); sec.hidden = !n.length; box.innerHTML = '';
  const col = { Alerta: C.bad, Pozo: C.oil, Campo: C.water };
  n.forEach(x => box.insertAdjacentHTML('beforeend', `<div class="note" style="--c:${col[x.tag] || C.water}"><div class="t">${x.tag}</div><h4>${x.title}</h4><p>${x.text}</p></div>`));
}

/* ---------- Espacios para gráficos OFM (BMP) ---------- */
const EXT = ['bmp', 'png', 'jpg', 'jpeg'];
function tryLoad(urls, i = 0) {
  return new Promise(res => { if (i >= urls.length) return res(null); const im = new Image();
    im.onload = () => res(urls[i]); im.onerror = () => tryLoad(urls, i + 1).then(res); im.src = urls[i]; });
}
function showImg(slot, src, title) {
  slot.classList.add('has'); slot.classList.remove('drag');
  slot.innerHTML = `<p class="cap">${title}</p><img src="${src}" alt="${title}" loading="lazy">`;
  slot.onclick = () => { const lb = $('#lb'); $('img', lb).src = src; lb.hidden = false; };
}
function mountSlots() {
  const wk = W(), v = encodeURIComponent(D.generated);
  document.querySelectorAll('.slot').forEach(async slot => {
    const id = slot.dataset.slot, title = slot.dataset.title, hint = slot.dataset.hint;
    slot.classList.remove('has'); slot.onclick = null;
    slot.innerHTML = `<div class="ph"><b>📊 ${title}</b><span>${hint}<br>Sube el archivo <code>img/${id}.bmp</code> (o <code>img/${wk.end}/${id}.bmp</code> para esta semana).<br>También puedes arrastrar la imagen aquí para una vista previa.</span></div>`;
    const urls = EXT.flatMap(e => [`img/${wk.end}/${id}.${e}?v=${v}`, `img/${id}.${e}?v=${v}`]);
    const found = await tryLoad(urls); if (found) showImg(slot, found, title);
    const prevent = e => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter', 'dragover'].forEach(ev => slot.addEventListener(ev, e => { prevent(e); slot.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => slot.addEventListener(ev, e => { prevent(e); slot.classList.remove('drag'); }));
    slot.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) showImg(slot, URL.createObjectURL(f), title + ' (vista previa)'); });
  });
}
$('#lb').onclick = () => $('#lb').hidden = true;
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#lb').hidden = true; });

/* ---------- Pie y arranque ---------- */
function renderFoot() { $('#foot').textContent = `Datos actualizados: ${D.generated} · ${D.weeks.length} semana(s) en el historial`; }
function renderAll() {
  renderHead(); renderKPIs(); renderProd(); renderFulfil(); renderForecast(); renderDaily();
  renderWater(); renderGas(); renderDeliv(); renderLift(); renderLosses(); renderNotes(); mountSlots(); renderFoot();
}
renderAll();
})();
