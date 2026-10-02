/* /my-orders.html – customer's orders with progress */
App.page(async () => {
  const { esc, icon, price } = UI;
  const listEl = document.getElementById('orders-list');
  const tabs = document.getElementById('order-tabs');
  let status = '';
  let page = 1;

  const placed = UI.qs('placed');
  if (placed) {
    document.getElementById('placed-alert').hidden = false;
    document.getElementById('placed-text').textContent = t('orders.placedMany', { n: placed });
  }

  async function load() {
    listEl.innerHTML = UI.spinner();
    try {
      const res = await API.get('/orders', { as: 'customer', status, page, limit: 10 });
      if (!res.data.length) {
        listEl.innerHTML = UI.emptyState({ icon: 'package', title: t('orders.none'), text: t('orders.noneText'), actionLabel: t('home.ctaExplore'), actionHref: '/products.html' });
        UI.pagination(document.getElementById('pagination'), null);
        return;
      }
      listEl.innerHTML = res.data.map((o) => `
        <article class="card order-card">
          <div class="order-head">
            <div><strong>${esc(t('orders.order'))} #${esc(o.orderNumber)}</strong>
              <div class="small muted">${esc(UI.date(o.createdAt))} · ${esc(t('cart.soldBy', { name: o.sellerName }))}</div></div>
            ${UI.badge(o.orderStatus)}
          </div>
          <div class="row-between">
            <div class="order-thumbs">${o.items.slice(0, 4).map((i) => `<img src="${esc(UI.imageUrl(i.image))}" alt="${esc(i.name)}" loading="lazy">`).join('')}
              <span class="small muted" style="align-self:center">${esc(o.items.map((i) => i.name).join(', ').slice(0, 60))}</span></div>
            <div class="text-right"><strong>${price(o.totalAmount)}</strong><div class="small">${esc(Orders.paymentLabel(o.paymentMethod))} · ${UI.badge(o.paymentStatus)}</div></div>
          </div>
          ${o.orderStatus !== 'cancelled' ? Orders.progressMini(o) : ''}
          <div class="row">
            <a class="btn btn-primary btn-sm" href="/order-details.html?id=${esc(o._id)}">${icon('map-pinned')}<span>${esc(t('orders.track'))}</span></a>
            ${o.paymentMethod === 'upi' && o.paymentStatus === 'pending' && !o.paymentReference && o.orderStatus !== 'cancelled' ? `<a class="btn btn-earth btn-sm" href="/order-details.html?id=${esc(o._id)}#pay">${icon('indian-rupee')}<span>${esc(t('orders.payNow'))}</span></a>` : ''}
            ${o.orderStatus === 'delivered' ? `<a class="btn btn-secondary btn-sm" href="/product-details.html?id=${esc(o.items[0].productId)}#reviews">${icon('star')}<span>${esc(t('orders.review'))}</span></a>` : ''}
          </div>
        </article>`).join('');
      UI.pagination(document.getElementById('pagination'), res.pagination, (p) => { page = p; load(); scrollTo(0, 0); });
    } catch (err) {
      listEl.innerHTML = UI.errorState(err, load);
    }
  }

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[role=tab]');
    if (!b) return;
    tabs.querySelectorAll('[role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    status = b.dataset.status;
    page = 1;
    load();
  });
  document.addEventListener('notification:new', load);
  await load();
});
