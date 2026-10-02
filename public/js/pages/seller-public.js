/* /seller.html?id= – public seller profile (only marketplace-safe information) */
App.page(async () => {
  const { esc, icon } = UI;
  const root = document.getElementById('seller-root');
  const id = UI.qs('id');
  root.innerHTML = UI.spinner();
  try {
    const { data } = await API.get(`/sellers/${id}`);
    const s = data.seller;
    document.title = `${s.businessName} – SHG Connect`;
    const cats = await Products.categories();
    const catNames = s.categories.map((slug) => Products.catName(cats.find((c) => c.slug === slug)) || slug);
    root.innerHTML = `
      <nav aria-label="${esc(t('common.breadcrumb'))}"><ol class="breadcrumb"><li><a href="/products.html">${esc(t('nav.explore'))}</a></li><li aria-current="page">${esc(s.businessName)}</li></ol></nav>
      <section class="card" style="margin-bottom:24px">
        <div class="seller-box" style="flex-wrap:wrap">
          <span class="avatar avatar-lg" style="width:96px;height:96px">${s.profileImage ? `<img src="${esc(s.profileImage)}" alt="${esc(s.businessName)}">` : esc(s.businessName[0])}</span>
          <div style="flex:1;min-width:220px">
            <h1 style="margin-bottom:6px">${esc(s.businessName)}</h1>
            <div class="row" style="gap:8px">
              <span class="seller-type">${esc(Products.sellerTypeLabel(s.sellerType))}</span>
              ${s.featured ? `<span class="tag tag-featured">${icon('award')}${esc(t('market.featuredArtisan'))}</span>` : ''}
            </div>
            <p class="muted" style="margin:8px 0 4px">${icon('map-pin')} ${esc(s.location)} · ${esc(t('seller.memberSince', { date: UI.date(s.memberSince, { month: 'long', year: 'numeric' }) }))}</p>
            ${UI.stars(s.rating, s.ratingCount)}
          </div>
          ${s.whatsapp ? `<a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${esc(UI.whatsappLink(s.whatsapp, t('seller.waText', { name: s.businessName })))}">${icon('message-circle')}<span>${esc(t('product.contactWhatsapp'))}</span></a>` : ''}
        </div>
        ${s.description ? `<h2 style="font-size:1.05rem;margin-top:18px">${esc(t('seller.about'))}</h2><p>${esc(s.description)}</p>` : ''}
        <dl class="kv">
          ${catNames.length ? `<dt>${esc(t('seller.categories'))}</dt><dd>${esc(catNames.join(', '))}</dd>` : ''}
          ${s.deliveryOptions.length ? `<dt>${esc(t('seller.delivery'))}</dt><dd>${esc(s.deliveryOptions.map((d) => t('delivery.' + d)).join(', '))}</dd>` : ''}
          <dt>${esc(t('seller.products'))}</dt><dd>${data.products.length}</dd>
        </dl>
      </section>
      <h2>${esc(t('seller.productsBy', { name: s.businessName }))}</h2>
      <div class="product-grid">${data.products.length ? data.products.map((p) => Products.ProductCard(p)).join('') : UI.emptyState({ title: t('seller.noProducts') })}</div>`;
  } catch (err) {
    root.innerHTML = err.status === 404 ? UI.emptyState({ icon: 'store', title: t('seller.notFound'), actionLabel: t('home.ctaExplore'), actionHref: '/products.html' }) : UI.errorState(err, () => location.reload());
  }
});
