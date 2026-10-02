/* /sales-history.html – totals, charts and order list with date filters */
App.page(async () => {
  const { esc, icon, price, number } = UI;
  const ranges = document.getElementById('range-buttons');
  const custom = document.getElementById('custom-form');
  const root = document.getElementById('sales-root');
  let range = 'month';

  function fmtLabel(key) {
    // key is YYYY-MM-DD or YYYY-MM
    if (key.length === 7) return UI.date(key + '-01', { month: 'short', year: '2-digit' });
    return UI.date(key, { day: 'numeric', month: 'short' });
  }

  async function load() {
    root.innerHTML = UI.spinner();
    const query = { range };
    if (range === 'custom') {
      query.from = document.getElementById('from').value;
      query.to = document.getElementById('to').value;
    }
    try {
      const d = (await API.get('/sellers/me/sales', query)).data;
      const tt = d.totals;
      root.innerHTML = `
        <p class="page-intro">${esc(t('sales.showing', { from: UI.date(d.range.from), to: UI.date(d.range.to) }))}</p>
        <div class="stat-grid">
          <div class="stat"><span class="stat-icon gold">${icon('indian-rupee')}</span><span class="stat-value">${price(tt.totalSales)}</span><span class="stat-label">${esc(t('sales.totalSales'))}</span></div>
          <div class="stat"><span class="stat-icon">${icon('wallet')}</span><span class="stat-value">${price(tt.revenue)}</span><span class="stat-label">${esc(t('sales.revenue'))}</span></div>
          <div class="stat"><span class="stat-icon blue">${icon('circle-check')}</span><span class="stat-value">${number(tt.completedOrders)}</span><span class="stat-label">${esc(t('dash.completedOrders'))}</span></div>
          <div class="stat"><span class="stat-icon earth">${icon('circle-x')}</span><span class="stat-value">${number(tt.cancelledOrders)}</span><span class="stat-label">${esc(t('sales.cancelled'))}</span></div>
        </div>
        <p class="small muted">${esc(t('sales.explain', { orders: tt.totalOrders, avg: price(tt.averageOrderValue), items: d.itemsSold }))}</p>
        <section class="card chart-card" aria-labelledby="c1"><div class="card-title"><h2 id="c1">${esc(t('sales.overTime'))}</h2></div><div id="chart-time"></div></section>
        <div class="dash-grid two">
          <section class="card" aria-labelledby="c2"><div class="card-title"><h2 id="c2">${esc(t('sales.byStatus'))}</h2></div><div id="chart-status"></div></section>
          <section class="card" aria-labelledby="c3"><div class="card-title"><h2 id="c3">${esc(t('sales.mostSold'))}</h2></div><div id="chart-top"></div></section>
        </div>
        <section class="card" aria-labelledby="c4">
          <div class="card-title"><h2 id="c4">${esc(t('sales.orders'))}</h2></div>
          ${d.orders.length ? `<div class="table-wrap"><table class="table stack">
            <thead><tr><th>${esc(t('so.col.order'))}</th><th>${esc(t('so.col.date'))}</th><th>${esc(t('so.col.customer'))}</th><th>${esc(t('so.col.amount'))}</th><th>${esc(t('so.col.payment'))}</th><th>${esc(t('so.col.status'))}</th></tr></thead>
            <tbody>${d.orders.map((o) => `<tr>
              <td data-label="${esc(t('so.col.order'))}"><a href="/order-details.html?id=${esc(o._id)}">#${esc(o.orderNumber)}</a></td>
              <td data-label="${esc(t('so.col.date'))}">${esc(UI.date(o.createdAt))}</td>
              <td data-label="${esc(t('so.col.customer'))}">${esc(o.customerName)}</td>
              <td data-label="${esc(t('so.col.amount'))}">${price(o.totalAmount)}</td>
              <td data-label="${esc(t('so.col.payment'))}">${UI.badge(o.paymentStatus)}</td>
              <td data-label="${esc(t('so.col.status'))}">${UI.badge(o.orderStatus)}</td></tr>`).join('')}</tbody></table></div>`
            : UI.emptyState({ icon: 'chart-column', title: t('sales.none'), text: t('sales.noneText') })}
        </section>`;

      Charts.barChart(document.getElementById('chart-time'), d.series.map((s) => ({ label: fmtLabel(s.date), short: fmtLabel(s.date), value: s.sales, extra: t('sales.ordersN', { n: s.orders }) })), { format: price, title: t('sales.overTime') });
      Charts.hbarList(document.getElementById('chart-status'), Orders.FLOW.concat('cancelled').filter((s) => d.byStatus[s]).map((s) => ({ label: Orders.statusLabel(s), value: d.byStatus[s] })), { format: number });
      Charts.hbarList(document.getElementById('chart-top'), d.topProducts.map((p) => ({ label: p.name, value: p.quantity, display: `${number(p.quantity)} · ${price(p.revenue)}` })), { tone: 'earth' });
    } catch (err) {
      root.innerHTML = UI.errorState(err, load);
    }
  }

  ranges.addEventListener('click', (e) => {
    const b = e.target.closest('[data-range]');
    if (!b) return;
    ranges.querySelectorAll('[data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    range = b.dataset.range;
    custom.hidden = range !== 'custom';
    if (range !== 'custom') load();
    else document.getElementById('from').focus();
  });
  document.getElementById('custom-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    if (!from || !to) return UI.toast(t('sales.chooseDates'), 'error');
    if (from > to) return UI.toast(t('sales.dateOrder'), 'error');
    load();
  });
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('to').value = today;
  document.getElementById('to').max = today;
  document.getElementById('from').max = today;
  await load();
});
