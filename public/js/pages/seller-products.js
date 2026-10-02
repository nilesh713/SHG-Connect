/* /seller-products.html – seller's own products (all statuses) */
App.page(async () => {
  const { esc, icon, price, number } = UI;
  const grid = document.getElementById('sp-grid');
  const tabs = document.getElementById('sp-tabs');
  const search = document.getElementById('sp-search');
  let status = '';
  let page = 1;

  async function load() {
    grid.innerHTML = UI.spinner();
    try {
      const res = await API.get('/products/mine', { status, q: search.value.trim(), page, limit: 24 });
      if (!res.data.length) {
        grid.innerHTML = status || search.value
          ? UI.emptyState({ icon: 'search-x', title: t('sp.noMatch') })
          : UI.emptyState({ icon: 'package-open', title: t('sp.none'), text: t('sp.noneText'), actionLabel: t('nav.addProduct'), actionHref: '/add-product.html' });
        UI.pagination(document.getElementById('pagination'), null);
        return;
      }
      grid.innerHTML = res.data.map((p) => `
        <article class="sp-card">
          <div class="sp-img"><img src="${esc(UI.imageUrl(p.images[0]))}" alt="${esc(p.name)}" loading="lazy">${UI.badge(p.status)}</div>
          <div class="sp-body">
            <strong>${esc(p.name)}</strong>
            <div class="price-row"><span class="price">${price(p.finalPrice)}</span>${p.discountPercent ? `<span class="price-old">${price(p.price)}</span>` : ''}</div>
            <div class="sp-stats">
              <span>${icon('boxes')} ${esc(t('sp.stock'))}: <strong style="color:${p.quantity ? 'inherit' : 'var(--error)'}">${number(p.quantity)}</strong></span>
              <span>${icon('eye')} ${number(p.views)}</span>
              <span>${icon('shopping-bag')} ${number(p.soldCount)}</span>
              ${p.promoted ? `<span class="tag tag-promoted">${esc(t('product.promoted'))}</span>` : ''}
              ${p.featured ? `<span class="tag tag-featured">${esc(t('product.featured'))}</span>` : ''}
            </div>
            ${p.status === 'rejected' && p.rejectionReason ? `<p class="small" style="color:var(--error);margin:0">${esc(t('sp.rejected'))}: ${esc(p.rejectionReason)}</p>` : ''}
            ${p.status === 'pending' ? `<p class="small muted" style="margin:0">${esc(t('sp.pendingNote'))}</p>` : ''}
            ${p.status === 'draft' ? `<button class="btn btn-primary btn-sm" type="button" data-publish="${esc(p._id)}" style="margin-top:6px">${icon('send')}<span>${esc(t('ap.publish'))}</span></button>` : ''}
          </div>
          <div class="sp-actions">
            <a class="btn btn-secondary" href="/add-product.html?id=${esc(p._id)}">${icon('pencil')}<span>${esc(t('common.edit'))}</span></a>
            ${p.status === 'approved' ? `<a class="btn btn-earth" href="/promotions.html?product=${esc(p._id)}">${icon('megaphone')}<span>${esc(t('sp.promote'))}</span></a>` : `<a class="btn btn-ghost" href="/product-details.html?id=${esc(p._id)}">${icon('eye')}<span>${esc(t('sp.preview'))}</span></a>`}
            <button class="btn btn-danger" type="button" data-delete="${esc(p._id)}" data-name="${esc(p.name)}">${icon('trash-2')}<span>${esc(t('common.delete'))}</span></button>
          </div>
        </article>`).join('');
      UI.pagination(document.getElementById('pagination'), res.pagination, (pg) => { page = pg; load(); });
    } catch (err) {
      grid.innerHTML = UI.errorState(err, load);
    }
  }

  grid.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-delete]');
    const pub = e.target.closest('[data-publish]');
    if (del) {
      const ok = await UI.confirm(t('sp.confirmDelete', { name: del.dataset.name }), { danger: true, confirmLabel: t('common.delete') });
      if (!ok) return;
      try {
        await API.del(`/products/${del.dataset.delete}`);
        UI.toast(t('sp.deleted'), 'success');
        load();
      } catch (err) { UI.toast(err.message, 'error'); }
    }
    if (pub) {
      const fd = new FormData();
      fd.append('action', 'publish');
      UI.setLoading(pub, true);
      try {
        const res = await API.put(`/products/${pub.dataset.publish}`, fd);
        UI.toast(res.message, 'success');
        load();
      } catch (err) {
        UI.setLoading(pub, false);
        UI.toast(err.message, 'error');
      }
    }
  });

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[role=tab]');
    if (!b) return;
    tabs.querySelectorAll('[role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    status = b.dataset.status;
    page = 1;
    load();
  });
  search.addEventListener('input', UI.debounce(() => { page = 1; load(); }, 400));
  await load();
});
