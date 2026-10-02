/* /profile.html – personal details for everyone + business profile for sellers */
App.page(async () => {
  const { esc, icon } = UI;
  const form = document.getElementById('profile-form');
  const isSeller = Auth.isSeller();
  document.getElementById('seller-fields').hidden = !isSeller;
  if (UI.qs('welcome')) document.getElementById('welcome-alert').hidden = false;

  const [{ data }, cats] = await Promise.all([API.get('/users/profile'), Products.categories()]);
  const { user, sellerProfile: sp } = data;
  Auth.updateUser(user, sp);

  form.name.value = user.name;
  form.email.value = user.email;
  form.phone.value = user.phone;
  form.location.value = user.location || '';
  const avatar = document.getElementById('avatar-preview');
  const setAvatar = (src) => { avatar.innerHTML = src ? `<img src="${esc(src)}" alt="${esc(t('profile.photo'))}">` : esc(user.name[0]); };
  setAvatar(user.profileImage);

  if (isSeller) {
    form.businessName.value = sp?.businessName || '';
    form.description.value = sp?.description || '';
    form.upiId.value = sp?.upiId || '';
    document.getElementById('seller-type').textContent = t(`role.${user.role}`);
    document.getElementById('cat-checks').innerHTML = cats.map((c) => `
      <label class="check"><input type="checkbox" name="categories" value="${esc(c.slug)}" ${sp?.categories?.includes(c.slug) ? 'checked' : ''}>${esc(Products.catName(c))}</label>`).join('');
    ['pickup', 'local', 'state', 'nationwide'].forEach((d) => {
      const el = form.querySelector(`input[name=deliveryOptions][value=${d}]`);
      if (el) el.checked = sp?.deliveryOptions?.includes(d);
    });
    document.getElementById('public-link').href = `/seller.html?id=${user._id}`;
    if (location.hash === '#upi') setTimeout(() => form.upiId.focus(), 300);
  }

  // Photo preview + validation
  const photo = document.getElementById('profileImage');
  photo.addEventListener('change', () => {
    const f = photo.files[0];
    const err = document.getElementById('photo-error');
    err.textContent = '';
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { err.textContent = t('ap.badType', { name: f.name }); photo.value = ''; return; }
    if (f.size > 2 * 1024 * 1024) { err.textContent = t('ap.tooBig', { name: f.name, mb: 2 }); photo.value = ''; return; }
    setAvatar(URL.createObjectURL(f));
  });

  const v = UI.validator(form, {
    name: (x) => (x.trim().length < 2 ? t('val.name') : ''),
    email: (x) => (!UI.isEmail(x) ? t('val.email') : ''),
    phone: (x) => (!/^[6-9]\d{9}$/.test(x.trim()) ? t('val.phone') : ''),
    ...(isSeller ? { upiId: (x) => (x.trim() && !/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(x.trim()) ? t('val.upi') : '') } : {})
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!v.validate()) return;
    const fd = new FormData();
    ['name', 'email', 'phone', 'location'].forEach((f) => fd.append(f, form[f].value.trim()));
    if (photo.files[0]) fd.append('profileImage', photo.files[0]);
    if (isSeller) {
      ['businessName', 'description', 'upiId'].forEach((f) => fd.append(f, form[f].value.trim()));
      fd.append('categories', JSON.stringify([...form.querySelectorAll('input[name=categories]:checked')].map((c) => c.value)));
      fd.append('deliveryOptions', JSON.stringify([...form.querySelectorAll('input[name=deliveryOptions]:checked')].map((c) => c.value)));
    }
    const btn = form.querySelector('[type=submit]');
    UI.setLoading(btn, true);
    try {
      const res = await API.put('/users/profile', fd);
      Auth.updateUser(res.data.user, res.data.sellerProfile);
      UI.toast(t('profile.saved'), 'success');
      photo.value = '';
      if (UI.qs('welcome') && isSeller) {
        document.getElementById('welcome-alert').innerHTML = `${icon('circle-check')}<div><strong>${esc(t('profile.nextStep'))}</strong><p><a class="btn btn-primary btn-sm" href="/add-product.html">${esc(t('nav.addProduct'))}</a></p></div>`;
      }
    } catch (err) {
      UI.formError(form, err);
    } finally {
      UI.setLoading(btn, false);
    }
  });
});
