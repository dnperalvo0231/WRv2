/* Versión horizontal · 2 pestañas · lee window.DASH_DATA (data/data.js) */
(() => {
const D = window.DASH_DATA;
const $ = (s, r = document) => r.querySelector(s);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const C = { oil: css('--oil'), water: css('--water'), gas: css('--gas'), deliv: css('--deliv'), wc: css('--wc'), good: css('--good'),
            warn: css('--warn'), bad: css('--bad'), navy: css('--navy'), mut: css('--muted'), loss: css('--loss') };
const MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MESL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fmt = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d });
const dm = s => { const [, m, d] = s.split('-'); return `${+d}/${+m}`; };
const dShort = s => { const [, m, d] = s.split('-'); return `${+d} ${MES[+m - 1]}`; };
const sum = a => a.reduce((x, y) => x + (y || 0), 0);
const mean = a => a.length ? sum(a) / a.length : null;

Chart.defaults.color = '#44546a';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.borderColor = '#e6ebf2';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.tooltip.backgroundColor = '#14213d';
Chart.defaults.plugins.tooltip.padding = 10;

const charts = {};
const mk = (id, cfg) => { charts[id]?.destroy(); charts[id] = new Chart($('#' + id), cfg); return charts[id]; };
const base = (extra = {}) => ({ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, animation: { duration: 650 }, ...extra });
const tipNum = (d = 0) => ({ callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y, d)}` } });

const state = { w: D.weeks.length - 1, tab: 1, tr: new Set(['oil', 'wc']), range: '90', lift: 'all', month: null };
const W = () => D.weeks[state.w], prevW = () => D.weeks[state.w - 1];

/* ---------- serie diaria combinada (Excel + días de las semanas cargadas) ---------- */
function series() {
  const m = new Map(D.daily2026.map(r => [r[0], r]));
  D.weeks.forEach(w => w.days.forEach(d => { if (d.oil != null) m.set(d.date, [d.date, d.oil, d.water, d.gas, d.wc, d.deliv]); }));
  return [...m.values()].sort((a, b) => a[0] < b[0] ? -1 : 1);
}
const fcMap = () => Object.fromEntries(D.forecast.map(f => [f.m, f]));
function mtd(w) {                       // promedio del mes en curso hasta el fin de la semana
  const m = w.end.slice(0, 7), v = series().filter(r => r[0].startsWith(m) && r[0] <= w.end && r[1] != null).map(r => r[1]);
  const f = fcMap()[m] || {}, avg = mean(v);
  return { m, avg, plan: f.plan, orig: f.original, pct: f.plan ? avg / f.plan : null };
}

/* ---------- Encabezado ---------- */
const AREAS = ['HSE', 'Phys. Security', 'Facilities & Maint.', 'Geosciences', 'Drilling'];
function wLabel(w) { const [y, m1, d1] = w.start.split('-'), [, m2, d2] = w.end.split('-'); return `${+d1}${m1 === m2 ? '' : ' ' + MES[+m1 - 1]}–${+d2} ${MES[+m2 - 1]} ${y}`; }
function renderHead() {
  const w = W(), sel = $('#weekSel'); sel.innerHTML = '';
  D.weeks.forEach((x, i) => sel.add(new Option(wLabel(x), i, false, i === state.w)));
  $('#range').textContent = `${dShort(w.start)} ${w.start.slice(0, 4)} – ${dShort(w.end)} ${w.end.slice(0, 4)}`;
  $('#prev').disabled = state.w === 0; $('#next').disabled = state.w === D.weeks.length - 1;
  $('#areas').innerHTML = AREAS.map(a => `<div class="area"><b>${a}</b><span>${(w.areas && w.areas[a]) || '—'}</span></div>`).join('');
  const p = $('#partial'); p.hidden = !w.partial;
  if (w.partial) p.textContent = 'Semana cargada desde el PDF de Power BI: no incluye la serie diaria de agua inyectada ni de gas.';
  const lg = $('#logo'); lg.onload = () => { lg.hidden = false; $('#logoTxt').hidden = true; $('#logoBox').style.border = '0'; }; lg.src = 'img/logo.png';
}

/* ---------- Pestaña 1 ---------- */
function renderTable() {
  const w = W();
  $('#tProd').innerHTML = `<thead><tr><th>Fecha</th><th>Oil<br>BOPD</th><th>Water<br>BWPD</th><th>Fluid<br>BPD</th><th>Gas<br>MPCD</th><th>WC<br>%</th><th>Deliv.<br>BOPD</th></tr></thead><tbody>` +
    w.days.map(d => `<tr><td>${dm(d.date)}/${d.date.slice(0, 4)}</td><td>${fmt(d.oil)}</td><td>${fmt(d.water)}</td><td>${fmt(d.fluid)}</td><td>${fmt(d.gas)}</td><td>${fmt(d.wc, 1)}</td><td>${fmt(d.deliv)}</td></tr>`).join('') +
    `<tr class="sum"><td>Weekly</td><td>${fmt(sum(w.days.map(d => d.oil)))}</td><td>${fmt(sum(w.days.map(d => d.water)))}</td><td></td><td>${fmt(sum(w.days.map(d => d.gas)))}</td><td></td><td>${fmt(sum(w.days.map(d => d.deliv)))}</td></tr>
     <tr class="sum"><td>Average</td><td>${fmt(w.avg.oil)}</td><td>${fmt(w.avg.water)}</td><td>${fmt(w.avg.fluid)}</td><td>${fmt(w.avg.gas)}</td><td>${fmt(w.avg.wc, 2)}</td><td>${fmt(w.avg.deliv)}</td></tr></tbody>`;
}
const KPI = [
  { k: 'oil', l: 'Oil avg', u: 'BOPD', c: C.oil, good: 1, pct: 1 }, { k: 'water', l: 'Water avg', u: 'BWPD', c: C.water, good: -1, pct: 1 },
  { k: 'gas', l: 'Gas avg', u: 'MCFD', c: C.gas, good: 0, pct: 1 }, { k: 'wc', l: 'Water cut', u: '%', c: C.wc, good: -1, dec: 2 },
  { k: 'deliv', l: 'Delivery SSHH', u: 'BOPD', c: C.deliv, good: 1, pct: 1 }, { k: 'ful', l: 'Fulfillment', u: '%', c: C.navy },
];
function renderKPIs() {
  const w = W(), pw = prevW(), f = mtd(w), box = $('#kpis'); box.innerHTML = '';
  KPI.forEach(m => {
    let v, sub = '', cls = '';
    if (m.k === 'ful') { v = f.pct == null ? null : f.pct * 100; sub = `${fmt(f.avg)} vs ${fmt(f.plan)} BOPD`; cls = f.pct >= 1 ? 'up' : f.pct >= .9 ? '' : 'down'; }
    else {
      v = w.avg[m.k]; const dec = m.dec || 0;
      if (m.k === 'deliv') sub = `BSW ${fmt(w.avg.bsw, 3)} %`;
      else if (pw && pw.avg[m.k] != null && v != null) {
        const diff = v - pw.avg[m.k], rel = m.pct ? diff / pw.avg[m.k] * 100 : diff;
        cls = Math.abs(rel) < .05 || m.good === 0 ? '' : diff * m.good > 0 ? 'up' : 'down';
        sub = `${diff > 0 ? '▲' : diff < 0 ? '▼' : '■'} ${fmt(Math.abs(rel), m.pct ? 1 : 2)}${m.pct ? ' %' : ' pp'} vs sem. ant.`;
      }
    }
    box.insertAdjacentHTML('beforeend', `<div class="kpi" style="--c:${m.c}"><div class="l">${m.l}</div><div class="v">${fmt(v, m.dec || 0)}<small>${m.u}</small></div><div class="d ${cls}">${sub || '&nbsp;'}</div></div>`);
  });
}
function pills(id, items, on, tap) {
  const b = $('#' + id); b.innerHTML = '';
  items.forEach(it => { const e = document.createElement('button'); e.className = 'pill'; e.textContent = it.l; e.style.setProperty('--c', it.c || C.navy); e.setAttribute('aria-pressed', on(it)); e.onclick = () => tap(it); b.appendChild(e); });
}
const TS = [{ k: 'oil', l: 'Oil', c: C.oil }, { k: 'gas', l: 'Gas', c: C.gas }, { k: 'water', l: 'Water', c: C.water }, { k: 'wc', l: 'Water cut %', c: C.wc }];
function renderTrend() {
  pills('trendSeries', TS, s => state.tr.has(s.k), s => { state.tr.has(s.k) ? state.tr.size > 1 && state.tr.delete(s.k) : state.tr.add(s.k); renderTrend(); });
  pills('trendRange', [{ k: '30', l: '30 días' }, { k: '90', l: '90 días' }, { k: 'all', l: 'Marzo–hoy' }], r => state.range === r.k, r => { state.range = r.k; renderTrend(); });
  const all = series(); let rows = state.range === 'all' ? all : all.slice(-+state.range);
  const map = Object.fromEntries(rows.map(r => [r[0], r])), out = [];
  for (let t = new Date(rows[0][0] + 'T00:00:00Z'); t <= new Date(rows[rows.length - 1][0] + 'T00:00:00Z'); t = new Date(t.getTime() + 864e5)) { const k = t.toISOString().slice(0, 10); out.push(map[k] || [k]); }
  const ix = { oil: 1, water: 2, gas: 3, wc: 4 }, ax = { oil: 'y', gas: 'y', water: 'y2', wc: 'y3' };
  const sel = TS.filter(s => state.tr.has(s.k));
  mk('cTrend', { type: 'line', data: { labels: out.map(r => dm(r[0])), datasets: sel.map(s => ({ label: s.l, data: out.map(r => r[ix[s.k]] ?? null), yAxisID: ax[s.k], borderColor: s.c,
      backgroundColor: s.c + '26', fill: s.k === 'oil' || s.k === 'gas', borderDash: s.k === 'wc' ? [5, 4] : [], pointRadius: 0, borderWidth: 2, tension: .25 })) },
    options: base({ plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y, c.dataset.yAxisID === 'y3' ? 2 : 0)}` } } }, scales: {
      y: { display: sel.some(s => ax[s.k] === 'y'), beginAtZero: true, position: 'left', title: { display: true, text: 'BOPD / MPCD' } },
      y2: { display: state.tr.has('water'), position: 'right', title: { display: true, text: 'BWPD' }, grid: { drawOnChartArea: false } },
      y3: { display: state.tr.has('wc'), position: 'right', min: 80, max: 95, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } },
      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } } } }) });
  const vals = all.map(r => r[1]).filter(x => x != null).sort((a, b) => a - b), med = vals[vals.length >> 1];
  const ok = r => r[1] != null && r[1] >= med * .5, g = all.filter(ok), h = g.slice(0, 31), t = g.slice(-30), low = all.filter(r => !ok(r));
  const o1 = mean(h.map(r => r[1])), o2 = mean(t.map(r => r[1])), c1 = mean(h.map(r => r[4])), c2 = mean(t.map(r => r[4]));
  $('#trendNote').innerHTML = `Desde marzo el petróleo pasó de <b>${fmt(o1)}</b> a <b>${fmt(o2)}</b> BOPD (últimos 30 días operativos, <b>${o2 > o1 ? '+' : ''}${fmt((o2 / o1 - 1) * 100, 0)} %</b>) y el corte de agua de ${fmt(c1, 1)} % a ${fmt(c2, 1)} %.` +
    (low.length ? ` Excluidos por paro (menos de la mitad de la mediana, ${fmt(med)} BOPD): ${low.map(r => dm(r[0])).join(', ')}.` : '') + ' El Excel no trae datos de abril.';
}
const fcol = v => v == null ? C.mut : v >= 1 ? C.good : v >= .9 ? C.warn : C.bad;
function renderForecast() {
  const w = W(), cur = mtd(w), rows = D.forecast.filter(f => f.m.startsWith('2026'));
  const real = rows.map(f => f.m === cur.m ? cur.avg : f.actual), pct = rows.map((f, i) => real[i] != null && f.plan ? real[i] / f.plan * 100 : null);
  mk('cForecast', { data: { labels: rows.map(f => MES[+f.m.slice(5) - 1]), datasets: [
    { type: 'bar', label: 'Plan', data: rows.map(f => f.plan), backgroundColor: '#a9c9f2', borderRadius: 3, yAxisID: 'y', order: 3 },
    { type: 'bar', label: 'Real', data: real, backgroundColor: C.navy, borderRadius: 3, yAxisID: 'y', order: 3 },
    { type: 'line', label: 'Cumplimiento %', data: pct, borderColor: C.oil, backgroundColor: C.oil, pointRadius: 3, borderWidth: 2, tension: .3, yAxisID: 'y2', order: 1 }] },
    options: base({ plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y, 0)}${c.dataset.yAxisID === 'y2' ? ' %' : ' BOPD'}` } } }, scales: {
      y: { beginAtZero: true }, y2: { position: 'right', min: 40, max: 130, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } } } }) });
  $('#fcNote').innerHTML = `Promedio del mes al ${dShort(w.end)}: <b>${fmt(cur.avg)}</b> BOPD vs plan <b>${fmt(cur.plan)}</b> BOPD → <b style="color:${fcol(cur.pct)}">${fmt(cur.pct * 100, 0)} %</b>. Propuesta original: ${fmt(cur.orig)} BOPD (${fmt(cur.avg / cur.orig * 100, 0)} %).`;
  if (!state.month || state.mw !== state.w) { state.month = cur.m; state.mw = state.w; }
  const box = $('#months'); box.innerHTML = '';
  rows.forEach((f, i) => { if (real[i] == null) return; const r = pct[i] / 100, b = document.createElement('button'); b.className = 'm' + (f.m === state.month ? ' on' : ''); b.style.setProperty('--c', fcol(r));
    b.innerHTML = `<b>${fmt(pct[i], 0)}%</b><span>${MES[+f.m.slice(5) - 1]}</span>`; b.onclick = () => { state.month = f.m; renderForecast(); }; box.appendChild(b); });
  const i = rows.findIndex(f => f.m === state.month);
  $('#monthDetail').textContent = `${MESL[+state.month.slice(5) - 1]}: real ${fmt(real[i])} · plan ${fmt(rows[i].plan)} BOPD (${fmt(pct[i], 1)} %)`;
}
function renderLosses() {
  const w = W(), b = $('#losses'), cm = (w.comments && w.comments.losses) || '';
  if (!w.losses.length) { b.innerHTML = `<div class="empty">✔ Sin pérdidas de producción reportadas en la semana.</div>`; return; }
  const rec = sum(w.losses.map(l => l.rec)), non = sum(w.losses.map(l => l.nonrec));
  b.innerHTML = `<div class="scroll"><table class="data"><thead><tr><th>Fecha</th><th>Pozo</th><th>Recov.</th><th>Non-rec.</th><th class="cm">Comment</th></tr></thead><tbody>` +
    w.losses.map(l => `<tr><td>${dm(l.date)}/${l.date.slice(0, 4)}</td><td>${l.well}</td><td>${fmt(l.rec || 0, 2)}</td><td class="neg">${fmt(l.nonrec || 0, 2)}</td><td class="cm">${l.note}</td></tr>`).join('') +
    `<tr class="sum"><td>TOTAL</td><td></td><td>${fmt(rec, 2)}</td><td class="neg">${fmt(non, 2)}</td><td></td></tr></tbody></table></div>` + (cm ? `<p class="txt">${cm}</p>` : '');
}

/* ---------- Pestaña 2 ---------- */
function renderWater() {
  const w = W(), s = w.injSummary, c = w.comments || {};
  $('#waterTxt').textContent = c.water || '';
  $('#tWater').innerHTML = `<thead><tr><th>Well</th><th>Water<br>bls</th><th>Press.<br>psi</th><th>ppm<br>SST</th><th>ppm<br>oil</th><th>Salinity<br>ppm</th></tr></thead><tbody>` +
    [['A10 WDW', s.a10], ['A11 WDW', s.a11]].map(([n, x]) => `<tr><td>${n}<span class="sub">Tiyuyacu</span></td><td>${fmt(x.water)}</td><td>${fmt(x.psi)}</td><td>${fmt(x.sst)}</td><td>${fmt(x.oil)}</td><td>${fmt(s.salinity)}</td></tr>`).join('') +
    `<tr class="sum"><td>Inyectado vs producido</td><td colspan="5" style="text-align:right">${fmt(s.a10.water + s.a11.water)} vs ${fmt(w.avg.water)} BWPD (${fmt((s.a10.water + s.a11.water) / w.avg.water * 100, 1)} %)</td></tr></tbody>`;
  const has = w.injection && w.injection.length; $('#waterBox').hidden = !has; if (!has) return;
  mk('cWater', { data: { labels: w.injection.map(d => dm(d.date)), datasets: [
    { type: 'bar', label: 'A10 agua (bbl)', data: w.injection.map(d => d.a10), backgroundColor: C.water, borderRadius: 3, yAxisID: 'y' },
    { type: 'bar', label: 'A11 agua (bbl)', data: w.injection.map(d => d.a11), backgroundColor: '#8fc0f5', borderRadius: 3, yAxisID: 'y' },
    { type: 'line', label: 'A10 presión (psi)', data: w.injection.map(d => d.p10), borderColor: C.oil, pointRadius: 3, borderWidth: 2, yAxisID: 'y2' },
    { type: 'line', label: 'A11 presión (psi)', data: w.injection.map(d => d.p11), borderColor: C.wc, pointRadius: 3, borderWidth: 2, yAxisID: 'y2' }] },
    options: base({ plugins: { tooltip: tipNum(0) }, scales: { y: { beginAtZero: true, grace: '10%' }, y2: { position: 'right', grid: { drawOnChartArea: false }, grace: '20%' } } }) });
}
function renderGas() {
  const w = W(), g = w.gasSummary;
  mk('cGas', { type: 'doughnut', data: { labels: ['Energía', 'Quemado'], datasets: [{ data: [g.fuelPct, g.flaredPct], backgroundColor: [C.good, '#ef8a4a'], borderWidth: 0, borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed, 1)} %` } } } } });
  $('#gasC').innerHTML = `${fmt(g.flaredPct, 1)} %<small>flared</small>`;
  $('#gasInfo').innerHTML = `<div class="stat"><span>Quemado / energía</span><b>${fmt(g.flaredPct, 1)} % / ${fmt(g.fuelPct, 1)} %</b></div>
    <div class="stat"><span>Gas producido (semana)</span><b>${fmt(g.produced / 1000, 2)} MMpc</b></div>
    <div class="stat"><span>Uso en energía</span><b>${fmt(g.fuel, 0)} Mscf · ${fmt(g.fuelPerDay, 0)}/d</b></div>
    <div class="stat warn"><span>Microturbina</span><b>0 · fuera de servicio</b></div>`;
  $('#gasTxt').textContent = (w.comments && w.comments.gas) || '';
  const has = w.gas && w.gas.length; $('#gasBox').hidden = !has;
  if (has) mk('cGasDay', { type: 'bar', data: { labels: w.gas.map(d => dm(d.date)), datasets: [
    { label: 'Combustible (MPCD)', data: w.gas.map(d => d.fuel), backgroundColor: C.good, borderRadius: 3, stack: 's' },
    { label: 'Quemado (MPCD)', data: w.gas.map(d => d.flared), backgroundColor: '#ef8a4a', borderRadius: 3, stack: 's' }] },
    options: base({ plugins: { tooltip: tipNum(0) }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }) });
}
function renderDeliv() {
  const w = W(), diff = w.avg.deliv - w.avg.oil;
  $('#delivTxt').textContent = (w.comments && w.comments.delivery) || '';
  $('#delivKpi').innerHTML = `<div class="stat"><span>Entrega promedio</span><b>${fmt(w.avg.deliv)} BOPD</b></div><div class="stat"><span>Producción promedio</span><b>${fmt(w.avg.oil)} BOPD</b></div>
    <div class="stat"><span>BSW en estación</span><b>${fmt(w.avg.bsw, 3)} %</b></div><div class="stat ${Math.abs(diff) > 60 ? 'warn' : ''}"><span>Entrega − producción</span><b>${diff > 0 ? '+' : ''}${fmt(diff)} BOPD</b></div>`;
  mk('cDeliv', { type: 'line', data: { labels: w.days.map(d => dm(d.date)), datasets: [
    { label: 'Producción', data: w.days.map(d => d.oil), borderColor: C.oil, pointRadius: 3, borderWidth: 2.2, tension: .3 },
    { label: 'Entrega SSHH', data: w.days.map(d => d.deliv), borderColor: C.deliv, backgroundColor: C.deliv + '22', fill: true, pointRadius: 3, borderWidth: 2.2, tension: .3 }] },
    options: base({ plugins: { tooltip: tipNum(0) }, scales: { y: { grace: '15%' } } }) });
}
function renderLift() {
  const w = W(), st = w.rldStats;
  mk('cLift', { type: 'doughnut', data: { labels: ['En rango', 'Upthrust', 'Downthrust'], datasets: [{ data: [st.inrange * 100, st.upthrust * 100, st.downthrust * 100], backgroundColor: [C.good, C.warn, C.bad], borderWidth: 0, borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed, 2)} %` } } } } });
  $('#liftC').innerHTML = `${fmt(st.inrange * 100, 2)} %<small>in range</small>`;
  const up = w.rld.filter(r => r.status === 'upthrust').map(r => r.well), sd = w.rld.filter(r => r.status === 'shutdown').map(r => r.well);
  const over = w.rld.filter(r => r.target && r.days >= r.target).length, wt = w.rld.filter(r => r.target).length;
  $('#liftInfo').innerHTML = `<div class="stat"><span>Upthrust</span><b>${fmt(st.upthrust * 100, 2)} % · ${up.join(', ') || '—'}</b></div>
    <div class="stat ${sd.length ? 'bad' : ''}"><span>Apagados (OFF)</span><b>${sd.join(', ') || '—'}</b></div>
    <div class="stat"><span>Sobre run life objetivo</span><b>${over} de ${wt} pozos</b></div>`;
  $('#liftTxt').textContent = (w.comments && w.comments.lift) || '';
  pills('liftPills', [{ k: 'all', l: 'Todos' }, { k: 'ok', l: 'En rango', c: C.water }, { k: 'upthrust', l: 'Upthrust', c: C.warn }, { k: 'shutdown', l: 'Apagados', c: C.bad }], f => state.lift === f.k, f => { state.lift = f.k; renderLift(); });
  const rows = w.rld.filter(r => state.lift === 'all' || r.status === state.lift).sort((a, b) => b.days - a.days);
  const max = Math.max(...w.rld.map(r => Math.max(r.days, r.target || 0))) * 1.04, box = $('#bars'); box.innerHTML = '';
  rows.forEach(r => {
    const el = document.createElement('div'); el.className = 'bar-r';
    el.title = `${r.well} · ${r.pump}\nRun life: ${fmt(r.days)} días${r.target ? ` (objetivo ${fmt(r.target)})` : ''}`;
    const tg = { upthrust: '<span class="tag" style="color:#a87400">UP</span>', shutdown: '<span class="tag" style="color:var(--bad)">OFF</span>', ok: '' }[r.status];
    el.innerHTML = `<span class="w">${r.well}${tg}</span><div class="track"><div class="fill ${r.status}"></div>${r.target ? `<i class="tick" style="left:${r.target / max * 100}%"></i>` : ''}</div><span class="val">${fmt(r.days)}</span>`;
    box.appendChild(el); requestAnimationFrame(() => requestAnimationFrame(() => $('.fill', el).style.width = r.days / max * 100 + '%'));
  });
}
function renderNotes() {
  const n = W().notes || [], col = { Alerta: C.bad, Pozo: C.oil, Campo: C.water };
  $('#notes').innerHTML = n.length ? n.map(x => `<div class="nt" style="--c:${col[x.tag] || C.water}"><i>${x.tag}</i><h4>${x.title}</h4><p>${x.text}</p></div>`).join('') : '<div class="empty">Sin novedades registradas para esta semana.</div>';
}

/* ---------- Gráficos OFM (BMP) ---------- */
const EXT = ['bmp', 'png', 'jpg', 'jpeg'];
const tryLoad = (urls, i = 0) => new Promise(res => { if (i >= urls.length) return res(null); const im = new Image(); im.onload = () => res(urls[i]); im.onerror = () => tryLoad(urls, i + 1).then(res); im.src = urls[i]; });
function showImg(slot, src, title) { slot.classList.add('has'); slot.classList.remove('drag'); slot.innerHTML = `<p class="cap">${title}</p><img src="${src}" alt="${title}" loading="lazy">`; slot.onclick = () => { $('#lb img').src = src; $('#lb').hidden = false; }; }
function mountSlots() {
  const wk = W(), v = encodeURIComponent(D.generated);
  document.querySelectorAll('.slot').forEach(async slot => {
    const id = slot.dataset.slot, title = slot.dataset.title;
    if (!slot._d) { slot._d = 1; const pv = e => { e.preventDefault(); e.stopPropagation(); };
      ['dragenter', 'dragover'].forEach(ev => slot.addEventListener(ev, e => { pv(e); slot.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach(ev => slot.addEventListener(ev, e => { pv(e); slot.classList.remove('drag'); }));
      slot.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) showImg(slot, URL.createObjectURL(f), title + ' (vista previa)'); }); }
    slot.classList.remove('has'); slot.onclick = null;
    slot.innerHTML = `<div class="ph"><b>📊 ${title}</b><span>${slot.dataset.hint}<br>Sube <code>img/${id}.bmp</code> (o <code>img/${wk.end}/${id}.bmp</code> para esta semana)<br>o arrastra la imagen aquí para una vista previa.</span></div>`;
    const found = await tryLoad(EXT.flatMap(e => [`img/${wk.end}/${id}.${e}?v=${v}`, `img/${id}.${e}?v=${v}`])); if (found) showImg(slot, found, title);
  });
}
$('#lb').onclick = () => $('#lb').hidden = true;
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#lb').hidden = true; });

/* ---------- Pestañas, semana y arranque ---------- */
function setTab(n, push = true) {
  state.tab = n;
  [1, 2].forEach(i => { $('#tab-' + i).setAttribute('aria-selected', i === n); $('#p' + i).hidden = i !== n; });
  if (push) history.replaceState(null, '', n === 2 ? '#operaciones' : '#produccion');
  requestAnimationFrame(() => Object.values(charts).forEach(c => c.resize()));
}
$('#tab-1').onclick = () => setTab(1); $('#tab-2').onclick = () => setTab(2);
$('.tabs').addEventListener('keydown', e => { if (e.key === 'ArrowRight') { setTab(2); $('#tab-2').focus(); } if (e.key === 'ArrowLeft') { setTab(1); $('#tab-1').focus(); } });
const go = i => { state.w = Math.max(0, Math.min(D.weeks.length - 1, i)); renderAll(); };
$('#weekSel').onchange = e => go(+e.target.value); $('#prev').onclick = () => go(state.w - 1); $('#next').onclick = () => go(state.w + 1);
$('#print').onclick = () => window.print();
function renderAll() {
  renderHead(); renderTable(); renderKPIs(); renderTrend(); renderForecast(); renderLosses();
  renderWater(); renderGas(); renderDeliv(); renderLift(); renderNotes(); mountSlots();
  $('#foot').textContent = `Datos actualizados: ${D.generated} · ${D.weeks.length} semana(s) en el historial`;
  requestAnimationFrame(() => Object.values(charts).forEach(c => c.resize()));
}
renderAll();
if (location.hash === '#operaciones') setTab(2, false);
})();
