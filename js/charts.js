/* =========================================================
   Charts: small, dependency-free SVG drawings that follow the
   theme colors (CSS variables) and work offline.
   ========================================================= */
(function (global) {
  'use strict';
  const U = global.U;
  const C = {};
  const css = (v) => `var(${v})`;

  /** Grouped monthly bars: series = [{ name, color, values[12] }] with an optional net line. */
  C.monthBars = (labels, series, { height = 240, net } = {}) => {
    const W = 760, H = height, padL = 52, padR = 12, padT = 14, padB = 28;
    const all = series.flatMap((s) => s.values).concat(net || []);
    let max = Math.max(1, ...all.map((v) => Math.abs(v || 0)));
    const min = Math.min(0, ...(net || [0]));
    const step = niceStep((max - min) / 4); max = Math.ceil(max / step) * step;
    const lo = min < 0 ? -Math.ceil(-min / step) * step : 0;
    const y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (max - lo));
    const bw = (W - padL - padR) / labels.length;
    const gw = Math.min(34, bw * 0.72), each = gw / series.length;
    let g = '';
    for (let v = lo; v <= max + 0.001; v += step) g += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="ch-grid${v === 0 ? ' ch-zero' : ''}"/><text x="${padL - 8}" y="${y(v) + 4}" class="ch-axis" text-anchor="end">${U.moneyK(v)}</text>`;
    labels.forEach((l, i) => {
      const x0 = padL + bw * i + (bw - gw) / 2;
      series.forEach((s, j) => {
        const v = s.values[i] || 0; const yy = y(Math.max(0, v)); const h = Math.abs(y(v) - y(0));
        g += `<rect x="${x0 + each * j}" y="${yy}" width="${Math.max(1, each - 2)}" height="${Math.max(0, h)}" rx="2" fill="${css(s.color)}"><title>${U.esc(s.name)} · ${U.esc(l)}: ${U.money(v)}</title></rect>`;
      });
      g += `<text x="${padL + bw * i + bw / 2}" y="${H - 8}" class="ch-axis" text-anchor="middle">${U.esc(l)}</text>`;
    });
    if (net) {
      const pts = net.map((v, i) => `${padL + bw * i + bw / 2},${y(v || 0)}`).join(' ');
      g += `<polyline points="${pts}" class="ch-net"/>` + net.map((v, i) => `<circle cx="${padL + bw * i + bw / 2}" cy="${y(v || 0)}" r="3.2" class="ch-net-dot"><title>Net · ${U.esc(labels[i])}: ${U.money(v)}</title></circle>`).join('');
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Monthly chart">${g}</svg>`;
  };
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }

  /** Donut with legend: items = [{ label, value }] */
  C.donut = (items, { size = 180, center = '', sub = '' } = {}) => {
    const total = U.sum(items, (x) => x.value) || 1;
    const R = 70, r = 46, cx = 90, cy = 90;
    let a0 = -Math.PI / 2, paths = '';
    items.forEach((it, i) => {
      const a1 = a0 + (it.value / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a, rad) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
      if (items.length === 1) paths += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${css('--ser-' + (i % 8))}" stroke-width="${R - r}"/>`;
      else paths += `<path d="M${p(a0, R)} A${R},${R} 0 ${large} 1 ${p(a1, R)} L${p(a1, r)} A${r},${r} 0 ${large} 0 ${p(a0, r)} Z" fill="${css('--ser-' + (i % 8))}"><title>${U.esc(it.label)}: ${U.money(it.value)} (${U.pct(it.value / total)})</title></path>`;
      a0 = a1;
    });
    const legend = items.map((it, i) => `<li><i style="background:${css('--ser-' + (i % 8))}"></i><span>${U.esc(it.label)}</span><b>${U.money0(it.value)}</b><em>${U.pct(it.value / total)}</em></li>`).join('');
    return `<div class="donut"><svg viewBox="0 0 180 180" width="${size}" height="${size}" role="img" aria-label="Breakdown">${paths}<text x="90" y="88" text-anchor="middle" class="donut-c">${U.esc(center)}</text><text x="90" y="106" text-anchor="middle" class="donut-s">${U.esc(sub)}</text></svg><ul class="legend">${legend}</ul></div>`;
  };

  /** Tiny trend line. */
  C.spark = (values, { w = 120, h = 32, color = '--accent' } = {}) => {
    if (!values.length) return '';
    const max = Math.max(...values), min = Math.min(...values, 0), rng = max - min || 1;
    const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * (w - 4) + 2},${h - 3 - ((v - min) / rng) * (h - 6)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="spark" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${css(color)}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  };

  /** Horizontal bar list: [{ label, value, sub }] */
  C.hbars = (items, { max, color = '--ser-0', fmt = U.money0 } = {}) => {
    max = max || Math.max(1, ...items.map((x) => x.value));
    return `<ul class="hbars">${items.map((x) => `<li><div class="hb-l"><span>${U.esc(x.label)}</span><b>${fmt(x.value)}</b></div><div class="hb-t"><i style="width:${Math.max(1, (x.value / max) * 100)}%;background:${css(x.color || color)}"></i>${x.mark ? `<s style="left:${Math.min(100, (x.mark / max) * 100)}%" title="${U.esc(x.markLabel || '')}"></s>` : ''}</div>${x.sub ? `<small>${x.sub}</small>` : ''}</li>`).join('')}</ul>`;
  };

  /** Progress ring 0..1 */
  C.ring = (frac, { size = 64, label = '' } = {}) => {
    const R = 26, L = 2 * Math.PI * R, f = Math.max(0, Math.min(1, frac || 0));
    return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" class="ring" role="img" aria-label="${U.esc(label)} ${U.pct(f)}"><circle cx="32" cy="32" r="${R}" class="ring-bg"/><circle cx="32" cy="32" r="${R}" class="ring-fg" stroke-dasharray="${L * f} ${L}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle">${Math.round(f * 100)}%</text></svg>`;
  };

  global.Charts = C;
})(window);
