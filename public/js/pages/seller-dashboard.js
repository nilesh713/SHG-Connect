/* /seller-dashboard.html – simple overview for sellers */
App.page(async () => {
  const { esc, icon, price, number } = UI;
  const root = document.getElementById('dash-root');
  const user = Auth.getUser();
  root.innerHTML = UI.spinner();

  let d;
  try {
    d = (await API.get('/sellers/me/dashboard')).data;
  } catch (err) {
    root.innerHTML = UI.errorState(err, () => location.reload());
    return;
  }
  const c = d.cards;
  const setupSteps = [
    { done: d.setup.profile, key: 'dash.setup.profile', href: '/profile.html' },
    { done: d.setup.upi, key: 'dash.setup.upi', href: '/profile.html#upi' },
    { done: d.setup.product, key: 'dash.setup.product', href: '/add-product.html' },
    { done: d.setup.published, key: 'dash.setup.publish', href: '/seller-products.html' }
  ];
  const setupDone = setupSteps.every((s) => s.done);

  root.innerHTML = `
    <div>
      <h2 style="margin-bottom:4px">${esc(t('dash.hello', { name: user.name.split(' ')[0] }))}</h2>
      <p class="page-intro">${esc(c.newOrders ? t('dash.newOrdersMsg', { n: c.newOrders }) : t('dash.introMsg'))}</p>
    </div>

    ${c.newOrders ? `<a class="alert alert-warning" href="/orders.html?status=new" style="text-decoration:none">${icon('bell-ring')}<p><strong>${esc(t('dash.newOrdersAlert', { n: c.newOrders }))}</strong> ${esc(t('dash.tapToConfirm'))}</p></a>` : ''}

    ${setupDone ? '' : `
    <section class="card" aria-labelledby="setup-title">
      <div class="card-title"><h2 id="setup-title">${icon('list-checks')} ${esc(t('dash.setupTitle'))}</h2><span class="small muted">${setupSteps.filter((s) => s.done).length}/4</span></div>
      <ul class="checklist">${setupSteps.map((s) => `<li class="${s.done ? 'done' : ''}"><a href="${s.href}"><span class="check-dot">${s.done ? icon('check') : ''}</span>${esc(t(s.key))}${s.done ? '' : icon('chevron-right')}</a></li>`).join('')}</ul>
    </section>`}

    <div class="stat-grid">
      <a class="stat" href="/seller-products.html"><span class="stat-icon">${icon('package')}</span><span class="stat-value">${number(c.totalProducts)}</span><span class="stat-label">${esc(t('dash.totalProducts'))}</span></a>
      <a class="stat" href="/orders.html?status=active"><span class="stat-icon earth">${icon('shopping-bag')}</span><span class="stat-value">${number(c.activeOrders)}</span><span class="stat-label">${esc(t('dash.activeOrders'))}</span></a>
      <a class="stat" href="/orders.html?status=delivered"><span class="stat-icon blue">${icon('circle-check')}</span><span class="stat-value">${number(c.completedOrders)}</span><span class="stat-label">${esc(t('dash.completedOrders'))}</span></a>
      <a class="stat" href="/sales-history.html"><span class="stat-icon gold">${icon('indian-rupee')}</span><span class="stat-value">${price(c.totalSales)}</span><span class="stat-label">${esc(t('dash.totalSales'))}</span></a>
    </div>

    <div class="quick-actions">
      <a class="quick-action" href="/add-product.html">${icon('circle-plus')}<span>${esc(t('nav.addProduct'))}</span></a>
      <a class="quick-action alt" href="/orders.html">${icon('shopping-bag')}<span>${esc(t('dash.viewOrders'))}</span></a>
      <a class="quick-action alt" href="/promotions.html">${icon('megaphone')}<span>${esc(t('dash.promote'))}</span></a>
      <a class="quick-action alt" href="/sales-history.html">${icon('chart-column')}<span>${esc(t('nav.sales'))}</span></a>
    </div>

    <section class="card" aria-labelledby="ss-title">
        <div class="card-title"><h2 id="ss-title">${esc(t('dash.salesSummary'))}</h2><span class="small muted">${esc(t('dash.last7'))}</span></div>
        <div id="week-chart"></div>
      </section>

    <div class="dash-grid two">
      <section class="card" aria-labelledby="ro-title">
        <div class="card-title"><h2 id="ro-title">${esc(t('dash.recentOrders'))}</h2><a href="/orders.html" class="btn btn-ghost btn-sm">${esc(t('common.viewAll'))}</a></div>
        ${d.recentOrders.length ? `<ul class="list">${d.recentOrders.map((o) => `
          <li><span class="stat-icon" style="width:40px;height:40px">${icon(Orders.STEP_ICON[o.orderStatus])}</span>
            <span class="grow"><a href="/order-details.html?id=${esc(o._id)}"><strong>#${esc(o.orderNumber)}</strong> · ${esc(o.customerName)}</a>
            <span class="small muted">${esc(UI.timeAgo(o.createdAt))} · ${price(o.totalAmount)}</span></span>
            ${UI.badge(o.orderStatus)}</li>`).join('')}</ul>`
          : UI.emptyState({ icon: 'shopping-bag', title: t('dash.noOrders'), text: t('dash.noOrdersText'), actionLabel: t('dash.promote'), actionHref: '/promotions.html' })}
      </section>

      <section class="card" aria-labelledby="tp-title">
        <div class="card-title"><h2 id="tp-title">${esc(t('dash.topProducts'))}</h2><a href="/seller-products.html" class="btn btn-ghost btn-sm">${esc(t('common.viewAll'))}</a></div>
        ${d.topProducts.length ? `<ul class="list">${d.topProducts.map((p) => `
          <li><img src="${esc(UI.imageUrl(p.image))}" alt="" loading="lazy">
            <span class="grow"><strong>${esc(p.name)}</strong><span class="small muted">${icon('eye')} ${number(p.views)} ${esc(t('dash.views'))} · ${icon('shopping-bag')} ${number(p.soldCount)} ${esc(t('dash.sold'))}</span></span>
            ${UI.badge(p.status)}</li>`).join('')}</ul>`
          : UI.emptyState({ icon: 'package-open', title: t('sp.none'), text: t('sp.noneText'), actionLabel: t('nav.addProduct'), actionHref: '/add-product.html' })}
      </section>

      <section class="card" aria-labelledby="pv-title">
        <div class="card-title"><h2 id="pv-title">${esc(t('dash.visibility'))}</h2></div>
        <div class="row" style="margin-bottom:12px"><span class="stat-icon">${icon('eye')}</span><div><div class="stat-value">${number(c.productViews)}</div><div class="stat-label">${esc(t('dash.productViews'))}</div></div></div>
        <h3 style="font-size:1rem">${esc(t('dash.promotionStatus'))}</h3>
        ${d.promotions.length ? `<ul class="list">${d.promotions.map((p) => `
          <li><span class="tag ${p.type === 'featured' ? 'tag-featured' : p.type === 'discount' ? 'tag-discount' : 'tag-promoted'}">${esc(t('promo.type.' + p.type))}</span>
          <span class="grow"><strong>${esc(p.productName)}</strong><span class="small muted">${esc(t('promo.daysLeft', { n: p.daysLeft }))} · ${number(p.views)} ${esc(t('dash.views'))} · ${number(p.clicks)} ${esc(t('promo.clicks'))}</span></span></li>`).join('')}</ul>`
          : `<p class="muted small">${esc(t('dash.noPromotions'))}</p><a class="btn btn-earth btn-sm" href="/promotions.html">${icon('megaphone')}<span>${esc(t('dash.promote'))}</span></a>`}
      </section>
    </div>`;

  Charts.barChart(document.getElementById('week-chart'), d.salesSummary.map((s) => ({
    label: UI.date(s.date, { weekday: 'short', day: 'numeric', month: 'short' }),
    short: UI.date(s.date, { weekday: 'short' }),
    value: s.sales,
    extra: t('sales.ordersN', { n: s.orders })
  })), { format: price, title: t('dash.salesSummary') });

  Dashboard.setCount({ newOrders: c.newOrders });
});
