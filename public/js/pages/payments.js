/* /payments.html – payment status of every order, verify UPI references, UPI ID setup reminder */
App.page(async () => {
  const { esc, icon, price } = UI;
  const body = document.getElementById('pay-body');
  const filter = document.getElementById('pay-filter');
  let page = 1;

  const profile = Auth.getUser().sellerProfile;
  if (!profile || !profile.upiId) document.getElementById('upi-missing').hidden = false;

  // Summary cards from the sales endpoint (all time)
  API.get('/sellers/me/sales', { range: 'all' }).then(({ data }) => {
    document.getElementById('pay-received').textContent = price(data.totals.revenue);
    document.getElementById('pay-pending').textContent = price(Math.max(0, data.totals.totalSales - data.totals.revenue));
  }).catch(() => {});

  async function load() {
    body.innerHTML = `<tr><td colspan="7">${UI.spinner()}</td></tr>`;
    try {
      const res = await API.get('/orders', { paymentStatus: filter.value, page, limit: 20 });
      body._orders = res.data;
      if (!res.data.length) {
        body.innerHTML = `<tr><td colspan="7" class="cell-full">${UI.emptyState({ icon: 'wallet', title: t('pay.none') })}</td></tr>`;
        UI.pagination(document.getElementById('pagination'), null);
        return;
      }
      body.innerHTML = res.data.map((o) => {
        const toVerify = o.paymentMethod === 'upi' && o.paymentReference && o.paymentStatus === 'pending';
        return `<tr ${toVerify ? 'style="background:var(--warning-bg)"' : ''}>
          <td data-label="${esc(t('so.col.order'))}"><a href="/order-details.html?id=${esc(o._id)}"><strong>#${esc(o.orderNumber)}</strong></a></td>
          <td data-label="${esc(t('so.col.amount'))}"><strong>${price(o.totalAmount)}</strong></td>
          <td data-label="${esc(t('order.method'))}">${esc(Orders.paymentLabel(o.paymentMethod))}</td>
          <td data-label="${esc(t('order.paymentStatus'))}">${UI.badge(o.paymentStatus)}</td>
          <td data-label="${esc(t('order.reference'))}">${o.paymentReference ? esc(o.paymentReference) : '<span class="muted">—</span>'}</td>
          <td data-label="${esc(t('so.col.status'))}">${UI.badge(o.orderStatus)}</td>
          <td class="cell-full"><div class="actions">
            ${o.paymentStatus !== 'paid' && o.orderStatus !== 'cancelled' ? `<button class="btn btn-primary btn-sm" type="button" data-pay="paid" data-id="${esc(o._id)}">${icon('circle-check')}<span>${esc(t('pay.markPaid'))}</span></button>` : ''}
            ${toVerify ? `<button class="btn btn-danger btn-sm" type="button" data-pay="failed" data-id="${esc(o._id)}">${esc(t('pay.notReceived'))}</button>` : ''}
            ${o.paymentStatus === 'paid' && o.orderStatus === 'cancelled' ? `<button class="btn btn-secondary btn-sm" type="button" data-pay="refunded" data-id="${esc(o._id)}">${esc(t('pay.markRefunded'))}</button>` : ''}
          </div></td></tr>`;
      }).join('');
      UI.pagination(document.getElementById('pagination'), res.pagination, (p) => { page = p; load(); });
    } catch (err) {
      body.innerHTML = `<tr><td colspan="7" class="cell-full">${UI.errorState(err, load)}</td></tr>`;
    }
  }

  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pay]');
    if (!b) return;
    const o = body._orders.find((x) => x._id === b.dataset.id);
    const status = b.dataset.pay;
    if (!(await UI.confirm(t(`pay.confirm.${status}`, { order: o.orderNumber, amount: price(o.totalAmount) }), { danger: status === 'failed' }))) return;
    try {
      UI.toast((await API.put(`/orders/${o._id}/payment`, { paymentStatus: status })).message, 'success');
      load();
    } catch (err) { UI.toast(err.message, 'error'); }
  });
  filter.addEventListener('change', () => { page = 1; load(); });
  document.addEventListener('notification:new', (e) => { if (e.detail.type === 'payment_received') load(); });
  await load();
});
