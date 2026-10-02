/* App bootstrap: guards the page, mounts Navbar/Footer (or the dashboard layout),
   applies translations and then runs the page script registered with App.page(). */
(function () {
  const { esc, icon } = UI;
  const pageInits = [];

  const NAV = [
    { href: '/index.html', key: 'nav.home', match: ['/', '/index.html'] },
    { href: '/products.html', key: 'nav.explore', match: ['/products.html', '/product-details.html', '/seller.html'] },
    { href: '/index.html#how-it-works', key: 'nav.howItWorks' },
    { href: '/index.html#about', key: 'nav.about' }
  ];

  function langToggle() {
    return `<div class="lang-toggle" role="group" aria-label="${esc(t('lang.choose'))}">
      <button type="button" data-lang="en" aria-pressed="${I18N.lang === 'en'}" lang="en">EN</button>
      <button type="button" data-lang="hi" aria-pressed="${I18N.lang === 'hi'}" lang="hi">हिं</button>
    </div>`;
  }
  function bindLangToggle(root) {
    root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => I18N.set(b.dataset.lang)));
  }

  function accountLinks(user) {
    if (!user) return [];
    const links = [];
    if (Auth.isAdmin(user)) links.push({ href: '/admin-dashboard.html', icon: 'shield-check', key: 'nav.adminDashboard' });
    if (Auth.isSeller(user)) {
      links.push({ href: '/seller-dashboard.html', icon: 'layout-dashboard', key: 'nav.sellerDashboard' });
      links.push({ href: '/add-product.html', icon: 'circle-plus', key: 'nav.addProduct' });
    }
    if (!Auth.isAdmin(user)) links.push({ href: '/my-orders.html', icon: 'package', key: 'nav.myOrders' });
    links.push({ href: '/profile.html', icon: 'user-round', key: 'nav.profile' });
    links.push({ href: '/notifications.html', icon: 'bell', key: 'notif.title' });
    links.push({ href: '/settings.html', icon: 'settings', key: 'nav.settings' });
    return links;
  }

  // ---------- Navbar component ----------
  function Navbar() {
    const user = Auth.getUser();
    const path = location.pathname;
    const header = document.createElement('header');
    header.className = 'site-header';
    const initials = user ? esc(user.name.trim()[0]) : '';
    header.innerHTML = `
      <a class="skip-link" href="#main">${esc(t('common.skip'))}</a>
      <div class="container nav">
        <a class="logo" href="/index.html" aria-label="SHG Connect – ${esc(t('nav.home'))}">
          <span class="logo-mark">${icon('sprout')}</span>
          <span class="logo-text">SHG Connect<small>${esc(t('brand.tagline'))}</small></span>
        </a>
        <nav class="nav-links" aria-label="${esc(t('nav.main'))}">
          ${NAV.map((n) => `<a class="nav-link" href="${n.href}" ${n.match && n.match.includes(path) ? 'aria-current="page"' : ''}>${esc(t(n.key))}</a>`).join('')}
        </nav>
        <div class="nav-actions">
          ${langToggle()}
          ${Auth.isAdmin(user) ? '' : `<a class="icon-btn" href="/cart.html" aria-label="${esc(t('nav.cart'))}">${icon('shopping-cart')}<span class="badge-count" data-cart-count hidden>0</span></a>`}
          ${user ? '<div id="notif-root"></div>' : ''}
          ${user ? `
            <div class="dropdown user-menu" style="display:none" data-desktop-only>
              <button class="icon-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="${esc(t('nav.account'))}"><span class="avatar">${user.profileImage ? `<img src="${esc(user.profileImage)}" alt="">` : initials}</span></button>
              <div class="dropdown-panel" hidden>
                <div class="dropdown-head"><strong>${esc(user.name)}</strong><span class="small muted">${esc(t(`role.${user.role}`))}</span></div>
                ${accountLinks(user).map((l) => `<a href="${l.href}">${icon(l.icon)}${esc(t(l.key))}</a>`).join('')}
                <button type="button" data-logout>${icon('log-out')}${esc(t('nav.logout'))}</button>
              </div>
            </div>` : `
            <a class="btn btn-ghost btn-sm" href="/login.html" data-desktop-only style="display:none">${esc(t('nav.login'))}</a>
            <a class="btn btn-primary btn-sm" href="/register.html" data-desktop-only style="display:none">${esc(t('nav.register'))}</a>`}
          <button class="icon-btn menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="${esc(t('common.openMenu'))}">${icon('menu')}</button>
        </div>
      </div>
      <nav class="mobile-menu" id="mobile-menu" hidden aria-label="${esc(t('nav.main'))}">
        ${NAV.map((n) => `<a href="${n.href}">${esc(t(n.key))}</a>`).join('')}
        <hr>
        ${user
          ? accountLinks(user).map((l) => `<a href="${l.href}">${icon(l.icon)}${esc(t(l.key))}</a>`).join('') + `<button type="button" class="menu-item" data-logout>${icon('log-out')}${esc(t('nav.logout'))}</button>`
          : `<a href="/login.html">${icon('log-in')}${esc(t('nav.login'))}</a><a href="/register.html">${icon('user-plus')}${esc(t('nav.register'))}</a><a href="/register.html?role=seller">${icon('store')}${esc(t('home.ctaSell'))}</a>`}
      </nav>`;

    // Desktop-only items are hidden on small screens via JS media query (keeps CSS simple)
    const mq = window.matchMedia('(min-width: 1024px)');
    const applyMq = () => header.querySelectorAll('[data-desktop-only]').forEach((el) => (el.style.display = mq.matches ? '' : 'none'));
    applyMq();
    mq.addEventListener('change', applyMq);

    // Hamburger
    const toggle = header.querySelector('.menu-toggle');
    const menu = header.querySelector('.mobile-menu');
    toggle.addEventListener('click', () => {
      const open = menu.hidden;
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = icon(open ? 'x' : 'menu');
      document.body.style.overflow = open ? 'hidden' : '';
      UI.refreshIcons();
    });
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { menu.hidden = true; document.body.style.overflow = ''; }));

    // User dropdown
    const um = header.querySelector('.user-menu');
    if (um) {
      const btn = um.querySelector('button');
      const panel = um.querySelector('.dropdown-panel');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.hidden = !panel.hidden;
        btn.setAttribute('aria-expanded', String(!panel.hidden));
      });
      document.addEventListener('click', (e) => { if (!um.contains(e.target)) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.hidden = true; });
    }
    header.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', () => Auth.logout()));
    bindLangToggle(header);
    if (user) Notifications.mount(header.querySelector('#notif-root'));
    return header;
  }

  // ---------- Footer component ----------
  function Footer() {
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    const share = UI.whatsappShare(t('footer.shareText') + ' ' + location.origin);
    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <a class="logo footer-logo" href="/index.html"><span class="logo-mark">${icon('sprout')}</span>SHG Connect</a>
            <p style="margin-top:12px">${esc(t('footer.about'))}</p>
            <div class="social" aria-label="${esc(t('footer.share'))}">
              <a href="${share}" target="_blank" rel="noopener" aria-label="${esc(t('footer.shareWhatsapp'))}">${icon('message-circle')}</a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.origin)}" target="_blank" rel="noopener" aria-label="${esc(t('footer.shareFacebook'))}">${icon('facebook')}</a>
              <a href="mailto:support@shgconnect.in" aria-label="${esc(t('footer.email'))}">${icon('mail')}</a>
            </div>
          </div>
          <div><h3>${esc(t('footer.marketplace'))}</h3><ul>
            <li><a href="/products.html">${esc(t('nav.explore'))}</a></li>
            <li><a href="/products.html?promoted=true">${esc(t('market.promoted'))}</a></li>
            <li><a href="/register.html?role=seller">${esc(t('home.ctaSell'))}</a></li>
          </ul></div>
          <div><h3>${esc(t('footer.project'))}</h3><ul>
            <li><a href="/index.html#about">${esc(t('nav.about'))}</a></li>
            <li><a href="/index.html#how-it-works">${esc(t('nav.howItWorks'))}</a></li>
            <li><a href="/contact.html">${esc(t('footer.contact'))}</a></li>
          </ul></div>
          <div><h3>${esc(t('footer.legal'))}</h3><ul>
            <li><a href="/privacy.html">${esc(t('footer.privacy'))}</a></li>
            <li><a href="/terms.html">${esc(t('footer.terms'))}</a></li>
          </ul></div>
        </div>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} SHG Connect · ${esc(t('footer.prototype'))}</span><span>${esc(t('footer.madeFor'))}</span></div>
      </div>`;
    return footer;
  }

  function updateCartBadge() {
    const n = Cart.count();
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = n > 99 ? '99+' : n;
      el.hidden = !n;
    });
  }

  async function boot() {
    I18N.apply(document);
    const body = document.body;
    if (!Auth.guard(body.dataset.require)) return;

    let layout = body.dataset.layout || 'public';
    if (layout === 'auto') layout = Auth.isSeller() || Auth.isAdmin() ? 'dashboard' : 'public';

    const main = document.querySelector('main');
    if (layout === 'dashboard') {
      Dashboard.mount();
    } else {
      if (main && !main.id) main.id = 'main';
      body.prepend(Navbar());
      if (body.dataset.footer !== 'false') body.appendChild(Footer());
    }
    if (main) main.setAttribute('tabindex', '-1');
    I18N.apply(document);
    updateCartBadge();
    document.addEventListener('cart:change', updateCartBadge);
    Notifications.init();
    UI.bindPasswordToggles();
    UI.refreshIcons();

    document.dispatchEvent(new Event('app:ready'));
    for (const fn of pageInits) {
      try {
        await fn();
      } catch (err) {
        console.error(err);
        UI.toast(err.message || t('err.generic'), 'error');
      }
    }
    UI.refreshIcons();
    // Re-check the session quietly (catches suspended accounts / expired tokens)
    if (Auth.isLoggedIn()) Auth.refresh();
  }

  window.App = {
    page: (fn) => pageInits.push(fn),
    langToggle,
    bindLangToggle,
    Navbar,
    Footer
  };

  // Re-render Lucide icons whenever content is injected
  const obs = new MutationObserver(UI.debounce(() => {
    if (document.querySelector('i[data-lucide]')) UI.refreshIcons();
  }, 30));
  document.addEventListener('DOMContentLoaded', () => {
    obs.observe(document.body, { childList: true, subtree: true });
    boot();
  });
})();
