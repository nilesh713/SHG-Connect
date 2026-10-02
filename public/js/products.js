/* Product helpers: categories cache, reusable ProductCard and seller card. */
(function () {
  const { esc, icon, price, imageUrl } = UI;
  const cache = new Map(); // productId -> product (used by "Add to Cart" on cards)
  let categoriesPromise = null;

  function categories() {
    if (!categoriesPromise) {
      categoriesPromise = API.get('/categories', null, { auth: false })
        .then((r) => r.data)
        .catch(() => {
          categoriesPromise = null;
          return [];
        });
    }
    return categoriesPromise;
  }

  const catName = (c) => (c ? (I18N.lang === 'hi' && c.nameHi ? c.nameHi : c.name) : '');
  async function categoryLabel(slug) {
    const list = await categories();
    return catName(list.find((c) => c.slug === slug)) || slug;
  }

  const sellerTypeLabel = (type) => t(`role.${type}`);

  function stockText(p) {
    if (!p.quantity || p.quantity < 1) return `<span class="stock out">${esc(t('product.outOfStock'))}</span>`;
    if (p.quantity <= 5) return `<span class="stock low">${esc(t('product.onlyLeft', { n: p.quantity }))}</span>`;
    return `<span class="stock in">${esc(t('product.inStock'))}</span>`;
  }

  function priceHtml(p) {
    const final = p.finalPrice ?? p.price;
    return `<div class="price-row"><span class="price">${price(final)}</span>${p.discountPercent ? `<span class="price-old">${price(p.price)}</span>` : ''}</div>`;
  }

  /**
   * ProductCard – used on home page, marketplace, seller profile
   * opts.promo: link carries ?ref=promo so promotion clicks are counted
   */
  function ProductCard(p, opts = {}) {
    cache.set(p._id, p);
    const href = `/product-details.html?id=${encodeURIComponent(p._id)}${opts.promo ? '&ref=promo' : ''}`;
    const tags = [
      p.promoted ? `<span class="tag tag-promoted">${icon('megaphone')}${esc(t('product.promoted'))}</span>` : '',
      p.featured && !p.promoted ? `<span class="tag tag-featured">${icon('award')}${esc(t('product.featured'))}</span>` : '',
      p.discountPercent ? `<span class="tag tag-discount">${p.discountPercent}% ${esc(t('product.off'))}</span>` : ''
    ].join('');
    const out = !p.quantity || p.quantity < 1;
    return `
      <article class="product-card">
        <div class="product-media">
          <img src="${esc(imageUrl(p.images && p.images[0]))}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="300" height="300">
          <div class="product-tags">${tags}</div>
        </div>
        <div class="product-body">
          <h3 class="product-name"><a href="${href}">${esc(p.name)}</a></h3>
          <p class="product-seller" style="margin:0">${icon('store')}<span>${esc(p.seller ? p.seller.businessName : '')}</span></p>
          <p class="product-seller" style="margin:0">${icon('map-pin')}<span>${esc((p.seller && p.seller.location) || p.location || '')}</span></p>
          ${priceHtml(p)}
          <div class="meta-row">${UI.stars(p.rating, p.ratingCount)}${stockText(p)}</div>
        </div>
        <div class="product-actions">
          <a class="btn btn-secondary btn-sm" href="${href}">${esc(t('product.view'))}</a>
          <button class="btn btn-primary btn-sm" type="button" data-add-cart="${esc(p._id)}" ${out ? 'disabled' : ''}>${icon('shopping-cart')}<span>${esc(out ? t('product.soldOut') : t('product.addToCart'))}</span></button>
        </div>
      </article>`;
  }

  function SellerCard(s) {
    const initials = esc((s.businessName || s.name || '?').trim()[0]);
    return `
      <a class="seller-card" href="/seller.html?id=${encodeURIComponent(s._id)}">
        <span class="avatar avatar-lg" style="width:64px;height:64px;font-size:1.4rem">${s.profileImage ? `<img src="${esc(s.profileImage)}" alt="" loading="lazy">` : initials}</span>
        <span style="min-width:0">
          <strong>${esc(s.businessName)}</strong>
          <span class="seller-type">${esc(sellerTypeLabel(s.sellerType))}</span>
          <span class="small muted" style="display:block">${icon('map-pin')} ${esc(s.location)}</span>
          <span class="small muted">${UI.stars(s.rating, s.ratingCount)}${s.productCount !== undefined ? ` · ${s.productCount} ${esc(t('seller.products'))}` : ''}</span>
        </span>
      </a>`;
  }

  // One delegated listener handles every "Add to Cart" button on the page
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add-cart]');
    if (!btn) return;
    const p = cache.get(btn.dataset.addCart);
    if (p) Cart.add(p, 1);
  });

  window.Products = { cache, categories, categoryLabel, catName, sellerTypeLabel, stockText, priceHtml, ProductCard, SellerCard };
})();
