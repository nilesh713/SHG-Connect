/* /delivery.html – orders that are confirmed but not yet delivered, with one-tap status updates */
App.page(async () => {
  const { esc, icon, price } = UI;
  const list = document.getElementById('delivery-list');
  let orders = [];

  async function load() {
    list.innerHTML = UI.spinner();
    try {
      const res = await API.get('/orders', { view: 'delivery', limit: 50 });
      orders = res.data;
      document.getElementById('delivery-count').textContent = t('del.count', { n: res.pagination.total });
      if (!orders.length) {
        list.innerHTML = UI.emptyState({ icon: 'truck', title: t('del.none'), text: t('del.noneText'), actionLabel: t('nav.orders'), actionHref: '/orders.html' });
        return;
      }
      list.innerHTML = orders.map((o) => `
        <article class="card">
          <div class="order-head" style="margin-bottom:12px">
            <div><a href="/order-details.html?id=${esc(o._id)}"><strong>#${esc(o.orderNumber)}</strong></a> · ${esc(o.customerName)}
              <div class="small muted">${icon('map-pin')} ${esc(o.shippingAddress.city)}, ${esc(o.shippingAddress.state)} – ${esc(o.shippingAddress.pincode)}</div></div>
            <div class="row">${UI.badge(o.orderStatus)}<strong>${price(o.totalAmount)}</strong></div>
          </div>
          <div class="dash-grid two">
            <div>${Orders.timeline(o, 'seller')}</div>
            <div class="stack">
              <dl class="kv">
                <dt>${esc(t('order.items'))}</dt><dd>${esc(o.items.map((i) => `${i.name} × ${i.quantity}`).join(', '))}</dd>
                <dt>${esc(t('order.deliverTo'))}</dt><dd>${esc(o.shippingAddress.fullName)}, ${esc(o.shippingAddress.addressLine)}</dd>
                <dt>${esc(t('order.phone'))}</dt><dd><a href="tel:+91${esc(o.shippingAddress.phone)}">${esc(o.shippingAddress.phone)}</a></dd>
                <dt>${esc(t('order.method'))}</dt><dd>${esc(Orders.paymentLabel(o.paymentMethod))} · ${UI.badge(o.paymentStatus)}</dd>
                ${o.deliveryInfo?.partner ? `<dt>${esc(t('order.deliveryPartner'))}</dt><dd>${esc(o.deliveryInfo.partner)}${o.deliveryInfo.trackingId ? ' · ' + esc(o.deliveryInfo.trackingId) : ''}</dd>` : ''}
              </dl>
              <div class="next-step">
                <p class="small" style="margin-bottom:10px">${esc(t(`order.hint.${o.orderStatus}`))}</p>
                <div class="row">${Orders.nextActionButton(o, 'btn btn-primary btn-lg')}
                  <a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${esc(UI.whatsappLink('91' + o.shippingAddress.phone, t('order.waCustomer', { name: o.shippingAddress.fullName, order: o.orderNumber, status: Orders.statusLabel(o.orderStatus) })))}">${icon('message-circle')}<span>${esc(t('order.messageCustomer'))}</span></a></div>
              </div>
            </div>
          </div>
        </article>`).join('');
    } catch (err) {
      list.innerHTML = UI.errorState(err, load);
    }
  }

  list.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-advance]');
    if (!b) return;
    const updated = await Orders.advance(orders.find((o) => o._id === b.dataset.advance), b.dataset.status);
    if (updated) load();
  });
  await load();
});
