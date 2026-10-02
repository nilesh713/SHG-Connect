/* /settings.html – language, password, WhatsApp visibility, logout */
App.page(async () => {
  const langSel = document.getElementById('lang-select');
  langSel.value = I18N.lang;
  langSel.addEventListener('change', async () => {
    try { await API.put('/users/profile', { language: langSel.value }); } catch (e) { /* language is stored locally too */ }
    I18N.set(langSel.value);
  });

  // WhatsApp visibility (sellers)
  const waBox = document.getElementById('wa-settings');
  if (Auth.isSeller()) {
    waBox.hidden = false;
    const cb = document.getElementById('wa-toggle');
    cb.checked = Auth.getUser().sellerProfile?.whatsappEnabled !== false;
    cb.addEventListener('change', async () => {
      try {
        const res = await API.put('/users/profile', { whatsappEnabled: cb.checked });
        Auth.updateUser(res.data.user, res.data.sellerProfile);
        UI.toast(cb.checked ? t('settings.waOn') : t('settings.waOff'), 'success');
      } catch (err) {
        cb.checked = !cb.checked;
        UI.toast(err.message, 'error');
      }
    });
  }

  // Change password
  const form = document.getElementById('password-form');
  const v = UI.validator(form, {
    currentPassword: (x) => (!x ? t('val.passwordRequired') : ''),
    newPassword: (x) => (x.length < 6 ? t('val.passwordLength') : !/\d/.test(x) ? t('val.passwordNumber') : ''),
    confirmPassword: (x) => (x !== form.newPassword.value ? t('val.passwordMatch') : '')
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!v.validate()) return;
    const btn = form.querySelector('[type=submit]');
    UI.setLoading(btn, true);
    try {
      const res = await API.put('/auth/change-password', { currentPassword: form.currentPassword.value, newPassword: form.newPassword.value });
      UI.toast(res.message, 'success');
      form.reset();
    } catch (err) {
      UI.formError(form, err);
    } finally {
      UI.setLoading(btn, false);
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());
});
