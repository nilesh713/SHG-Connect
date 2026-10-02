/* /product-details.html?id= – gallery, seller box, add to cart / buy now, WhatsApp, reviews */
App.page(async () => {
  const { esc, icon, price } = UI;
  const root = document.getElementById('product-root');
  const id = UI.qs('id');
  if (!id) {
    root.innerHTML = UI.emptyState({ icon: 'search-x', title: t('product.notFound'), actionLabel: t('home.ctaExplore'), actionHref: '/products.html' });
    return;
  }

  root.innerHTML = UI.spinner();
  let p;
  try {
    const ref = UI.qs('ref') === 'promo' ? 'promo' : undefined;
    p = (await API.get(`/products/${id}`, { ref })).data;
    // Strip ?ref=promo after counting the click so refreshes don't count again
    if (ref) history.replaceState(null, '', `${location.pathname}?id=${encodeURIComponent(id)}`);
  } catch (err) {
    root.innerHTML = err.status === 404
      ? UI.emptyState({ icon: 'search-x', title: t('product.notFound'), text: t('product.notFoundText'), actionLabel: t('home.ctaExplore'), actionHref: '/products.html' })
      : UI.errorState(err, () => location.reload());
    return;
  }

  document.title = `${p.name} – SHG Connect`;
  Products.cache.set(p._id, p);
  const catLabel = await Products.categoryLabel(p.category);
  const images = p.images.length ? p.images : ['/assets/placeholder.svg'];
  const out = p.quantity < 1;
  const user = Auth.getUser();
  const isOwner = user && String(user._id) === String(p.sellerId);
  const productUrl = `${location.origin}/product-details.html?id=${p._id}`;
  const deliveryText = t(`delivery.${p.deliveryOption}`) + (p.deliveryOption !== 'pickup' ? ` · ${p.deliveryCharge ? price(p.deliveryCharge) : t('delivery.free')}` : '');
  const draftNote = p.status !== 'approved' ? `<div class="alert alert-warning">${icon('eye-off')}<p>${esc(t('product.notPublic', { status: t('status.' + p.status) }))}</p></div>` : '';

  root.innerHTML = `
    <nav aria-label="${esc(t('common.breadcrumb'))}"><ol class="breadcrumb">
      <li><a href="/index.html">${esc(t('nav.home'))}</a></li>
      <li><a href="/products.html">${esc(t('nav.explore'))}</a></li>
      <li><a href="/products.html?category=${encodeURIComponent(p.category)}">${esc(catLabel)}</a></li>
      <li aria-current="page">${esc(p.name)}</li>
    </ol></nav>
    ${draftNote}
    <div class="pd-grid">
      <div>
        <div class="gallery-main"><img id="main-img" src="${esc(images[0])}" alt="${esc(p.name)}" width="600" height="600"></div>
        ${images.length > 1 ? `<div class="thumbs" role="group" aria-label="${esc(t('product.photos'))}">${images.map((src, i) => `
          <button type="button" data-img="${esc(src)}" aria-current="${i === 0}" aria-label="${esc(t('product.photoN', { n: i + 1 }))}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <div class="pd-info">
        <div class="row" style="margin-bottom:8px">
          <a class="seller-type" href="/products.html?category=${encodeURIComponent(p.category)}">${esc(catLabel)}</a>
          ${p.promoted ? `<span class="tag tag-promoted">${icon('megaphone')}${esc(t('product.promoted'))}</span>` : ''}
          ${p.featured ? `<span class="tag tag-featured">${icon('award')}${esc(t('product.featured'))}</span>` : ''}
        </div>
        <h1>${esc(p.name)}</h1>
        <a href="#reviews">${UI.stars(p.rating, p.ratingCount)}</a>
        <div style="margin:14px 0 6px">
          <span class="pd-price">${price(p.finalPrice)}</span>
          ${p.discountPercent ? `<span class="price-old">${price(p.price)}</span> <span class="tag tag-discount">${p.discountPercent}% ${esc(t('product.off'))}</span>` : ''}
        </div>
        <dl class="pd-meta">
          <dt>${icon('package')}${esc(t('product.availability'))}</dt><dd>${Products.stockText(p)}${p.quantity > 0 ? ` <span class="muted small">(${p.quantity} ${esc(t('product.available'))})</span>` : ''}</dd>
          <dt>${icon('truck')}${esc(t('product.delivery'))}</dt><dd>${esc(deliveryText)}</dd>
          <dt>${icon('map-pin')}${esc(t('product.location'))}</dt><dd>${esc(p.location || p.seller.location)}</dd>
        </dl>
        ${isOwner ? `<div class="alert alert-info">${icon('info')}<p>${esc(t('product.yourProduct'))} <a href="/add-product.html?id=${esc(p._id)}">${esc(t('common.edit'))}</a></p></div>` : `
        <div class="row">
          <span class="label" id="qty-label">${esc(t('product.quantity'))}</span>
          <div class="qty" role="group" aria-labelledby="qty-label">
            <button type="button" data-qty="-1" aria-label="${esc(t('product.decrease'))}" ${out ? 'disabled' : ''}>−</button>
            <input id="qty" type="number" inputmode="numeric" min="1" max="${p.quantity}" value="1" aria-label="${esc(t('product.quantity'))}" ${out ? 'disabled' : ''}>
            <button type="button" data-qty="1" aria-label="${esc(t('product.increase'))}" ${out ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div class="pd-actions">
          <button class="btn btn-secondary btn-lg" type="button" id="add-cart" ${out ? 'disabled' : ''}>${icon('shopping-cart')}<span>${esc(t('product.addToCart'))}</span></button>
          <button class="btn btn-primary btn-lg" type="button" id="buy-now" ${out ? 'disabled' : ''}>${icon('zap')}<span>${esc(t('product.buyNow'))}</span></button>
        </div>`}
        <div class="row">
          ${p.seller.whatsapp ? `<a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${esc(UI.whatsappLink(p.seller.whatsapp, t('product.waContactText', { name: p.name, url: productUrl })))}">${icon('message-circle')}<span>${esc(t('product.contactWhatsapp'))}</span></a>` : ''}
          <a class="btn btn-ghost" href="/seller.html?id=${esc(p.sellerId)}">${icon('store')}<span>${esc(t('product.contactSeller'))}</span></a>
          <a class="btn btn-ghost" target="_blank" rel="noopener" href="${esc(UI.whatsappShare(t('product.waShareText', { name: p.name, price: price(p.finalPrice), url: productUrl })))}">${icon('share-2')}<span>${esc(t('product.shareWhatsapp'))}</span></a>
        </div>
      </div>
    </div>

    <div class="dash-grid two" style="margin-bottom:24px">
      <section class="card" aria-labelledby="desc-title">
        <h2 id="desc-title" class="h3" style="font-size:1.15rem">${esc(t('product.description'))}</h2>
        <p style="white-space:pre-line">${esc(p.description || t('product.noDescription'))}</p>
        ${p.tags && p.tags.length ? `<div class="row">${p.tags.map((tg) => `<a class="chip" href="/products.html?q=${encodeURIComponent(tg)}">#${esc(tg)}</a>`).join('')}</div>` : ''}
      </section>
      <section class="card" aria-labelledby="seller-title">
        <h2 id="seller-title" style="font-size:1.15rem">${esc(t('product.aboutSeller'))}</h2>
        <div class="seller-box">
          <span class="avatar avatar-lg">${p.seller.profileImage ? `<img src="${esc(p.seller.profileImage)}" alt="">` : esc(p.seller.businessName[0])}</span>
          <div>
            <a href="/seller.html?id=${esc(p.sellerId)}"><strong>${esc(p.seller.businessName)}</strong></a>
            <div><span class="seller-type">${esc(Products.sellerTypeLabel(p.seller.sellerType))}</span></div>
            <p class="small muted" style="margin:4px 0">${icon('map-pin')} ${esc(p.seller.location)}</p>
          </div>
        </div>
        <p class="small" style="margin-top:12px">${esc(p.seller.description || '')}</p>
        <a class="btn btn-secondary btn-sm" href="/seller.html?id=${esc(p.sellerId)}">${esc(t('product.viewSellerProducts'))}</a>
      </section>
    </div>

    <section class="card" id="reviews" aria-labelledby="reviews-title">
      <div class="card-title"><h2 id="reviews-title">${esc(t('product.reviews'))}</h2></div>
      <div id="review-form-slot"></div>
      <div id="reviews-body">${UI.spinner()}</div>
    </section>`;

  // Gallery
  root.querySelectorAll('[data-img]').forEach((b) => b.addEventListener('click', () => {
    document.getElementById('main-img').src = b.dataset.img;
    root.querySelectorAll('[data-img]').forEach((x) => x.setAttribute('aria-current', String(x === b)));
  }));

  // Quantity & cart
  const qtyInput = document.getElementById('qty');
  const clampQty = () => {
    const v = Math.max(1, Math.min(p.quantity, parseInt(qtyInput.value, 10) || 1));
    qtyInput.value = v;
    return v;
  };
  if (qtyInput) {
    root.querySelectorAll('[data-qty]').forEach((b) => b.addEventListener('click', () => {
      qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + Number(b.dataset.qty);
      clampQty();
    }));
    qtyInput.addEventListener('change', clampQty);
    document.getElementById('add-cart').addEventListener('click', () => Cart.add(p, clampQty()));
    document.getElementById('buy-now').addEventListener('click', () => {
      const items = Cart.items();
      const inCart = items.find((i) => i.productId === p._id);
      if (!inCart) Cart.add(p, clampQty());
      location.href = Auth.isLoggedIn() ? '/checkout.html' : '/login.html?next=' + encodeURIComponent('/checkout.html');
    });
  }

  // ----- Reviews -----
  async function loadReviews() {
    const body = document.getElementById('reviews-body');
    try {
      const { data } = await API.get(`/products/${p._id}/reviews`, { limit: 20 });
      if (!data.count) {
        body.innerHTML = `<p class="muted">${esc(t('review.none'))}</p>`;
        return;
      }
      body.innerHTML = `
        <div class="rating-summary">
          <div><div class="rating-big">${data.average.toFixed(1)}</div>${UI.stars(data.average)}<p class="muted small">${esc(t('review.basedOn', { n: data.count }))}</p></div>
          <div aria-label="${esc(t('review.distribution'))}">
            ${[5, 4, 3, 2, 1].map((s) => `<div class="dist-row"><span>${s} ★</span><div class="dist-bar"><span style="width:${(data.distribution[s] / data.count) * 100}%"></span></div><span>${data.distribution[s]}</span></div>`).join('')}
          </div>
        </div>
        <div style="margin-top:16px">${data.reviews.map((r) => `
          <article class="review"><div class="review-head">${UI.stars(r.rating)}<strong>${esc(r.customerName)}</strong><span class="small muted">${esc(UI.date(r.createdAt))}</span><span class="badge badge-success">${esc(t('review.verified'))}</span></div>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}</article>`).join('')}</div>`;
    } catch (err) {
      body.innerHTML = UI.errorState(err, loadReviews);
    }
  }

  async function reviewForm() {
    const slot = document.getElementById('review-form-slot');
    if (!Auth.isLoggedIn() || isOwner) return;
    try {
      const { data } = await API.get(`/reviews/can-review/${p._id}`);
      if (data.alreadyReviewed) {
        slot.innerHTML = `<div class="alert alert-success">${icon('circle-check')}<p>${esc(t('review.thanksAlready'))}</p></div>`;
        return;
      }
      if (!data.canReview) {
        slot.innerHTML = `<p class="small muted">${icon('info')} ${esc(t('review.afterDelivery'))}</p>`;
        return;
      }
      slot.innerHTML = `
        <form id="review-form" class="card" style="background:var(--green-50);margin-bottom:16px">
          <h3>${esc(t('review.write'))}</h3>
          <div class="form-group">${UI.starInput('rating')}</div>
          <div class="form-group"><label for="rv-comment">${esc(t('review.comment'))}</label>
            <textarea class="input" id="rv-comment" name="comment" maxlength="1000" placeholder="${esc(t('review.commentPh'))}"></textarea></div>
          <button class="btn btn-primary" type="submit">${icon('send')}<span>${esc(t('review.submit'))}</span></button>
        </form>`;
      const form = document.getElementById('review-form');
      const v = UI.validator(form, { rating: (val) => (!val ? t('review.chooseRating') : '') });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!v.validate()) return;
        const btn = form.querySelector('[type=submit]');
        UI.setLoading(btn, true);
        try {
          const res = await API.post('/reviews', { productId: p._id, rating: Number(form.rating.value), comment: form.comment.value.trim() });
          UI.toast(res.message, 'success');
          slot.innerHTML = `<div class="alert alert-success">${icon('circle-check')}<p>${esc(t('review.thanks'))}</p></div>`;
          loadReviews();
        } catch (err) {
          UI.setLoading(btn, false);
          UI.formError(form, err);
        }
      });
    } catch (e) { /* not critical */ }
  }

  await Promise.all([loadReviews(), reviewForm()]);
});
