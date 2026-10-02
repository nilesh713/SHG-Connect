/* /checkout.html – address + payment method → POST /api/orders */
App.page(async () => {
  const { esc, icon, price } = UI;
  const form = document.getElementById('checkout-form');
  const summaryEl = document.getElementById('checkout-summary');
  const ADDRESS_KEY = 'shg_last_address';

  const items = await Cart.sync();
  if (!items.length) {
    document.getElementById('checkout-root').innerHTML = UI.emptyState({ icon: 'shopping-cart', title: t('cart.empty'), text: t('cart.emptyText'), actionLabel: t('home.ctaExplore'), actionHref: '/products.html' });
    return;
  }
  const s = Cart.summary(items);
  const user = Auth.getUser();

  // Prefill address from the last order or the profile
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(ADDRESS_KEY)) || {}; } catch (e) { /* ignore */ }
  form.fullName.value = saved.fullName || user.name || '';
  form.phone.value = saved.phone || user.phone || '';
  form.addressLine.value = saved.addressLine || '';
  form.city.value = saved.city || (user.location || '').split(',')[0] || '';
  form.state.value = saved.state || (user.location || '').split(',')[1]?.trim() || '';
  form.pincode.value = saved.pincode || '';

  // UPI only when every seller in the cart has a UPI ID
  const upi = form.querySelector('input[value=upi]');
  if (!s.allAcceptUpi) {
    upi.disabled = true;
    document.getElementById('upi-note').hidden = false;
    form.querySelector('input[value=cod]').checked = true;
  }

  summaryEl.innerHTML = `
    <h2 style="font-size:1.15rem">${esc(t('checkout.yourOrder'))}</h2>
    ${s.groups.map((g) => `
      <div style="margin-bottom:12px">
        <div class="cart-group-head small">${icon('store')}${esc(g.sellerName)}</div>
        ${g.items.map((i) => `<div class="summary-line small"><span>${esc(i.name)} × ${i.quantity}</span><span>${price(i.price * i.quantity)}</span></div>`).join('')}
      </div>`).join('')}
    <div class="summary-line"><span>${esc(t('cart.items', { n: Cart.count() }))}</span><span>${price(s.itemsTotal)}</span></div>
    <div class="summary-line"><span>${esc(t('cart.delivery'))}</span><span>${s.delivery ? price(s.delivery) : esc(t('delivery.free'))}</span></div>
    <div class="summary-line summary-total"><span>${esc(t('cart.total'))}</span><span>${price(s.total)}</span></div>
    ${s.groups.length > 1 ? `<p class="small muted">${icon('info')} ${esc(t('cart.multiSeller', { n: s.groups.length }))}</p>` : ''}`;

  const v = UI.validator(form, {
    fullName: (x) => (x.trim().length < 2 ? t('val.receiver') : ''),
    phone: (x) => (!/^[6-9]\d{9}$/.test(x.trim()) ? t('val.phone') : ''),
    addressLine: (x) => (x.trim().length < 5 ? t('val.address') : ''),
    city: (x) => (x.trim().length < 2 ? t('val.city') : ''),
    state: (x) => (x.trim().length < 2 ? t('val.state') : ''),
    pincode: (x) => (!/^[1-9]\d{5}$/.test(x.trim()) ? t('val.pincode') : ''),
    paymentMethod: (x) => (!x ? t('val.payment') : '')
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!v.validate()) return;
    const btn = form.querySelector('[type=submit]');
    UI.setLoading(btn, true);
    const shippingAddress = {
      fullName: form.fullName.value.trim(), phone: form.phone.value.trim(), addressLine: form.addressLine.value.trim(),
      city: form.city.value.trim(), state: form.state.value.trim(), pincode: form.pincode.value.trim()
    };
    try {
      const res = await API.post('/orders', {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod: form.paymentMethod.value,
        shippingAddress,
        customerNote: form.customerNote.value.trim()
      });
      try { localStorage.setItem(ADDRESS_KEY, JSON.stringify(shippingAddress)); } catch (e2) { /* ignore */ }
      Cart.clear(items.map((i) => i.productId));
      UI.toast(res.message, 'success');
      const orders = res.data;
      location.href = orders.length === 1 ? `/order-details.html?id=${orders[0]._id}&placed=1` : `/my-orders.html?placed=${orders.length}`;
    } catch (err) {
      UI.setLoading(btn, false);
      UI.formError(form, err);
      if (err.status === 409) Cart.sync();
    }
  });
});
