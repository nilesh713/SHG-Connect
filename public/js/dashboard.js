/* Dashboard layout (seller & admin): sidebar that becomes a mobile drawer + top bar. */
(function () {
  const { esc, icon } = UI;

  const SELLER_NAV = [
    { href: '/seller-dashboard.html', icon: 'layout-dashboard', key: 'nav.dashboard' },
    { href: '/seller-products.html', icon: 'package', key: 'nav.myProducts' },
    { href: '/add-product.html', icon: 'circle-plus', key: 'nav.addProduct' },
    { href: '/orders.html', icon: 'shopping-bag', key: 'nav.orders', count: 'newOrders' },
    { href: '/delivery.html', icon: 'truck', key: 'nav.delivery' },
    { href: '/sales-history.html', icon: 'chart-column', key: 'nav.sales' },
    { href: '/reviews.html', icon: 'star', key: 'nav.reviews' },
    { href: '/promotions.html', icon: 'megaphone', key: 'nav.promotions' },
    { href: '/payments.html', icon: 'indian-rupee', key: 'nav.payments' },
    { divider: true },
    { href: '/profile.html', icon: 'user-round', key: 'nav.profile' },
    { href: '/settings.html', icon: 'settings', key: 'nav.settings' }
  ];

  const ADMIN_NAV = [
    { href: '/admin-dashboard.html#overview', icon: 'layout-dashboard', key: 'admin.nav.overview' },
    { href: '/admin-dashboard.html#users', icon: 'users', key: 'admin.nav.users' },
    { href: '/admin-dashboard.html#products', icon: 'package', key: 'admin.nav.products', count: 'pendingProducts' },
    { href: '/admin-dashboard.html#orders', icon: 'shopping-bag', key: 'admin.nav.orders' },
    { href: '/admin-dashboard.html#reviews', icon: 'message-square-warning', key: 'admin.nav.reviews', count: 'flaggedReviews' },
    { href: '/admin-dashboard.html#categories', icon: 'tags', key: 'admin.nav.categories' },
    { href: '/admin-dashboard.html#reports', icon: 'chart-column', key: 'admin.nav.reports' },
    { divider: true },
    { href: '/products.html', icon: 'store', key: 'nav.marketplace' },
    { href: '/settings.html', icon: 'settings', key: 'nav.settings' }
  ];

  function isActive(href) {
    const [path, hash] = href.split('#');
    const current = location.pathname.replace(/\/$/, '/index.html').replace(/^(\/[\w-]+)$/, '$1.html');
    // Editing a product (add-product.html?id=…) belongs to "My Products"
    if (current === '/add-product.html' && UI.qs('id')) return path === '/seller-products.html';
    if (path !== current) return false;
    if (hash) return (location.hash.slice(1) || 'overview') === hash;
    return true;
  }

  function mount() {
    const user = Auth.getUser();
    const nav = Auth.isAdmin(user) ? ADMIN_NAV : SELLER_NAV;
    const main = document.querySelector('main');
    const titleKey = document.body.dataset.title;

    const shell = document.createElement('div');
    shell.className = 'dash';
    const initials = esc((user.name || '?').trim()[0]);
    const roleLabel = t(`role.${user.role}`);
    shell.innerHTML = `
      <a class="skip-link" href="#main">${esc(t('common.skip'))}</a>
      <aside class="sidebar" id="sidebar" aria-label="${esc(t('nav.dashboardMenu'))}">
        <div class="sidebar-head">
          <a class="logo" href="/index.html"><span class="logo-mark">${icon('sprout')}</span><span class="logo-text">SHG Connect</span></a>
          <button class="icon-btn sidebar-close" type="button" aria-label="${esc(t('common.closeMenu'))}">${icon('x')}</button>
        </div>
        <div class="sidebar-user">
          <span class="avatar">${user.profileImage ? `<img src="${esc(user.profileImage)}" alt="">` : initials}</span>
          <span><strong>${esc(user.sellerProfile?.businessName || user.name)}</strong><small>${esc(roleLabel)}</small></span>
        </div>
        <nav><ul class="side-nav">
          ${nav.map((n) => n.divider ? '<li class="divider" role="separator"></li>' : `
            <li><a href="${n.href}" ${isActive(n.href) ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${esc(t(n.key))}</span>${n.count ? `<span class="nav-count" data-count="${n.count}" hidden></span>` : ''}</a></li>`).join('')}
          <li><button type="button" data-logout>${icon('log-out')}<span>${esc(t('nav.logout'))}</span></button></li>
        </ul></nav>
        <div class="sidebar-foot">${esc(t('dash.help'))} <a href="/index.html#how-it-works">${esc(t('nav.howItWorks'))}</a></div>
      </aside>
      <div class="dash-main">
        <header class="topbar">
          <button class="icon-btn sidebar-toggle" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="${esc(t('common.openMenu'))}">${icon('menu')}</button>
          <h1>${esc(titleKey ? t(titleKey) : '')}</h1>
          <div class="nav-actions">
            ${App.langToggle()}
            <a class="icon-btn" href="/products.html" aria-label="${esc(t('nav.marketplace'))}" title="${esc(t('nav.marketplace'))}">${icon('store')}</a>
            <div id="notif-root"></div>
          </div>
        </header>
      </div>`;
    main.classList.add('dash-content');
    main.id = 'main';
    main.tabIndex = -1;
    shell.querySelector('.dash-main').appendChild(main);
    document.body.prepend(shell);

    // Drawer behaviour on mobile / tablet
    const sidebar = shell.querySelector('.sidebar');
    const toggleBtn = shell.querySelector('.sidebar-toggle');
    let backdrop = null;
    const open = () => {
      sidebar.classList.add('open');
      toggleBtn.setAttribute('aria-expanded', 'true');
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      backdrop.addEventListener('click', close);
      document.body.appendChild(backdrop);
      sidebar.querySelector('a, button').focus();
    };
    const close = () => {
      sidebar.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      if (backdrop) backdrop.remove();
    };
    toggleBtn.addEventListener('click', open);
    shell.querySelector('.sidebar-close').addEventListener('click', () => { close(); toggleBtn.focus(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sidebar.classList.contains('open')) close(); });
    sidebar.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
    shell.querySelector('[data-logout]').addEventListener('click', () => Auth.logout());
    window.addEventListener('hashchange', () => {
      sidebar.querySelectorAll('.side-nav a').forEach((a) => (isActive(a.getAttribute('href')) ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    });

    Notifications.mount(shell.querySelector('#notif-root'));
    App.bindLangToggle(shell);
    loadCounts();
  }

  // Small red counters in the sidebar (new orders, pending approvals)
  async function loadCounts() {
    try {
      let counts = {};
      if (Auth.isAdmin()) counts = (await API.get('/admin/stats')).data;
      else {
        const r = await API.get('/orders', { status: 'new', limit: 1 });
        counts.newOrders = r.pagination.total;
      }
      setCount(counts);
    } catch (e) { /* counters are optional */ }
  }
  function setCount(counts) {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const v = counts[el.dataset.count];
      el.textContent = v;
      el.hidden = !v;
    });
  }

  window.Dashboard = { mount, setCount, refreshCounts: loadCounts };
})();
