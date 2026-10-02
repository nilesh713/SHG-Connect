/* /add-product.html (?id= to edit) – 3 short steps, image preview, Save Draft / Publish */
App.page(async () => {
  const { esc, icon, price } = UI;
  const form = document.getElementById('product-form');
  const editId = UI.qs('id');
  const MAX_FILES = 5;
  const MAX_MB = 5;
  const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  let step = 0;
  let existing = []; // URLs already saved (edit mode)
  let files = []; // new File objects

  // Categories
  const cats = await Products.categories();
  form.category.innerHTML = `<option value="">${esc(t('ap.chooseCategory'))}</option>` + cats.map((c) => `<option value="${esc(c.slug)}">${esc(Products.catName(c))}</option>`).join('');

  // Defaults from the seller profile
  const user = Auth.getUser();
  form.location.value = user.sellerProfile?.location || user.location || '';

  if (editId) {
    document.querySelector('.topbar h1').textContent = t('ap.editTitle');
    document.getElementById('ap-heading').textContent = t('ap.editTitle');
    try {
      const p = (await API.get(`/products/${editId}`)).data;
      if (String(p.sellerId) !== String(user._id)) throw new Error(t('ap.notYours'));
      ['name', 'category', 'description', 'price', 'quantity', 'location', 'deliveryOption', 'deliveryCharge'].forEach((f) => { if (p[f] !== undefined) form[f].value = p[f]; });
      form.discountPercent.value = p.discountPercent || '';
      form.tags.value = (p.tags || []).join(', ');
      existing = [...p.images];
      document.getElementById('status-note').innerHTML = `${esc(t('ap.currentStatus'))}: ${UI.badge(p.status)}`;
    } catch (err) {
      UI.toast(err.message, 'error');
      setTimeout(() => (location.href = '/seller-products.html'), 1200);
      return;
    }
  }

  // ----- Images -----
  const input = document.getElementById('images');
  const previews = document.getElementById('previews');
  const dz = document.getElementById('dropzone');
  const imgError = document.getElementById('images-error');

  function renderPreviews() {
    const all = [...existing.map((url) => ({ url, kind: 'existing' })), ...files.map((f, i) => ({ url: URL.createObjectURL(f), kind: 'new', i }))];
    previews.innerHTML = all.map((img, idx) => `
      <div class="image-preview">
        <img src="${esc(img.url)}" alt="${esc(t('ap.photoN', { n: idx + 1 }))}">
        ${idx === 0 ? `<span class="cover">${esc(t('ap.cover'))}</span>` : ''}
        <button type="button" data-remove-${img.kind}="${img.kind === 'new' ? img.i : esc(img.url)}" aria-label="${esc(t('ap.removePhoto', { n: idx + 1 }))}">${icon('x')}</button>
      </div>`).join('');
    document.getElementById('photo-count').textContent = t('ap.photoCount', { n: all.length, max: MAX_FILES });
  }

  function addFiles(list) {
    imgError.textContent = '';
    for (const f of list) {
      if (!TYPES.includes(f.type)) { imgError.textContent = t('ap.badType', { name: f.name }); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { imgError.textContent = t('ap.tooBig', { name: f.name, mb: MAX_MB }); continue; }
      if (existing.length + files.length >= MAX_FILES) { imgError.textContent = t('ap.tooMany', { max: MAX_FILES }); break; }
      files.push(f);
    }
    renderPreviews();
  }

  input.addEventListener('change', () => { addFiles([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  previews.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.removeNew !== undefined) files.splice(Number(b.dataset.removeNew), 1);
    if (b.dataset.removeExisting !== undefined) existing = existing.filter((u) => u !== b.dataset.removeExisting);
    renderPreviews();
  });
  renderPreviews();

  // ----- Live price preview -----
  const preview = document.getElementById('price-preview');
  function updatePrice() {
    const p = Number(form.price.value);
    const d = Number(form.discountPercent.value) || 0;
    if (!p) { preview.hidden = true; return; }
    preview.hidden = false;
    const final = Math.round(p * (1 - d / 100));
    preview.textContent = d ? t('ap.pricePreviewDiscount', { final: price(final), price: price(p), d }) : t('ap.pricePreview', { final: price(final) });
  }
  form.price.addEventListener('input', updatePrice);
  form.discountPercent.addEventListener('input', updatePrice);
  updatePrice();

  // Delivery charge only matters when delivery is offered
  const toggleCharge = () => { document.getElementById('charge-group').hidden = form.deliveryOption.value === 'pickup'; };
  form.deliveryOption.addEventListener('change', toggleCharge);
  toggleCharge();

  // ----- Validation (per step) -----
  const v = UI.validator(form, {
    name: (x) => (x.trim().length < 2 ? t('ap.val.name') : x.length > 100 ? t('ap.val.nameLong') : ''),
    category: (x) => (!x ? t('ap.val.category') : ''),
    price: (x) => (x === '' ? t('ap.val.price') : !(Number(x) >= 1) ? t('ap.val.priceMin') : Number(x) > 1000000 ? t('ap.val.priceMax') : ''),
    quantity: (x) => (x === '' ? t('ap.val.qty') : !Number.isInteger(Number(x)) || Number(x) < 0 ? t('ap.val.qtyNeg') : ''),
    discountPercent: (x) => (x !== '' && (Number(x) < 0 || Number(x) > 90) ? t('ap.val.discount') : ''),
    deliveryCharge: (x) => (x !== '' && Number(x) < 0 ? t('ap.val.charge') : ''),
    description: (x) => (x.length > 2000 ? t('ap.val.desc') : '')
  });
  const STEP_FIELDS = [['name', 'category'], ['price', 'quantity', 'discountPercent'], ['description', 'deliveryCharge']];

  const steps = [...form.querySelectorAll('.form-step')];
  const stepper = [...document.querySelectorAll('.stepper li')];
  function showStep(n) {
    step = n;
    steps.forEach((s, i) => s.classList.toggle('active', i === n));
    stepper.forEach((s, i) => {
      s.classList.toggle('active', i === n);
      s.classList.toggle('done', i < n);
      if (i === n) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
    });
    document.getElementById('prev-btn').hidden = n === 0;
    document.getElementById('next-btn').hidden = n === steps.length - 1;
    document.getElementById('publish-btn').hidden = n !== steps.length - 1;
    const heading = steps[n].querySelector('h2');
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  }
  document.getElementById('next-btn').addEventListener('click', () => {
    if (step === 0 && !existing.length && !files.length) {
      imgError.textContent = t('ap.val.photo');
      UI.toast(t('ap.val.photo'), 'error');
      return;
    }
    if (v.validate(STEP_FIELDS[step])) showStep(step + 1);
  });
  document.getElementById('prev-btn').addEventListener('click', () => showStep(step - 1));
  showStep(0);

  // ----- Submit -----
  async function submit(action, btn) {
    const fields = action === 'draft' ? ['name', 'category'] : STEP_FIELDS.flat();
    // For a draft we still need name, category, price and quantity for the database
    if (action === 'draft') {
      if (!form.price.value) form.price.value = 1;
      if (form.quantity.value === '') form.quantity.value = 0;
    }
    if (!v.validate(fields)) {
      const bad = STEP_FIELDS.findIndex((list) => list.some((f) => form[f].getAttribute('aria-invalid')));
      if (bad >= 0 && bad !== step) showStep(bad);
      return;
    }
    if (action === 'publish' && !existing.length && !files.length) {
      showStep(0);
      imgError.textContent = t('ap.val.photo');
      UI.toast(t('ap.val.photo'), 'error');
      return;
    }

    const fd = new FormData();
    ['name', 'category', 'description', 'price', 'quantity', 'location', 'deliveryOption', 'tags'].forEach((f) => fd.append(f, form[f].value.trim()));
    fd.append('discountPercent', form.discountPercent.value || '0');
    fd.append('deliveryCharge', form.deliveryOption.value === 'pickup' ? '0' : form.deliveryCharge.value || '0');
    fd.append('action', action);
    if (editId) fd.append('keepImages', JSON.stringify(existing));
    files.forEach((f) => fd.append('images', f));

    UI.setLoading(btn, true);
    try {
      const res = editId ? await API.put(`/products/${editId}`, fd) : await API.post('/products', fd);
      showSuccess(res, action);
    } catch (err) {
      UI.setLoading(btn, false);
      UI.formError(form, err);
      if (err.errors?.some((e) => e.field === 'images')) { showStep(0); imgError.textContent = err.message; }
    }
  }

  function showSuccess(res, action) {
    const p = res.data;
    document.getElementById('ap-root').innerHTML = `
      <div class="card text-center" style="max-width:560px;margin:0 auto">
        <div class="empty-icon" style="width:72px;height:72px;border-radius:50%;background:var(--success-bg);color:var(--success);display:grid;place-items:center;margin:0 auto 12px">${icon('circle-check')}</div>
        <h2>${esc(action === 'draft' ? t('ap.draftSaved') : editId ? t('ap.updated') : t('ap.published'))}</h2>
        <p class="muted">${esc(res.message)}</p>
        <div class="row" style="justify-content:center">
          ${p.status === 'approved' ? `<a class="btn btn-earth" href="/promotions.html?product=${esc(p._id)}">${icon('megaphone')}<span>${esc(t('ap.promoteNow'))}</span></a>
          <a class="btn btn-secondary" href="/product-details.html?id=${esc(p._id)}">${icon('eye')}<span>${esc(t('ap.viewLive'))}</span></a>` : ''}
          <a class="btn btn-primary" href="/add-product.html">${icon('plus')}<span>${esc(t('ap.addAnother'))}</span></a>
          <a class="btn btn-ghost" href="/seller-products.html">${esc(t('nav.myProducts'))}</a>
        </div>
      </div>`;
    window.scrollTo(0, 0);
  }

  document.getElementById('draft-btn').addEventListener('click', (e) => submit('draft', e.currentTarget));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step !== steps.length - 1) return document.getElementById('next-btn').click();
    submit('publish', document.getElementById('publish-btn'));
  });
});
