/* /cart.html */
App.page(async () => {
  const { esc, icon, price } = UI;
  const list = document.getElementById('cart-list');
  const summary = document.getElementById('cart-summary');
  list.innerHTML = UI.spinner();
  await Cart.sync();

  function render() {
    const items = Cart.items();
    if (!items.length) {
      list.innerHTML = UI.emptyState({ icon: 'shopping-cart', title: t('cart.empty'), text: t('cart.emptyText'), actionLabel: t('home.ctaExplore'), actionHref: '/products.html' });
      summary.hidden = true;
      return;
    }
    const s = Cart.summary(items);
    summary.hidden = false;
    list.innerHTML = s.groups.map((g) => `
      <section class="card cart-group" aria-label="${esc(g.sellerName)}">
        <div class="cart-group-head">${icon('store')}<span>${esc(t('cart.soldBy', { name: g.sellerName }))}</span></div>
        ${g.items.map((i) => `
          <div class="cart-item">
            <img src="${esc(UI.imageUrl(i.image))}" alt="${esc(i.name)}" loading="lazy">
            <div class="cart-item-info">
              <a href="/product-details.html?id=${esc(i.productId)}">${esc(i.name)}</a>
              <div class="muted small">${price(i.price)} × ${i.quantity}</div>
              <div class="cart-item-controls">
                <div class="qty" role="group" aria-label="${esc(t('product.quantity'))}: ${esc(i.name)}">
                  <button type="button" data-dec="${esc(i.productId)}" aria-label="${esc(t('product.decrease'))}" ${i.quantity <= 1 ? 'disabled' : ''}>−</button>
                  <input type="number" value="${i.quantity}" min="1" max="${i.maxQty}" data-qty="${esc(i.productId)}" aria-label="${esc(t('product.quantity'))}">
                  <button type="button" data-inc="${esc(i.productId)}" aria-label="${esc(t('product.increase'))}" ${i.quantity >= i.maxQty ? 'disabled' : ''}>+</button>
                </div>
                <strong>${price(i.price * i.quantity)}</strong>
                <button type="button" class="btn btn-ghost btn-sm" data-remove="${esc(i.productId)}">${icon('trash-2')}<span>${esc(t('common.remove'))}</span></button>
              </div>
            </div>
          </div>`).join('')}
        <div class="summary-line small muted"><span>${esc(t('cart.deliveryFrom', { name: g.sellerName }))}</span><span>${g.deliveryCharge ? price(g.deliveryCharge) : esc(t('delivery.free'))}</span></div>
      </section>`).join('');

    summary.innerHTML = `
      <h2 style="font-size:1.15rem">${esc(t('cart.summary'))}</h2>
      <div class="summary-line"><span>${esc(t('cart.items', { n: Cart.count() }))}</span><span>${price(s.itemsTotal)}</span></div>
      <div class="summary-line"><span>${esc(t('cart.delivery'))}</span><span>${s.delivery ? price(s.delivery) : esc(t('delivery.free'))}</span></div>
      <div class="summary-line summary-total"><span>${esc(t('cart.total'))}</span><span>${price(s.total)}</span></div>
      ${s.groups.length > 1 ? `<p class="small muted">${icon('info')} ${esc(t('cart.multiSeller', { n: s.groups.length }))}</p>` : ''}
      <a class="btn btn-primary btn-lg btn-block" href="/checkout.html" style="margin-top:12px">${icon('lock')}<span>${esc(t('cart.checkout'))}</span></a>
      <a class="btn btn-ghost btn-block" href="/products.html" style="margin-top:8px">${esc(t('cart.continue'))}</a>`;
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const item = (pid) => Cart.items().find((i) => i.productId === pid);
    if (b.dataset.inc) Cart.setQty(b.dataset.inc, item(b.dataset.inc).quantity + 1);
    if (b.dataset.dec) Cart.setQty(b.dataset.dec, item(b.dataset.dec).quantity - 1);
    if (b.dataset.remove) { Cart.remove(b.dataset.remove); UI.toast(t('cart.removed'), 'info'); }
    render();
  });
  list.addEventListener('change', (e) => {
    if (e.target.dataset.qty) { Cart.setQty(e.target.dataset.qty, parseInt(e.target.value, 10) || 1); render(); }
  });

  render();
});
