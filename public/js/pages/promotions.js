/* /promotions.html – internal (free) promotion: promote, feature, discount + stats */
App.page(async () => {
  const { esc, icon, number, price } = UI;
  const form = document.getElementById('promo-form');
  const list = document.getElementById('promo-list');

  // Only live products can be promoted
  const products = (await API.get('/products/mine', { status: 'approved', limit: 100 })).data;
  if (!products.length) {
    form.innerHTML = UI.emptyState({ icon: 'package-open', title: t('promo.noLive'), text: t('promo.noLiveText'), actionLabel: t('nav.addProduct'), actionHref: '/add-product.html' });
  } else {
    form.productId.innerHTML = `<option value="">${esc(t('promo.chooseProduct'))}</option>` +
      products.map((p) => `<option value="${esc(p._id)}">${esc(p.name)} – ${price(p.price)}</option>`).join('');
    const pre = UI.qs('product');
    if (pre) form.productId.value = pre;

    const discountGroup = document.getElementById('discount-group');
    const syncType = () => { discountGroup.hidden = form.type.value !== 'discount'; };
    form.querySelectorAll('input[name=type]').forEach((r) => r.addEventListener('change', syncType));
    syncType();

    const v = UI.validator(form, {
      productId: (x) => (!x ? t('promo.val.product') : ''),
      type: (x) => (!x ? t('promo.val.type') : ''),
      durationDays: (x) => (!x ? t('promo.val.duration') : ''),
      discountPercent: (x) => (form.type.value === 'discount' && !(Number(x) >= 5 && Number(x) <= 90) ? t('promo.val.discount') : '')
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!v.validate()) return;
      const btn = form.querySelector('[type=submit]');
      UI.setLoading(btn, true);
      try {
        const res = await API.post('/promotions', {
          productId: form.productId.value,
          type: form.type.value,
          durationDays: Number(form.durationDays.value),
          discountPercent: form.type.value === 'discount' ? Number(form.discountPercent.value) : undefined
        });
        UI.toast(res.message, 'success');
        load();
      } catch (err) {
        UI.formError(form, err);
      } finally {
        UI.setLoading(btn, false);
      }
    });
  }

  async function load() {
    list.innerHTML = UI.spinner();
    try {
      const { data } = await API.get('/promotions');
      if (!data.length) {
        list.innerHTML = UI.emptyState({ icon: 'megaphone', title: t('promo.none'), text: t('promo.noneText') });
        return;
      }
      list.innerHTML = data.map((p) => `
        <article class="card">
          <div class="review-head">
            <img src="${esc(UI.imageUrl(p.product?.image))}" alt="" width="52" height="52" style="border-radius:10px;object-fit:cover">
            <div style="flex:1;min-width:160px"><strong>${esc(p.product?.name || '')}</strong>
              <div class="small muted">${esc(UI.date(p.startDate))} – ${esc(UI.date(p.endDate))}</div></div>
            <span class="tag ${p.type === 'featured' ? 'tag-featured' : p.type === 'discount' ? 'tag-discount' : 'tag-promoted'}">${esc(t('promo.type.' + p.type))}${p.type === 'discount' ? ` ${p.discountPercent}%` : ''}</span>
            ${p.active ? `<span class="badge badge-success">${esc(t('promo.activeDays', { n: p.daysLeft }))}</span>` : UI.badge('ended')}
          </div>
          <div class="promo-stats" style="margin:12px 0">
            <span><strong>${number(p.views)}</strong>${esc(t('promo.views'))}</span>
            <span><strong>${number(p.clicks)}</strong>${esc(t('promo.clicks'))}</span>
            <span><strong>${number(p.orders)}</strong>${esc(t('promo.orders'))}</span>
          </div>
          ${p.active ? `<div class="row">
            <button class="btn btn-secondary btn-sm" type="button" data-extend="${esc(p._id)}">${icon('calendar-plus')}<span>${esc(t('promo.extend'))}</span></button>
            <button class="btn btn-danger btn-sm" type="button" data-stop="${esc(p._id)}">${icon('circle-stop')}<span>${esc(t('promo.stop'))}</span></button></div>` : ''}
        </article>`).join('');
    } catch (err) {
      list.innerHTML = UI.errorState(err, load);
    }
  }

  list.addEventListener('click', async (e) => {
    const stop = e.target.closest('[data-stop]');
    const ext = e.target.closest('[data-extend]');
    try {
      if (stop) {
        if (!(await UI.confirm(t('promo.confirmStop'), { danger: true }))) return;
        UI.toast((await API.put(`/promotions/${stop.dataset.stop}`, { action: 'stop' })).message, 'success');
        load();
      }
      if (ext) {
        UI.toast((await API.put(`/promotions/${ext.dataset.extend}`, { action: 'extend', days: 7 })).message, 'success');
        load();
      }
    } catch (err) { UI.toast(err.message, 'error'); }
  });
  await load();
});
