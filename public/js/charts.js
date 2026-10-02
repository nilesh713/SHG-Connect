/* Tiny dependency-free SVG charts: vertical bars (time series) and horizontal bar lists.
   Single series → one brand hue, value shown in tooltip, data table available for screen readers. */
(function () {
  const { esc } = UI;

  // Axis top value made of 4 round steps (e.g. 0, 500, 1000, 1500, 2000)
  function niceMax(v) {
    if (v <= 0) return 4;
    const raw = v / 4;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
    return step * 4;
  }

  const shortNum = (v) => (v >= 100000 ? (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L' : v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.round(v)));

  /**
   * barChart(container, data, { label, value, format, title })
   * data: [{ label, value }]
   */
  function barChart(container, data, { format = (v) => v, title = '', labelEvery } = {}) {
    if (!data.length || data.every((d) => !d.value)) {
      container.innerHTML = `<div class="chart-empty">${esc(t('chart.noData'))}</div>`;
      return;
    }
    // Use the real container width so text stays readable on phones and wide screens
    const W = Math.max(300, Math.round(container.clientWidth || 640)), H = 240, padL = 44, padB = 30, padT = 12, padR = 8;
    const max = niceMax(Math.max(...data.map((d) => d.value)));
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const slot = plotW / data.length;
    const barW = Math.max(3, Math.min(36, slot * 0.62));
    const every = labelEvery || Math.ceil(data.length / Math.max(3, Math.floor(W / 70)));

    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const y = padT + plotH - (plotH * i) / 4;
      grid += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
      grid += `<text class="axis-label" x="${padL - 6}" y="${y + 4}" text-anchor="end">${shortNum((max * i) / 4)}</text>`;
    }

    const bars = data.map((d, i) => {
      const h = (d.value / max) * plotH;
      const x = padL + slot * i + (slot - barW) / 2;
      const y = padT + plotH - h;
      const r = Math.min(4, barW / 2, h);
      // Rounded top, square base anchored to the baseline
      const path = h > 0
        ? `M${x},${padT + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${padT + plotH} Z`
        : '';
      const lbl = i % every === 0 ? `<text class="axis-label" x="${x + barW / 2}" y="${H - 10}" text-anchor="middle">${esc(d.short || d.label)}</text>` : '';
      return `<rect class="bar-hit" data-i="${i}" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${plotH}"/>${path ? `<path class="bar" d="${path}"/>` : ''}${lbl}`;
    }).join('');

    container.innerHTML = `
      <div class="chart" role="img" aria-label="${esc(title)}">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${padT + plotH}" y2="${padT + plotH}" style="stroke:var(--border-strong)"/>${bars}</svg>
        <div class="chart-tooltip" hidden></div>
      </div>
      <details class="table-view"><summary>${esc(t('chart.showTable'))}</summary>
        <div class="table-scroll"><table class="table"><thead><tr><th>${esc(t('chart.period'))}</th><th>${esc(title)}</th></tr></thead>
        <tbody>${data.map((d) => `<tr><td>${esc(d.label)}</td><td>${esc(format(d.value))}</td></tr>`).join('')}</tbody></table></div>
      </details>`;

    const chart = container.querySelector('.chart');
    const tip = container.querySelector('.chart-tooltip');
    const svg = container.querySelector('svg');
    container.querySelectorAll('.bar-hit').forEach((hit) => {
      const show = () => {
        const d = data[hit.dataset.i];
        const box = svg.getBoundingClientRect();
        const scale = box.width / W;
        const x = (Number(hit.getAttribute('x')) + Number(hit.getAttribute('width')) / 2) * scale;
        const y = padT * scale + ((1 - d.value / max) * plotH) * scale;
        tip.innerHTML = `<strong>${esc(format(d.value))}</strong>${esc(d.label)}${d.extra ? ' · ' + esc(d.extra) : ''}`;
        tip.style.left = `${x}px`;
        tip.style.top = `${Math.max(20, y)}px`;
        tip.hidden = false;
        hit.nextElementSibling && hit.nextElementSibling.classList.add('active');
      };
      const hide = () => {
        tip.hidden = true;
        hit.nextElementSibling && hit.nextElementSibling.classList.remove('active');
      };
      hit.addEventListener('mouseenter', show);
      hit.addEventListener('mouseleave', hide);
      hit.addEventListener('touchstart', show, { passive: true });
    });
    chart.addEventListener('mouseleave', () => (tip.hidden = true));
  }

  /** hbarList(container, [{label, value, display}], { tone }) – ranked horizontal bars with direct labels */
  function hbarList(container, data, { tone = '', format = (v) => v } = {}) {
    if (!data.length || data.every((d) => !d.value)) {
      container.innerHTML = `<div class="chart-empty">${esc(t('chart.noData'))}</div>`;
      return;
    }
    const max = Math.max(...data.map((d) => d.value));
    container.innerHTML = `<ul class="hbar-list">${data.map((d) => `
      <li><div class="hbar-label"><span>${esc(d.label)}</span><strong>${esc(d.display ?? format(d.value))}</strong></div>
      <div class="hbar-track" aria-hidden="true"><div class="hbar-fill ${tone}" style="width:${Math.max(1, (d.value / max) * 100)}%"></div></div></li>`).join('')}</ul>`;
  }

  window.Charts = { barChart, hbarList };
})();
