/* /order-details.html?id= – delivery tracking timeline + role-based actions
   customer: UPI payment (demo), cancel, review · seller/admin: next step, cancel, payment status */
App.page(async () => {
  const { esc, icon, price } = UI;
  const root = document.getElementById('order-root');
  const id = UI.qs('id');

  async function load() {
    root.innerHTML = UI.spinner();
    let o;
    try {
      o = (await API.get(`/orders/${id}`)).data;
    } catch (err) {
      root.innerHTML = err.status === 404 || err.status === 403 || err.status === 400
        ? UI.emptyState({ icon: 'search-x', title: t('order.notFound'), actionLabel: t('nav.myOrders'), actionHref: '/my-orders.html' })
        : UI.errorState(err, load);
      return;
    }
    document.title = `${t('orders.order')} #${o.orderNumber} – SHG Connect`;
    render(o);
  }

  function render(o) {
    const role = o.viewerRole;
    const isCustomer = role === 'customer';
    const isSellerSide = role === 'seller' || role === 'admin';
    const cancelled = o.orderStatus === 'cancelled';
    const needsUpi = isCustomer && o.paymentMethod === 'upi' && o.paymentStatus !== 'paid' && !cancelled;
    const backHref = isCustomer ? '/my-orders.html' : role === 'admin' ? '/admin-dashboard.html#orders' : '/orders.html';

    root.innerHTML = `
      <a class="btn btn-ghost btn-sm" href="${backHref}">${icon('arrow-left')}<span>${esc(t('common.back'))}</span></a>
      ${UI.qs('placed') ? `<div class="alert alert-success" style="margin-top:12px">${icon('party-popper')}<div><strong>${esc(t('order.placedTitle'))}</strong><p>${esc(t('order.placedText'))}</p></div></div>` : ''}
      <div class="order-head" style="margin:12px 0 4px">
        <div><h1 style="margin:0">${esc(t('orders.order'))} #${esc(o.orderNumber)}</h1>
          <p class="muted" style="margin:0">${esc(t('order.placedOn', { date: UI.dateTime(o.createdAt) }))}</p></div>
        <div class="row">${UI.badge(o.orderStatus)} ${UI.badge(o.paymentStatus)}</div>
      </div>

      <div class="order-layout">
        <div class="stack">
          ${isSellerSide && !cancelled && o.orderStatus !== 'delivered' ? `
            <section class="next-step" aria-labelledby="ns-title">
              <h3 id="ns-title">${icon('footprints')}${esc(t('order.nextStep'))}</h3>
              <p class="small">${esc(t(`order.hint.${o.orderStatus}`))}</p>
              <div class="row">${Orders.nextActionButton(o, 'btn btn-primary btn-lg')}
                ${Orders.canSellerCancel(o) || role === 'admin' ? `<button class="btn btn-danger" type="button" data-cancel>${icon('circle-x')}<span>${esc(t('order.action.cancel'))}</span></button>` : ''}</div>
            </section>` : ''}

          ${needsUpi ? upiSection(o) : ''}

          <section class="card" aria-labelledby="track-title">
            <div class="card-title"><h2 id="track-title">${icon('truck')} ${esc(t('order.tracking'))}</h2></div>
            ${Orders.timeline(o, isCustomer ? 'customer' : 'seller')}
            ${o.deliveryInfo && (o.deliveryInfo.partner || o.deliveryInfo.trackingId || o.deliveryInfo.expectedDate) ? `
              <dl class="kv" style="margin-top:16px">
                ${o.deliveryInfo.partner ? `<dt>${esc(t('order.deliveryPartner'))}</dt><dd>${esc(o.deliveryInfo.partner)}</dd>` : ''}
                ${o.deliveryInfo.trackingId ? `<dt>${esc(t('order.trackingId'))}</dt><dd>${esc(o.deliveryInfo.trackingId)}</dd>` : ''}
                ${o.deliveryInfo.expectedDate ? `<dt>${esc(t('order.expectedDate'))}</dt><dd>${esc(UI.date(o.deliveryInfo.expectedDate))}</dd>` : ''}
              </dl>` : ''}
            <p class="small muted" style="margin:14px 0 0">${icon('info')} ${esc(t('order.trackingNote'))}</p>
          </section>

          <section class="card order-items" aria-labelledby="items-title">
            <h2 id="items-title" style="font-size:1.1rem">${esc(t('order.items'))}</h2>
            ${o.items.map((i) => `
              <div class="cart-item">
                <img src="${esc(UI.imageUrl(i.image))}" alt="${esc(i.name)}" loading="lazy">
                <div><a href="/product-details.html?id=${esc(i.productId)}">${esc(i.name)}</a><div class="small muted">${price(i.price)} × ${i.quantity}</div>
                  ${isCustomer && o.orderStatus === 'delivered' ? (o.reviewedProductIds || []).includes(String(i.productId))
                    ? `<span class="small" style="color:var(--success)">${icon('circle-check')} ${esc(t('review.done'))}</span>`
                    : `<a class="btn btn-secondary btn-sm" style="margin-top:6px" href="/product-details.html?id=${esc(i.productId)}#reviews">${icon('star')}<span>${esc(t('orders.review'))}</span></a>` : ''}
                </div>
                <strong>${price(i.subtotal)}</strong>
              </div>`).join('')}
          </section>
        </div>

        <aside class="stack">
          <section class="card" aria-labelledby="pay-title">
            <h2 id="pay-title" style="font-size:1.1rem">${esc(t('order.payment'))}</h2>
            <div class="summary-line"><span>${esc(t('order.itemsTotal'))}</span><span>${price(o.itemsTotal)}</span></div>
            <div class="summary-line"><span>${esc(t('cart.delivery'))}</span><span>${o.deliveryCharge ? price(o.deliveryCharge) : esc(t('delivery.free'))}</span></div>
            <div class="summary-line summary-total"><span>${esc(t('cart.total'))}</span><span>${price(o.totalAmount)}</span></div>
            <dl class="kv" style="margin-top:12px">
              <dt>${esc(t('order.method'))}</dt><dd>${esc(Orders.paymentLabel(o.paymentMethod))}</dd>
              <dt>${esc(t('order.paymentStatus'))}</dt><dd>${UI.badge(o.paymentStatus)}</dd>
              ${o.paymentReference ? `<dt>${esc(t('order.reference'))}</dt><dd>${esc(o.paymentReference)}</dd>` : ''}
              ${o.paidAt ? `<dt>${esc(t('order.paidOn'))}</dt><dd>${esc(UI.date(o.paidAt))}</dd>` : ''}
            </dl>
            ${isSellerSide ? paymentActions(o) : ''}
          </section>

          <section class="card" aria-labelledby="addr-title">
            <h2 id="addr-title" style="font-size:1.1rem">${esc(isCustomer ? t('order.deliverTo') : t('order.customer'))}</h2>
            <p style="margin:0"><strong>${esc(o.shippingAddress.fullName)}</strong><br>${esc(o.shippingAddress.addressLine)}<br>${esc(o.shippingAddress.city)}, ${esc(o.shippingAddress.state)} – ${esc(o.shippingAddress.pincode)}<br>${icon('phone')} ${esc(o.shippingAddress.phone)}</p>
            ${isSellerSide ? `<a class="btn btn-whatsapp btn-sm" style="margin-top:10px" target="_blank" rel="noopener" href="${esc(UI.whatsappLink('91' + o.shippingAddress.phone, t('order.waCustomer', { name: o.shippingAddress.fullName, order: o.orderNumber, status: Orders.statusLabel(o.orderStatus) })))}">${icon('message-circle')}<span>${esc(t('order.messageCustomer'))}</span></a>` : ''}
            ${o.customerNote ? `<p class="small" style="margin-top:10px"><strong>${esc(t('order.customerNote'))}:</strong> ${esc(o.customerNote)}</p>` : ''}
          </section>

          <section class="card">
            <h2 style="font-size:1.1rem">${esc(t('order.seller'))}</h2>
            <p style="margin:0"><a href="/seller.html?id=${esc(o.sellerId)}">${esc(o.sellerName)}</a><br><span class="small muted">${esc(o.sellerLocation)}</span></p>
            ${isCustomer && ['new', 'confirmed'].includes(o.orderStatus) ? `<button class="btn btn-danger btn-sm" style="margin-top:12px" type="button" data-cancel>${icon('circle-x')}<span>${esc(t('order.action.cancel'))}</span></button>` : ''}
          </section>
        </aside>
      </div>`;

    bind(o);
    if (location.hash === '#pay') document.getElementById('pay')?.scrollIntoView();
  }

  function upiSection(o) {
    if (o.paymentReference) {
      return `<section class="alert alert-info" id="pay">${icon('hourglass')}<div><strong>${esc(t('upi.waiting'))}</strong><p>${esc(t('upi.waitingText', { ref: o.paymentReference }))}</p></div></section>`;
    }
    return `
      <section class="card upi-box" id="pay" aria-labelledby="upi-title">
        <h2 id="upi-title">${icon('smartphone')} ${esc(t('upi.title'))}</h2>
        <p>${esc(t('upi.step1', { amount: price(o.totalAmount) }))}</p>
        <div id="upi-qr">${UI.spinner(t('upi.loading'))}</div>
        <form id="ref-form" class="stack" style="text-align:left;max-width:420px;margin:16px auto 0">
          <div class="form-group"><label for="upi-ref">${esc(t('upi.refLabel'))}</label>
            <input class="input" id="upi-ref" name="reference" autocomplete="off" maxlength="30" placeholder="${esc(t('upi.refPh'))}">
            <span class="hint">${icon('info')}${esc(t('upi.refHint'))}</span></div>
          <button type="submit" class="btn btn-primary btn-block">${icon('send')}<span>${esc(t('upi.submit'))}</span></button>
        </form>
        <p class="small muted" style="margin-top:14px">${icon('shield-check')} ${esc(t('upi.demoNote'))}</p>
      </section>`;
  }

  function paymentActions(o) {
    if (o.orderStatus === 'cancelled' && o.paymentStatus !== 'paid') return '';
    const btns = [];
    if (o.paymentStatus !== 'paid') {
      btns.push(`<button class="btn btn-primary btn-sm" type="button" data-pay="paid">${icon('circle-check')}<span>${esc(t('pay.markPaid'))}</span></button>`);
      if (o.paymentMethod === 'upi' && o.paymentStatus !== 'failed') btns.push(`<button class="btn btn-danger btn-sm" type="button" data-pay="failed">${icon('circle-x')}<span>${esc(t('pay.notReceived'))}</span></button>`);
    } else if (o.orderStatus === 'cancelled') {
      btns.push(`<button class="btn btn-secondary btn-sm" type="button" data-pay="refunded">${icon('undo-2')}<span>${esc(t('pay.markRefunded'))}</span></button>`);
    }
    return btns.length ? `<div class="row" style="margin-top:12px">${btns.join('')}</div>${o.paymentMethod === 'upi' && o.paymentStatus !== 'paid' ? `<p class="small muted" style="margin-top:8px">${esc(t('pay.verifyHint'))}</p>` : ''}` : '';
  }

  function bind(o) {
    root.querySelector('[data-advance]')?.addEventListener('click', async (e) => {
      const updated = await Orders.advance(o, e.currentTarget.dataset.status);
      if (updated) load();
    });
    root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
      const updated = await Orders.advance(o, 'cancelled');
      if (updated) load();
    }));
    root.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', async () => {
      const status = b.dataset.pay;
      const ok = await UI.confirm(t(`pay.confirm.${status}`, { order: o.orderNumber, amount: price(o.totalAmount) }), { danger: status === 'failed' });
      if (!ok) return;
      try {
        const res = await API.put(`/orders/${o._id}/payment`, { paymentStatus: status });
        UI.toast(res.message, 'success');
        load();
      } catch (err) { UI.toast(err.message, 'error'); }
    }));

    // UPI QR + reference form (customer)
    const qrBox = document.getElementById('upi-qr');
    if (qrBox) {
      API.get(`/orders/${o._id}/upi`).then(({ data }) => {
        qrBox.innerHTML = `
          <img src="${esc(data.qr)}" alt="${esc(t('upi.qrAlt', { upi: data.upiId }))}" width="220" height="220">
          <dl class="kv" style="justify-content:center;max-width:360px;margin:0 auto 12px;text-align:left">
            <dt>${esc(t('upi.payTo'))}</dt><dd>${esc(data.payeeName)}</dd>
            <dt>${esc(t('upi.upiId'))}</dt><dd>${esc(data.upiId)}</dd>
            <dt>${esc(t('cart.total'))}</dt><dd>${price(data.amount)}</dd>
          </dl>
          <a class="btn btn-earth" href="${esc(data.link)}">${icon('smartphone')}<span>${esc(t('upi.openApp'))}</span></a>
          <p class="small muted" style="margin-top:6px">${esc(t('upi.openAppHint'))}</p>`;
      }).catch((err) => { qrBox.innerHTML = `<div class="alert alert-warning">${icon('triangle-alert')}<p>${esc(err.message)}</p></div>`; });

      const form = document.getElementById('ref-form');
      const v = UI.validator(form, { reference: (x) => (!/^[A-Za-z0-9]{6,30}$/.test(x.trim()) ? t('upi.refError') : '') });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!v.validate()) return;
        const btn = form.querySelector('[type=submit]');
        UI.setLoading(btn, true);
        try {
          const res = await API.post(`/orders/${o._id}/payment-reference`, { reference: form.reference.value.trim() });
          UI.toast(res.message, 'success');
          load();
        } catch (err) {
          UI.setLoading(btn, false);
          UI.formError(form, err);
        }
      });
    }
  }

  // Refresh when a notification about this order arrives
  document.addEventListener('notification:new', (e) => {
    if (e.detail && e.detail.link && e.detail.link.includes(id)) load();
  });

  await load();
});
