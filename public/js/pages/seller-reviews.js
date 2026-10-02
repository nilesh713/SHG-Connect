/* /reviews.html – reviews on the seller's products, with "report" for moderation */
App.page(async () => {
  const { esc, icon } = UI;
  const root = document.getElementById('reviews-root');
  const filter = document.getElementById('rating-filter');
  let page = 1;

  async function load() {
    root.innerHTML = UI.spinner();
    try {
      const res = await API.get('/reviews/seller', { rating: filter.value, page, limit: 20 });
      const d = res.data;
      document.getElementById('avg').innerHTML = d.count
        ? `<span class="stat-value">${d.average.toFixed(1)}</span> ${UI.stars(d.average)} <span class="muted">${esc(t('review.basedOn', { n: d.count }))}</span>`
        : `<span class="muted">${esc(t('review.noneYet'))}</span>`;
      if (!d.reviews.length) {
        root.innerHTML = UI.emptyState({ icon: 'star', title: t('review.noneSeller'), text: t('review.noneSellerText') });
        return;
      }
      root.innerHTML = d.reviews.map((r) => `
        <article class="card">
          <div class="review-head">
            ${r.product ? `<img src="${esc(UI.imageUrl(r.product.image))}" alt="" width="44" height="44" style="border-radius:8px;object-fit:cover">` : ''}
            <div style="flex:1;min-width:160px"><strong>${esc(r.product ? r.product.name : t('review.deletedProduct'))}</strong>
              <div class="small muted">${esc(r.customerName)} · ${esc(UI.date(r.createdAt))}</div></div>
            ${UI.stars(r.rating)}
            ${r.status !== 'approved' ? UI.badge(r.status) : ''}
          </div>
          <p style="margin:10px 0">${esc(r.comment || t('review.noComment'))}</p>
          ${r.status === 'approved' ? `<button type="button" class="btn btn-ghost btn-sm" data-report="${esc(r._id)}">${icon('flag')}<span>${esc(t('review.report'))}</span></button>` : r.status === 'flagged' ? `<p class="small muted">${esc(t('review.reportedNote'))}</p>` : ''}
        </article>`).join('');
      UI.pagination(document.getElementById('pagination'), res.pagination, (p) => { page = p; load(); });
    } catch (err) {
      root.innerHTML = UI.errorState(err, load);
    }
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-report]');
    if (!b) return;
    UI.modal({
      title: t('review.reportTitle'),
      body: `<p>${esc(t('review.reportText'))}</p><div class="form-group"><label for="rp-reason">${esc(t('review.reportReason'))}</label><input class="input" id="rp-reason" maxlength="200"></div>`,
      actions: [
        { label: t('common.cancel'), variant: 'btn-ghost' },
        {
          label: t('review.report'), variant: 'btn-primary', onClick: async ({ body }) => {
            try {
              const res = await API.put(`/reviews/${b.dataset.report}/report`, { reason: body.querySelector('#rp-reason').value.trim() });
              UI.toast(res.message, 'success');
              load();
            } catch (err) { UI.toast(err.message, 'error'); return false; }
          }
        }
      ]
    });
  });
  filter.addEventListener('change', () => { page = 1; load(); });
  await load();
});
