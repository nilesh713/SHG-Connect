/* /notifications.html – full notification list */
App.page(async () => {
  const { esc, icon } = UI;
  const list = document.getElementById('notif-page-list');
  const unreadOnly = document.getElementById('unread-only');

  async function load() {
    list.innerHTML = UI.spinner();
    try {
      const { data } = await API.get('/notifications', { limit: 100, unread: unreadOnly.checked ? 'true' : undefined });
      if (!data.items.length) {
        list.innerHTML = UI.emptyState({ icon: 'bell-off', title: t('notif.empty'), text: t('notif.emptyText') });
        return;
      }
      list.innerHTML = `<ul class="notif-list card" style="max-height:none;padding:0">${data.items.map((n) => {
        const tx = Notifications.text(n);
        return `<li class="notif-item ${n.read ? '' : 'unread'}"><a href="${esc(n.link || '#')}" data-id="${esc(n._id)}">
          <span class="notif-icon">${icon(Notifications.TYPE_ICON[n.type] || 'bell')}</span>
          <span><strong>${esc(tx.title)}</strong><p>${esc(tx.message)}</p><time datetime="${esc(n.createdAt)}">${esc(UI.dateTime(n.createdAt))}</time></span></a></li>`;
      }).join('')}</ul>`;
    } catch (err) {
      list.innerHTML = UI.errorState(err, load);
    }
  }

  list.addEventListener('click', (e) => {
    const a = e.target.closest('[data-id]');
    if (a) Notifications.markRead(a.dataset.id);
  });
  document.getElementById('mark-all').addEventListener('click', async () => {
    try { await Notifications.markAll(); load(); } catch (err) { UI.toast(err.message, 'error'); }
  });
  unreadOnly.addEventListener('change', load);
  document.addEventListener('notification:new', load);
  await load();
});
