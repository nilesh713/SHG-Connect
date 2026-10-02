/* /admin-dashboard.html – sections switched by URL hash:
   #overview #users #products #orders #reviews #categories #reports */
App.page(async () => {
  const { esc, icon, price, number } = UI;
  let root = document.getElementById('admin-root');
  const titleEl = document.querySelector('.topbar h1');
  const SECTIONS = ['overview', 'users', 'products', 'orders', 'reviews', 'categories', 'reports'];
  const state = { users: { page: 1 }, products: { page: 1, status: 'pending' }, orders: { page: 1 }, reviews: { page: 1, status: 'flagged' } };

  const tabs = (name, items, current) => `<div class="tabs" role="tablist" data-tabs="${name}">${items.map(([v, label]) => `<button class="tab" role="tab" type="button" data-v="${v}" aria-selected="${v === current}">${esc(label)}</button>`).join('')}</div>`;
  const tableWrap = (head, rows, cols) => `<div class="table-wrap"><table class="table stack"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${cols}" class="cell-full">${UI.emptyState({ icon: 'inbox', title: t('admin.nothing') })}</td></tr>`}</tbody></table></div><nav class="pagination" id="admin-pages"></nav>`;
  const td = (label, html, cls = '') => `<td data-label="${esc(label)}" class="${cls}">${html}</td>`;

  // ---------------- Overview ----------------
  async function overview() {
    const [{ data: s }, pending, flagged] = await Promise.all([
      API.get('/admin/stats'),
      API.get('/admin/products', { status: 'pending', limit: 5 }),
      API.get('/admin/reviews', { status: 'flagged', limit: 5 })
    ]);
    Dashboard.setCount(s);
    root.innerHTML = `
      <div class="stat-grid">
        <a class="stat" href="#users"><span class="stat-icon earth">${icon('store')}</span><span class="stat-value">${number(s.sellers)}</span><span class="stat-label">${esc(t('admin.totalSellers'))}</span></a>
        <a class="stat" href="#users"><span class="stat-icon blue">${icon('users')}</span><span class="stat-value">${number(s.customers)}</span><span class="stat-label">${esc(t('admin.totalCustomers'))}</span></a>
        <a class="stat" href="#products"><span class="stat-icon">${icon('package')}</span><span class="stat-value">${number(s.products)}</span><span class="stat-label">${esc(t('admin.totalProducts'))}</span></a>
        <a class="stat" href="#orders"><span class="stat-icon gold">${icon('shopping-bag')}</span><span class="stat-value">${number(s.orders)}</span><span class="stat-label">${esc(t('admin.totalOrders'))}</span></a>
      </div>
      <div class="stat-grid">
        <div class="stat"><span class="stat-icon">${icon('circle-check')}</span><span class="stat-value">${number(s.completedOrders)}</span><span class="stat-label">${esc(t('admin.completedOrders'))}</span></div>
        <div class="stat"><span class="stat-icon gold">${icon('indian-rupee')}</span><span class="stat-value">${price(s.totalSales)}</span><span class="stat-label">${esc(t('admin.gmv'))}</span></div>
        <a class="stat" href="#products"><span class="stat-icon earth">${icon('hourglass')}</span><span class="stat-value">${number(s.pendingProducts)}</span><span class="stat-label">${esc(t('admin.pendingProducts'))}</span></a>
        <a class="stat" href="#reviews"><span class="stat-icon earth">${icon('flag')}</span><span class="stat-value">${number(s.flaggedReviews)}</span><span class="stat-label">${esc(t('admin.flaggedReviews'))}</span></a>
      </div>
      <div class="dash-grid two">
        <section class="card"><div class="card-title"><h2>${esc(t('admin.waitingApproval'))}</h2><a class="btn btn-ghost btn-sm" href="#products">${esc(t('common.viewAll'))}</a></div>
          ${pending.data.length ? `<ul class="list">${pending.data.map((p) => `<li><img src="${esc(UI.imageUrl(p.images[0]))}" alt=""><span class="grow"><a href="/product-details.html?id=${esc(p._id)}">${esc(p.name)}</a><span class="small muted">${esc(p.seller.businessName)} · ${price(p.price)}</span></span>
            <button class="btn btn-primary btn-sm" data-approve="${esc(p._id)}">${esc(t('admin.approve'))}</button></li>`).join('')}</ul>` : `<p class="muted">${esc(t('admin.noPending'))}</p>`}
        </section>
        <section class="card"><div class="card-title"><h2>${esc(t('admin.reportedReviews'))}</h2><a class="btn btn-ghost btn-sm" href="#reviews">${esc(t('common.viewAll'))}</a></div>
          ${flagged.data.length ? `<ul class="list">${flagged.data.map((r) => `<li><span class="grow"><strong>${esc(r.productName)}</strong><span class="small muted">${UI.stars(r.rating)} “${esc((r.comment || '').slice(0, 60))}”</span></span></li>`).join('')}</ul>` : `<p class="muted">${esc(t('admin.noFlagged'))}</p>`}
        </section>
      </div>`;
    root.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => setProductStatus(b.dataset.approve, 'approved').then(overview)));
  }

  // ---------------- Users ----------------
  async function users() {
    const st = state.users;
    root.innerHTML = `
      <div class="toolbar">
        <div class="input-icon">${icon('search')}<input class="input" id="u-q" type="search" placeholder="${esc(t('admin.searchUsers'))}" value="${esc(st.q || '')}" aria-label="${esc(t('admin.searchUsers'))}"></div>
        <select class="input" id="u-role" aria-label="${esc(t('admin.role'))}">
          <option value="">${esc(t('admin.allRoles'))}</option><option value="seller">${esc(t('admin.sellers'))}</option>
          ${['customer', 'artisan', 'shg_member', 'shg_leader', 'producer', 'admin'].map((r) => `<option value="${r}">${esc(t('role.' + r))}</option>`).join('')}
        </select>
        <select class="input" id="u-status" aria-label="${esc(t('admin.status'))}"><option value="">${esc(t('admin.allStatus'))}</option><option value="active">${esc(t('status.active'))}</option><option value="suspended">${esc(t('status.suspended'))}</option></select>
      </div><div id="u-table">${UI.spinner()}</div>`;
    const q = document.getElementById('u-q');
    const role = document.getElementById('u-role');
    const status = document.getElementById('u-status');
    role.value = st.role || '';
    status.value = st.status || '';

    async function loadUsers() {
      const res = await API.get('/admin/users', { q: st.q, role: st.role, status: st.status, page: st.page });
      const H = [t('admin.col.name'), t('admin.col.contact'), t('admin.role'), t('admin.col.location'), t('admin.col.joined'), t('admin.status'), t('admin.col.actions')];
      document.getElementById('u-table').innerHTML = tableWrap(H, res.data.map((u) => `<tr>
        ${td(H[0], `<strong>${esc(u.name)}</strong>${u.businessName && u.businessName !== u.name ? `<div class="small muted">${esc(u.businessName)}</div>` : ''}`)}
        ${td(H[1], `${esc(u.email)}<div class="small muted">${esc(u.phone)}</div>`)}
        ${td(H[2], `<span class="seller-type">${esc(t('role.' + u.role))}</span>`)}
        ${td(H[3], esc(u.location))}
        ${td(H[4], esc(UI.date(u.createdAt)))}
        ${td(H[5], UI.badge(u.isActive ? 'active' : 'suspended'))}
        <td class="cell-full"><div class="actions">
          ${u.role !== 'admin' ? `<button class="btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-primary'}" data-user="${esc(u._id)}" data-active="${!u.isActive}">${esc(u.isActive ? t('admin.suspend') : t('admin.activate'))}</button>` : ''}
          ${Auth.SELLER_ROLES.includes(u.role) ? `<button class="btn btn-sm btn-secondary" data-feature-seller="${esc(u._id)}" data-featured="${!u.featured}">${icon('award')}${esc(u.featured ? t('admin.unfeature') : t('admin.featureArtisan'))}</button>
            <a class="btn btn-sm btn-ghost" href="/seller.html?id=${esc(u._id)}">${esc(t('admin.viewProfile'))}</a>` : ''}
        </div></td></tr>`).join(''), H.length);
      UI.pagination(document.getElementById('admin-pages'), res.pagination, (p) => { st.page = p; loadUsers(); });
    }
    q.addEventListener('input', UI.debounce(() => { st.q = q.value.trim(); st.page = 1; loadUsers(); }, 400));
    role.addEventListener('change', () => { st.role = role.value; st.page = 1; loadUsers(); });
    status.addEventListener('change', () => { st.status = status.value; st.page = 1; loadUsers(); });
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-user],[data-feature-seller]');
      if (!b || !root.contains(b)) return;
      try {
        if (b.dataset.user) {
          const activate = b.dataset.active === 'true';
          if (!activate && !(await UI.confirm(t('admin.confirmSuspend'), { danger: true, confirmLabel: t('admin.suspend') }))) return;
          UI.toast((await API.put(`/admin/users/${b.dataset.user}/status`, { isActive: activate })).message, 'success');
        } else {
          UI.toast((await API.put(`/admin/sellers/${b.dataset.featureSeller}/featured`, { featured: b.dataset.featured === 'true' })).message, 'success');
        }
        loadUsers();
      } catch (err) { UI.toast(err.message, 'error'); }
    });
    await loadUsers();
  }

  // ---------------- Products ----------------
  async function setProductStatus(id, status, reason) {
    try {
      UI.toast((await API.put(`/admin/products/${id}/status`, { status, reason })).message, 'success');
      Dashboard.refreshCounts();
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  async function products() {
    const st = state.products;
    root.innerHTML = `
      ${tabs('p', [['pending', t('status.pending')], ['approved', t('status.approved')], ['rejected', t('status.rejected')], ['', t('market.all')]], st.status)}
      <div class="toolbar" style="margin-top:14px"><div class="input-icon">${icon('search')}<input class="input" id="p-q" type="search" placeholder="${esc(t('admin.searchProducts'))}" value="${esc(st.q || '')}" aria-label="${esc(t('admin.searchProducts'))}"></div></div>
      <div id="p-table" style="margin-top:14px">${UI.spinner()}</div>`;

    async function loadProducts() {
      const res = await API.get('/admin/products', { status: st.status, q: st.q, page: st.page });
      const H = [t('so.col.product'), t('market.seller'), t('admin.col.price'), t('sp.stock'), t('admin.status'), t('admin.col.actions')];
      document.getElementById('p-table').innerHTML = tableWrap(H, res.data.map((p) => `<tr>
        ${td(H[0], `<div class="cell-product"><img src="${esc(UI.imageUrl(p.images[0]))}" alt=""><span><a href="/product-details.html?id=${esc(p._id)}">${esc(p.name)}</a><div class="small muted">${esc(p.category)}</div></span></div>`)}
        ${td(H[1], `${esc(p.seller.businessName)}<div class="small muted">${esc(p.seller.location)}</div>`)}
        ${td(H[2], price(p.price))}
        ${td(H[3], number(p.quantity))}
        ${td(H[4], UI.badge(p.status) + (p.featured ? ` <span class="tag tag-featured">${esc(t('product.featured'))}</span>` : ''))}
        <td class="cell-full"><div class="actions">
          ${p.status !== 'approved' ? `<button class="btn btn-primary btn-sm" data-ps="approved" data-id="${esc(p._id)}">${icon('check')}${esc(t('admin.approve'))}</button>` : ''}
          ${p.status !== 'rejected' ? `<button class="btn btn-danger btn-sm" data-ps="rejected" data-id="${esc(p._id)}">${icon('x')}${esc(t('admin.reject'))}</button>` : ''}
          ${p.status === 'approved' ? `<button class="btn btn-secondary btn-sm" data-feat="${!p.adminFeatured}" data-id="${esc(p._id)}">${icon('award')}${esc(p.adminFeatured ? t('admin.unfeature') : t('admin.feature'))}</button>` : ''}
        </div></td></tr>`).join(''), H.length);
      UI.pagination(document.getElementById('admin-pages'), res.pagination, (pg) => { st.page = pg; loadProducts(); });
    }

    root.querySelector('[data-tabs=p]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      st.status = b.dataset.v;
      st.page = 1;
      root.querySelectorAll('[data-tabs=p] [role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      loadProducts();
    });
    document.getElementById('p-q').addEventListener('input', UI.debounce((e) => { st.q = e.target.value.trim(); st.page = 1; loadProducts(); }, 400));
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ps],[data-feat]');
      if (!b) return;
      if (b.dataset.ps === 'rejected') {
        UI.modal({
          title: t('admin.rejectTitle'),
          body: `<div class="form-group"><label for="rj">${esc(t('admin.rejectReason'))}</label><input class="input" id="rj" maxlength="200" placeholder="${esc(t('admin.rejectPh'))}"></div>`,
          actions: [{ label: t('common.cancel'), variant: 'btn-ghost' }, { label: t('admin.reject'), variant: 'btn-danger', onClick: async ({ body }) => { await setProductStatus(b.dataset.id, 'rejected', body.querySelector('#rj').value.trim()); loadProducts(); } }]
        });
      } else if (b.dataset.ps) {
        await setProductStatus(b.dataset.id, b.dataset.ps);
        loadProducts();
      } else {
        try {
          UI.toast((await API.put(`/admin/products/${b.dataset.id}/featured`, { featured: b.dataset.feat === 'true' })).message, 'success');
          loadProducts();
        } catch (err) { UI.toast(err.message, 'error'); }
      }
    });
    await loadProducts();
  }

  // ---------------- Orders ----------------
  async function orders() {
    const st = state.orders;
    root.innerHTML = `
      <div class="toolbar">
        <div class="input-icon">${icon('search')}<input class="input" id="o-q" type="search" placeholder="${esc(t('so.search'))}" value="${esc(st.q || '')}" aria-label="${esc(t('so.search'))}"></div>
        <select class="input" id="o-status" aria-label="${esc(t('so.col.status'))}"><option value="">${esc(t('admin.allStatus'))}</option>${Orders.FLOW.concat('cancelled').map((s) => `<option value="${s}">${esc(Orders.statusLabel(s))}</option>`).join('')}</select>
      </div><div id="o-table" style="margin-top:14px">${UI.spinner()}</div>`;
    const sel = document.getElementById('o-status');
    sel.value = st.status || '';
    async function loadOrders() {
      const res = await API.get('/admin/orders', { q: st.q, status: st.status, page: st.page });
      const H = [t('so.col.order'), t('so.col.customer'), t('market.seller'), t('so.col.amount'), t('so.col.payment'), t('so.col.status'), t('so.col.date'), ''];
      document.getElementById('o-table').innerHTML = tableWrap(H, res.data.map((o) => `<tr>
        ${td(H[0], `<strong>#${esc(o.orderNumber)}</strong>`)}${td(H[1], esc(o.customerName))}${td(H[2], esc(o.sellerName))}
        ${td(H[3], price(o.totalAmount))}${td(H[4], `${esc(Orders.paymentLabel(o.paymentMethod))} ${UI.badge(o.paymentStatus)}`)}
        ${td(H[5], UI.badge(o.orderStatus))}${td(H[6], esc(UI.date(o.createdAt)))}
        <td class="cell-full"><a class="btn btn-secondary btn-sm" href="/order-details.html?id=${esc(o._id)}">${esc(t('admin.manage'))}</a></td></tr>`).join(''), H.length);
      UI.pagination(document.getElementById('admin-pages'), res.pagination, (p) => { st.page = p; loadOrders(); });
    }
    document.getElementById('o-q').addEventListener('input', UI.debounce((e) => { st.q = e.target.value.trim(); st.page = 1; loadOrders(); }, 400));
    sel.addEventListener('change', () => { st.status = sel.value; st.page = 1; loadOrders(); });
    await loadOrders();
  }

  // ---------------- Reviews ----------------
  async function reviews() {
    const st = state.reviews;
    root.innerHTML = `${tabs('r', [['flagged', t('status.flagged')], ['approved', t('status.approved')], ['hidden', t('status.hidden')], ['', t('market.all')]], st.status)}<div id="r-list" style="margin-top:14px">${UI.spinner()}</div>`;
    async function loadReviews() {
      const res = await API.get('/admin/reviews', { status: st.status, page: st.page });
      const el = document.getElementById('r-list');
      el.innerHTML = res.data.length ? res.data.map((r) => `
        <article class="card" style="margin-bottom:12px">
          <div class="review-head"><strong>${esc(r.productName)}</strong>${UI.stars(r.rating)}<span class="small muted">${esc(r.customerName)} · ${esc(UI.date(r.createdAt))}</span>${UI.badge(r.status)}</div>
          <p>${esc(r.comment || t('review.noComment'))}</p>
          ${r.reportReason ? `<p class="small" style="color:var(--warning)">${icon('flag')} ${esc(t('admin.reportedFor'))}: ${esc(r.reportReason)}</p>` : ''}
          <div class="row">
            ${r.status !== 'approved' ? `<button class="btn btn-primary btn-sm" data-rs="approved" data-id="${esc(r._id)}">${icon('check')}${esc(t('admin.keepReview'))}</button>` : ''}
            ${r.status !== 'hidden' ? `<button class="btn btn-danger btn-sm" data-rs="hidden" data-id="${esc(r._id)}">${icon('eye-off')}${esc(t('admin.hideReview'))}</button>` : ''}
          </div>
        </article>`).join('') + '<nav class="pagination" id="admin-pages"></nav>' : UI.emptyState({ icon: 'message-square', title: t('admin.nothing') });
      UI.pagination(document.getElementById('admin-pages'), res.pagination, (p) => { st.page = p; loadReviews(); });
    }
    root.querySelector('[data-tabs=r]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      st.status = b.dataset.v;
      st.page = 1;
      root.querySelectorAll('[data-tabs=r] [role=tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      loadReviews();
    });
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-rs]');
      if (!b) return;
      try {
        UI.toast((await API.put(`/admin/reviews/${b.dataset.id}/status`, { status: b.dataset.rs })).message, 'success');
        Dashboard.refreshCounts();
        loadReviews();
      } catch (err) { UI.toast(err.message, 'error'); }
    });
    await loadReviews();
  }

  // ---------------- Categories ----------------
  async function categories() {
    const { data } = await API.get('/categories', { all: 'true' });
    root.innerHTML = `
      <section class="card">
        <h2 style="font-size:1.1rem">${esc(t('admin.addCategory'))}</h2>
        <form id="cat-form" class="form-row three">
          <div class="form-group"><label for="c-name" class="required">${esc(t('admin.catName'))}</label><input class="input" id="c-name" name="name" maxlength="50"></div>
          <div class="form-group"><label for="c-hi">${esc(t('admin.catNameHi'))}</label><input class="input" id="c-hi" name="nameHi" maxlength="50" lang="hi"></div>
          <div class="form-group"><label for="c-icon">${esc(t('admin.catIcon'))}</label><input class="input" id="c-icon" name="icon" value="package" maxlength="30"><span class="hint">${esc(t('admin.catIconHint'))}</span></div>
          <div><button class="btn btn-primary" type="submit">${icon('plus')}<span>${esc(t('admin.addCategory'))}</span></button></div>
        </form>
      </section>
      ${tableWrap([t('admin.catName'), t('admin.catNameHi'), t('seller.products'), t('admin.status'), t('admin.col.actions')], data.map((c) => `<tr>
        ${td(t('admin.catName'), `${icon(c.icon)} <strong>${esc(c.name)}</strong> <span class="small muted">(${esc(c.slug)})</span>`)}
        ${td(t('admin.catNameHi'), esc(c.nameHi))}
        ${td(t('seller.products'), number(c.productCount))}
        ${td(t('admin.status'), UI.badge(c.active ? 'active' : 'hidden'))}
        <td class="cell-full"><div class="actions">
          <button class="btn btn-secondary btn-sm" data-cat-edit="${esc(c._id)}">${icon('pencil')}${esc(t('common.edit'))}</button>
          <button class="btn btn-ghost btn-sm" data-cat-toggle="${esc(c._id)}" data-active="${!c.active}">${esc(c.active ? t('admin.hide') : t('admin.show'))}</button>
          ${c.productCount === 0 ? `<button class="btn btn-danger btn-sm" data-cat-del="${esc(c._id)}">${icon('trash-2')}${esc(t('common.delete'))}</button>` : ''}
        </div></td></tr>`).join(''), 5)}`;

    const form = document.getElementById('cat-form');
    const v = UI.validator(form, { name: (x) => (x.trim().length < 2 ? t('admin.val.catName') : '') });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!v.validate()) return;
      try {
        UI.toast((await API.post('/admin/categories', Object.fromEntries(new FormData(form)))).message, 'success');
        route();
      } catch (err) { UI.formError(form, err); }
    });
    root.addEventListener('click', async (e) => {
      const edit = e.target.closest('[data-cat-edit]');
      const tog = e.target.closest('[data-cat-toggle]');
      const del = e.target.closest('[data-cat-del]');
      try {
        if (edit) {
          const c = data.find((x) => x._id === edit.dataset.catEdit);
          UI.modal({
            title: t('admin.editCategory'),
            body: `<form id="ce"><div class="form-group"><label for="ce-n">${esc(t('admin.catName'))}</label><input class="input" id="ce-n" name="name" value="${esc(c.name)}"></div>
              <div class="form-group"><label for="ce-h">${esc(t('admin.catNameHi'))}</label><input class="input" id="ce-h" name="nameHi" value="${esc(c.nameHi)}" lang="hi"></div>
              <div class="form-group"><label for="ce-i">${esc(t('admin.catIcon'))}</label><input class="input" id="ce-i" name="icon" value="${esc(c.icon)}"></div></form>`,
            actions: [{ label: t('common.cancel'), variant: 'btn-ghost' }, {
              label: t('common.save'), variant: 'btn-primary', onClick: async ({ body }) => {
                try {
                  UI.toast((await API.put(`/admin/categories/${c._id}`, Object.fromEntries(new FormData(body.querySelector('#ce'))))).message, 'success');
                  route();
                } catch (err) { UI.formError(body.querySelector('#ce'), err); return false; }
              }
            }]
          });
        }
        if (tog) {
          const c = data.find((x) => x._id === tog.dataset.catToggle);
          UI.toast((await API.put(`/admin/categories/${c._id}`, { name: c.name, active: tog.dataset.active === 'true' })).message, 'success');
          route();
        }
        if (del) {
          if (!(await UI.confirm(t('admin.confirmDeleteCat'), { danger: true, confirmLabel: t('common.delete') }))) return;
          UI.toast((await API.del(`/admin/categories/${del.dataset.catDel}`)).message, 'success');
          route();
        }
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  // ---------------- Reports ----------------
  async function reports() {
    const { data: r } = await API.get('/admin/reports');
    const cats = await Products.categories();
    root.innerHTML = `
      <section class="card chart-card"><div class="card-title"><h2>${esc(t('admin.monthlySales'))}</h2></div><div id="r-monthly"></div></section>
      <div class="dash-grid two">
        <section class="card"><div class="card-title"><h2>${esc(t('sales.byStatus'))}</h2></div><div id="r-status"></div></section>
        <section class="card"><div class="card-title"><h2>${esc(t('admin.salesByCategory'))}</h2></div><div id="r-cat"></div></section>
        <section class="card"><div class="card-title"><h2>${esc(t('admin.topSellers'))}</h2></div><div id="r-sellers"></div></section>
        <section class="card"><div class="card-title"><h2>${esc(t('admin.usersByRole'))}</h2></div><div id="r-users"></div></section>
      </div>
      <section class="card"><div class="card-title"><h2>${esc(t('admin.paymentsReport'))}</h2></div>
        ${tableWrap([t('order.method'), t('order.paymentStatus'), t('admin.count'), t('so.col.amount')], r.payments.map((p) => `<tr>${td(t('order.method'), esc(Orders.paymentLabel(p.method)))}${td(t('order.paymentStatus'), UI.badge(p.status))}${td(t('admin.count'), number(p.count))}${td(t('so.col.amount'), price(p.amount))}</tr>`).join(''), 4)}
      </section>`;
    Charts.barChart(document.getElementById('r-monthly'), r.monthly.map((m) => ({ label: UI.date(m.date + '-01', { month: 'short', year: 'numeric' }), short: UI.date(m.date + '-01', { month: 'short' }), value: m.sales, extra: t('sales.ordersN', { n: m.orders }) })), { format: price, title: t('admin.monthlySales') });
    Charts.hbarList(document.getElementById('r-status'), Orders.FLOW.concat('cancelled').filter((s) => r.ordersByStatus[s]).map((s) => ({ label: Orders.statusLabel(s), value: r.ordersByStatus[s] })), { format: number });
    Charts.hbarList(document.getElementById('r-cat'), r.byCategory.map((c) => ({ label: Products.catName(cats.find((x) => x.slug === c._id)) || c._id, value: c.sales, display: price(c.sales) })), { tone: 'earth' });
    Charts.hbarList(document.getElementById('r-sellers'), r.topSellers.map((s) => ({ label: s.name || '—', value: s.sales, display: `${price(s.sales)} · ${t('sales.ordersN', { n: s.orders })}` })));
    Charts.hbarList(document.getElementById('r-users'), Object.entries(r.usersByRole).map(([k, n]) => ({ label: t('role.' + k), value: n })), { format: number, tone: 'earth' });
  }

  const RENDER = { overview, users, products, orders, reviews, categories, reports };

  async function route() {
    const section = SECTIONS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
    titleEl.textContent = t(`admin.nav.${section}`);
    document.title = `${t(`admin.nav.${section}`)} – ${t('admin.title')} – SHG Connect`;
    // Replace the root node so old delegated listeners are dropped
    const fresh = root.cloneNode(false);
    root.replaceWith(fresh);
    root = fresh;
    root.innerHTML = UI.spinner();
    try {
      await RENDER[section]();
    } catch (err) {
      root.innerHTML = UI.errorState(err, route);
    }
    root.focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', route);
  await route();
});
