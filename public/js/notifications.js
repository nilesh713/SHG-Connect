/* Notification bell + dropdown. Real-time through Socket.io, with polling as a fallback. */
(function () {
  const { esc, icon } = UI;
  const TYPE_ICON = {
    new_order: 'shopping-bag', payment_received: 'indian-rupee', payment_reference: 'indian-rupee', order_cancelled: 'circle-x',
    new_review: 'star', delivery_update: 'truck', order_confirmed: 'circle-check', order_shipped: 'truck',
    out_for_delivery: 'bike', delivered: 'house', order_status: 'clipboard-list', product_status: 'package', promotion: 'megaphone', system: 'bell'
  };

  let state = { items: [], unread: 0 };
  const roots = [];
  let pollId = null;

  // Rebuild text in the selected language from type + data (stored text is English)
  function text(n) {
    if (I18N.lang === 'en' || !n.data) return { title: n.title, message: n.message };
    const d = { ...n.data };
    if (d.status) d.status = t(`status.${d.status}`);
    if (d.paymentStatus) d.paymentStatus = t(`status.${d.paymentStatus}`);
    if (d.amount !== undefined) d.amount = UI.price(d.amount);
    const titleKey = `notif.${n.type}.title`;
    const msgKey = `notif.${n.type}.msg`;
    const title = I18N.has(titleKey) ? t(titleKey, d) : n.title;
    const message = I18N.has(msgKey) ? t(msgKey, d) : n.message;
    return { title, message };
  }

  function renderList() {
    if (!state.items.length) {
      return `<li class="notif-item" style="padding:24px;text-align:center;color:var(--text-muted)">${icon('bell-off')}<p>${esc(t('notif.empty'))}</p></li>`;
    }
    return state.items.slice(0, 15).map((n) => {
      const tx = text(n);
      return `<li class="notif-item ${n.read ? '' : 'unread'}">
        <a href="${esc(n.link || '/notifications.html')}" data-notif="${esc(n._id)}">
          <span class="notif-icon">${icon(TYPE_ICON[n.type] || 'bell')}</span>
          <span><strong>${esc(tx.title)}</strong><p>${esc(tx.message)}</p><time datetime="${esc(n.createdAt)}">${esc(UI.timeAgo(n.createdAt))}</time></span>
        </a></li>`;
    }).join('');
  }

  function update() {
    roots.forEach((root) => {
      const count = root.querySelector('.badge-count');
      count.textContent = state.unread > 99 ? '99+' : state.unread;
      count.hidden = !state.unread;
      root.querySelector('.notif-trigger').setAttribute('aria-label', t('notif.aria', { n: state.unread }));
      root.querySelector('.notif-list').innerHTML = renderList();
    });
    UI.refreshIcons();
  }

  async function load() {
    try {
      const res = await API.get('/notifications', { limit: 20 });
      state = res.data;
      update();
    } catch (e) { /* silent – bell just stays as is */ }
  }

  async function markRead(id) {
    const n = state.items.find((x) => x._id === id);
    if (!n || n.read) return;
    n.read = true;
    state.unread = Math.max(0, state.unread - 1);
    update();
    API.put(`/notifications/${id}/read`).catch(() => {});
  }

  async function markAll() {
    await API.put('/notifications/read-all');
    state.items.forEach((n) => (n.read = true));
    state.unread = 0;
    update();
  }

  function mount(container) {
    container.classList.add('dropdown');
    container.innerHTML = `
      <button type="button" class="icon-btn notif-trigger" aria-haspopup="true" aria-expanded="false" aria-label="${esc(t('notif.title'))}">
        ${icon('bell')}<span class="badge-count" hidden>0</span>
      </button>
      <div class="dropdown-panel notif-panel" hidden>
        <div class="notif-head"><h2>${esc(t('notif.title'))}</h2><button type="button" class="btn btn-ghost btn-sm" data-mark-all>${esc(t('notif.markAll'))}</button></div>
        <ul class="notif-list"></ul>
        <div class="notif-foot"><a class="btn btn-ghost btn-sm" href="/notifications.html">${esc(t('notif.viewAll'))}</a></div>
      </div>`;
    const trigger = container.querySelector('.notif-trigger');
    const panel = container.querySelector('.notif-panel');
    const toggle = (open) => {
      panel.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    };
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle(panel.hidden);
      if (!panel.hidden) load();
    });
    container.querySelector('[data-mark-all]').addEventListener('click', () => markAll().catch((e) => UI.toast(e.message, 'error')));
    container.querySelector('.notif-list').addEventListener('click', (e) => {
      const a = e.target.closest('[data-notif]');
      if (a) markRead(a.dataset.notif);
    });
    document.addEventListener('click', (e) => { if (!container.contains(e.target)) toggle(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { toggle(false); trigger.focus(); } });
    roots.push(container);
    update();
  }

  function onIncoming(n) {
    state.items.unshift(n);
    state.unread += 1;
    update();
    UI.toast(text(n).title + ' – ' + text(n).message, 'info', 6000);
    document.dispatchEvent(new CustomEvent('notification:new', { detail: n }));
  }

  function startRealtime() {
    const s = document.createElement('script');
    s.src = '/socket.io/socket.io.js';
    s.onload = () => {
      try {
        const socket = io({ auth: { token: Auth.getToken() }, transports: ['websocket', 'polling'] });
        socket.on('notification', onIncoming);
        socket.on('connect_error', startPolling);
      } catch (e) {
        startPolling();
      }
    };
    s.onerror = startPolling;
    document.head.appendChild(s);
  }

  function startPolling() {
    if (pollId) return;
    pollId = setInterval(load, 60000);
  }

  function init() {
    if (!Auth.isLoggedIn()) return;
    load();
    startRealtime();
  }

  window.Notifications = { mount, init, load, markRead, markAll, text, TYPE_ICON, state: () => state };
})();
