/* /products.html – search, filters, sorting, promoted products, pagination. State lives in the URL. */
App.page(async () => {
  const { esc, icon } = UI;
  const $ = (id) => document.getElementById(id);
  const form = $('filter-form');
  const grid = $('product-grid');
  const params = new URLSearchParams(location.search);

  const state = {
    q: params.get('q') || '',
    seller: params.get('seller') || '',
    category: params.get('category') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    location: params.get('location') || '',
    inStock: params.get('inStock') || '',
    promoted: params.get('promoted') || '',
    sort: params.get('sort') || 'newest',
    page: Number(params.get('page')) || 1
  };

  // ----- Fill filter controls -----
  const [cats, locs] = await Promise.all([
    Products.categories(),
    API.get('/products/locations').then((r) => r.data).catch(() => [])
  ]);
  $('f-category').innerHTML = `<option value="">${esc(t('market.allCategories'))}</option>` +
    cats.map((c) => `<option value="${esc(c.slug)}">${esc(Products.catName(c))} (${c.productCount})</option>`).join('');
  $('category-chips').innerHTML = [`<button type="button" class="chip" data-cat="">${esc(t('market.all'))}</button>`]
    .concat(cats.map((c) => `<button type="button" class="chip" data-cat="${esc(c.slug)}">${icon(c.icon)}${esc(Products.catName(c))}</button>`)).join('');
  $('f-location').innerHTML = `<option value="">${esc(t('market.allLocations'))}</option>` + locs.map((l) => `<option>${esc(l)}</option>`).join('');

  function syncControls() {
    $('search').value = state.q;
    form.seller.value = state.seller;
    form.category.value = state.category;
    form.minPrice.value = state.minPrice;
    form.maxPrice.value = state.maxPrice;
    form.location.value = state.location;
    form.inStock.checked = state.inStock === 'true';
    $('sort').value = state.sort;
    document.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.category)));
  }

  function writeUrl() {
    const p = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => {
      if (v && !(k === 'sort' && v === 'newest') && !(k === 'page' && v === 1)) p.set(k, v);
    });
    history.replaceState(null, '', `${location.pathname}${p.toString() ? '?' + p : ''}`);
  }

  const hasFilters = () => Boolean(state.q || state.seller || state.category || state.minPrice || state.maxPrice || state.location || state.inStock || state.promoted);

  function renderActiveFilters() {
    const chips = [];
    const add = (key, label) => chips.push(`<button type="button" data-clear="${key}">${esc(label)} ${icon('x')}<span class="sr-only">${esc(t('market.removeFilter'))}</span></button>`);
    if (state.q) add('q', `"${state.q}"`);
    if (state.seller) add('seller', `${t('market.seller')}: ${state.seller}`);
    if (state.category) add('category', Products.catName(cats.find((c) => c.slug === state.category)) || state.category);
    if (state.minPrice || state.maxPrice) add('price', `₹${state.minPrice || 0} – ${state.maxPrice ? '₹' + state.maxPrice : '∞'}`);
    if (state.location) add('location', state.location);
    if (state.inStock) add('inStock', t('market.inStockOnly'));
    if (state.promoted) add('promoted', t('market.promoted'));
    $('active-filters').innerHTML = chips.join('');
    $('active-filters').hidden = !chips.length;
  }

  async function load() {
    writeUrl();
    syncControls();
    renderActiveFilters();
    $('promo-section').hidden = hasFilters();
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = UI.spinner(t('market.loading'));
    try {
      const res = await API.get('/products', {
        q: state.q, seller: state.seller, category: state.category, minPrice: state.minPrice, maxPrice: state.maxPrice,
        location: state.location, inStock: state.inStock, promoted: state.promoted, sort: state.sort, page: state.page, limit: 12
      });
      const { total } = res.pagination;
      $('result-count').textContent = t('market.results', { n: total });
      grid.innerHTML = res.data.length
        ? res.data.map((p) => Products.ProductCard(p, { promo: state.promoted === 'true' })).join('')
        : UI.emptyState({ icon: 'search-x', title: t('market.noResults'), text: t('market.noResultsText') });
      UI.pagination($('pagination'), res.pagination, (page) => {
        state.page = page;
        load();
        $('results-top').scrollIntoView({ behavior: 'smooth' });
      });
    } catch (err) {
      grid.innerHTML = UI.errorState(err, load);
    } finally {
      grid.removeAttribute('aria-busy');
    }
  }

  // ----- Promoted products + featured artisans (survey: promotion & visibility) -----
  async function loadPromo() {
    try {
      const [promo, artisans] = await Promise.all([
        API.get('/products', { promoted: 'true', limit: 10 }),
        API.get('/sellers', { featured: 'true', limit: 4 })
      ]);
      $('promo-list').innerHTML = promo.data.length
        ? promo.data.map((p) => Products.ProductCard(p, { promo: true })).join('')
        : `<p class="muted">${esc(t('market.noPromoted'))}</p>`;
      $('artisan-list').innerHTML = artisans.data.map(Products.SellerCard).join('');
    } catch (e) {
      $('promo-section').hidden = true;
    }
  }

  // ----- Events -----
  const debouncedSearch = UI.debounce(() => { state.page = 1; load(); }, 400);
  $('search').addEventListener('input', (e) => { state.q = e.target.value.trim(); debouncedSearch(); });
  $('search-form').addEventListener('submit', (e) => { e.preventDefault(); state.q = $('search').value.trim(); state.page = 1; load(); });
  $('sort').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; load(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const min = form.minPrice.value;
    const max = form.maxPrice.value;
    if (min && max && Number(min) > Number(max)) return UI.toast(t('market.priceError'), 'error');
    Object.assign(state, {
      seller: form.seller.value.trim(), category: form.category.value, minPrice: min, maxPrice: max,
      location: form.location.value, inStock: form.inStock.checked ? 'true' : '', page: 1
    });
    load();
    if (window.innerWidth < 1024) $('filters-panel').classList.remove('open');
  });
  form.category.addEventListener('change', () => form.requestSubmit());
  form.location.addEventListener('change', () => form.requestSubmit());
  form.inStock.addEventListener('change', () => form.requestSubmit());
  form.seller.addEventListener('input', UI.debounce(() => form.requestSubmit(), 500));

  $('clear-filters').addEventListener('click', () => {
    Object.assign(state, { q: '', seller: '', category: '', minPrice: '', maxPrice: '', location: '', inStock: '', promoted: '', page: 1 });
    load();
  });
  $('category-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.category = b.dataset.cat;
    state.page = 1;
    load();
  });
  $('active-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-clear]');
    if (!b) return;
    const k = b.dataset.clear;
    if (k === 'price') { state.minPrice = ''; state.maxPrice = ''; } else state[k] = '';
    state.page = 1;
    load();
  });
  $('filters-toggle').addEventListener('click', () => {
    const panel = $('filters-panel');
    panel.classList.toggle('open');
    $('filters-toggle').setAttribute('aria-expanded', String(panel.classList.contains('open')));
  });

  loadPromo();
  await load();
});
