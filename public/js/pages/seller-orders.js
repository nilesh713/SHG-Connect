/* /orders.html – seller order management (table on desktop, cards on mobile) */
App.page(async () => {
  const { esc, icon, price } = UI;
  const body = document.getElementById('orders-body');
  const tabs = document.getElementById('order-tabs');
  const search = document.getElementById('order-search');
  let status = UI.qs('status') || '';
  let page = 1;

  tabs.querySelectorAll('[role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.status === status)));

  async function load() {
    body.innerHTML = `<tr><td colspan="9">${UI.spinner()}</td></tr>`;
    try {
      const res = await API.get('/orders', { status, q: search.value.trim(), page, limit: 15 });
      if (!res.data.length) {
        body.innerHTML = `<tr><td colspan="9" class="cell-full">${UI.emptyState({ icon: 'shopping-bag', title: t('so.none'), text: t('so.noneText'), actionLabel: t('dash.promote'), actionHref: '/promotions.html' })}</td></tr>`;
        UI.pagination(document.getElementById('pagination'), null);
        return;
      }
      body.innerHTML = res.data.map((o) => `
        <tr>
          <td data-label="${esc(t('so.col.order'))}"><a href="/order-details.html?id=${esc(o._id)}"><strong>#${esc(o.orderNumber)}</strong></a></td>
          <td data-label="${esc(t('so.col.customer'))}">${esc(o.customerName)}<div class="small muted">${esc(o.shippingAddress.city)}</div></td>
          <td data-label="${esc(t('so.col.product'))}">${esc(o.items.map((i) => i.name).join(', '))}</td>
          <td data-label="${esc(t('so.col.qty'))}">${o.items.reduce((s, i) => s + i.quantity, 0)}</td>
          <td data-label="${esc(t('so.col.amount'))}"><strong>${price(o.totalAmount)}</strong></td>
          <td data-label="${esc(t('so.col.payment'))}">${esc(Orders.paymentLabel(o.paymentMethod))}<br>${UI.badge(o.paymentStatus)}</td>
          <td data-label="${esc(t('so.col.status'))}">${UI.badge(o.orderStatus)}</td>
          <td data-label="${esc(t('so.col.date'))}">${esc(UI.date(o.createdAt))}</td>
          <td class="cell-full"><div class="actions">
            ${Orders.nextActionButton(o, 'btn btn-primary btn-sm')}
            <a class="btn btn-secondary btn-sm" href="/order-details.html?id=${esc(o._id)}">${esc(t('common.details'))}</a>
          </div></td>
        </tr>`).join('');
      body._orders = res.data;
      UI.pagination(document.getElementById('pagination'), res.pagination, (p) => { page = p; load(); });
    } catch (err) {
      body.innerHTML = `<tr><td colspan="9" class="cell-full">${UI.errorState(err, load)}</td></tr>`;
    }
  }

  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-advance]');
    if (!b) return;
    const order = body._orders.find((o) => o._id === b.dataset.advance);
    const updated = await Orders.advance(order, b.dataset.status);
    if (updated) { load(); Dashboard.refreshCounts(); }
  });
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[role=tab]');
    if (!b) return;
    tabs.querySelectorAll('[role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    status = b.dataset.status;
    page = 1;
    history.replaceState(null, '', status ? `?status=${status}` : location.pathname);
    load();
  });
  search.addEventListener('input', UI.debounce(() => { page = 1; load(); }, 400));
  document.addEventListener('notification:new', (e) => { if (e.detail.type === 'new_order' || e.detail.type === 'order_cancelled') load(); });
  await load();
});
