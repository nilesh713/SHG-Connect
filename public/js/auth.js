/* Session handling (JWT in localStorage) + role helpers + login/register pages. */
(function () {
  const TOKEN_KEY = 'shg_token';
  const USER_KEY = 'shg_user';
  const SELLER_ROLES = ['artisan', 'shg_member', 'shg_leader', 'producer'];

  const read = (k) => {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  };
  const write = (k, v) => {
    try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* storage blocked */ }
  };

  const Auth = {
    SELLER_ROLES,
    getToken: () => read(TOKEN_KEY),
    getUser() {
      try { return JSON.parse(read(USER_KEY)); } catch (e) { return null; }
    },
    isLoggedIn: () => Boolean(read(TOKEN_KEY)),
    isSeller: (u = Auth.getUser()) => Boolean(u && SELLER_ROLES.includes(u.role)),
    isAdmin: (u = Auth.getUser()) => Boolean(u && u.role === 'admin'),
    isCustomer: (u = Auth.getUser()) => Boolean(u && u.role === 'customer'),

    setSession({ token, user, sellerProfile }) {
      if (token) write(TOKEN_KEY, token);
      if (user) write(USER_KEY, JSON.stringify({ ...user, sellerProfile: sellerProfile || null }));
    },
    updateUser(user, sellerProfile) {
      const cur = Auth.getUser() || {};
      write(USER_KEY, JSON.stringify({ ...cur, ...user, sellerProfile: sellerProfile !== undefined ? sellerProfile : cur.sellerProfile }));
    },
    clear() {
      write(TOKEN_KEY, null);
      write(USER_KEY, null);
    },
    logout() {
      Auth.clear();
      UI.toast(t('auth.loggedOut'), 'success');
      setTimeout(() => (location.href = '/index.html'), 400);
    },

    // Where each role lands after login
    homeFor(user) {
      if (!user) return '/index.html';
      if (user.role === 'admin') return '/admin-dashboard.html';
      if (SELLER_ROLES.includes(user.role)) return '/seller-dashboard.html';
      return '/products.html';
    },

    /**
     * Guard a page. requirement: 'any' | 'seller' | 'admin' | 'customer'
     * Redirects and returns false when the user may not see the page.
     */
    guard(requirement) {
      if (!requirement) return true;
      const user = Auth.getUser();
      if (!Auth.isLoggedIn() || !user) {
        location.replace(`/login.html?next=${encodeURIComponent(location.pathname + location.search)}`);
        return false;
      }
      const ok =
        requirement === 'any' ||
        (requirement === 'seller' && Auth.isSeller(user)) ||
        (requirement === 'admin' && Auth.isAdmin(user)) ||
        (requirement === 'customer' && !Auth.isAdmin(user));
      if (!ok) {
        location.replace(Auth.homeFor(user));
        return false;
      }
      return true;
    },

    // Refresh the stored user from the server (detects suspended / expired sessions)
    async refresh() {
      if (!Auth.isLoggedIn()) return null;
      try {
        const res = await API.get('/auth/me');
        Auth.updateUser(res.data.user, res.data.sellerProfile);
        return Auth.getUser();
      } catch (e) {
        return null;
      }
    }
  };

  // Only allow same-site relative redirect targets (prevents open redirects)
  function safeNext(fallback) {
    const next = new URLSearchParams(location.search).get('next');
    return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
  }

  // ----- Login page -----
  function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;
    if (Auth.isLoggedIn()) location.replace(Auth.homeFor(Auth.getUser()));

    const v = UI.validator(form, {
      identifier: (val) => (!val.trim() ? t('val.identifier') : ''),
      password: (val) => (!val ? t('val.passwordRequired') : '')
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!v.validate()) return;
      const btn = form.querySelector('[type=submit]');
      UI.setLoading(btn, true);
      try {
        const res = await API.post('/auth/login', { identifier: form.identifier.value.trim(), password: form.password.value }, { auth: false });
        Auth.setSession(res.data);
        UI.toast(t('auth.welcome', { name: res.data.user.name.split(' ')[0] }), 'success');
        location.href = safeNext(Auth.homeFor(res.data.user));
      } catch (err) {
        UI.formError(form, err);
      } finally {
        UI.setLoading(btn, false);
      }
    });

    // Demo account quick-fill buttons
    document.querySelectorAll('[data-demo]').forEach((b) =>
      b.addEventListener('click', () => {
        form.identifier.value = b.dataset.demo;
        form.password.value = 'Demo@123';
        form.password.focus();
      })
    );
  }

  // ----- Register page -----
  function initRegister() {
    const form = document.getElementById('register-form');
    if (!form) return;
    if (Auth.isLoggedIn()) location.replace(Auth.homeFor(Auth.getUser()));

    const preset = new URLSearchParams(location.search).get('role');
    if (preset === 'seller') {
      const r = form.querySelector('input[name=role][value=artisan]');
      if (r) r.checked = true;
    }

    const v = UI.validator(form, {
      name: (val) => (val.trim().length < 2 ? t('val.name') : ''),
      email: (val) => (!UI.isEmail(val) ? t('val.email') : ''),
      phone: (val) => (!/^[6-9]\d{9}$/.test(val.trim()) ? t('val.phone') : ''),
      password: (val) => (val.length < 6 ? t('val.passwordLength') : !/\d/.test(val) ? t('val.passwordNumber') : ''),
      confirmPassword: (val) => (val !== form.password.value ? t('val.passwordMatch') : ''),
      location: (val) => (val.trim().length < 2 ? t('val.location') : ''),
      role: () => (!form.querySelector('input[name=role]:checked') ? t('val.role') : '')
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!v.validate()) return;
      const btn = form.querySelector('[type=submit]');
      UI.setLoading(btn, true);
      const body = Object.fromEntries(new FormData(form));
      body.phone = body.phone.trim();
      try {
        const res = await API.post('/auth/register', body, { auth: false });
        Auth.setSession(res.data);
        UI.toast(t('auth.registered'), 'success');
        const user = res.data.user;
        location.href = Auth.isSeller(user) ? '/profile.html?welcome=1' : safeNext('/products.html');
      } catch (err) {
        UI.formError(form, err);
      } finally {
        UI.setLoading(btn, false);
      }
    });
  }

  window.Auth = Auth;
  document.addEventListener('app:ready', () => {
    initLogin();
    initRegister();
  });
})();
