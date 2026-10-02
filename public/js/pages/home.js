/* Landing page: categories, featured products and featured artisans from MongoDB */
App.page(async () => {
  const { esc, icon } = UI;
  const catGrid = document.getElementById('category-grid');
  const featuredGrid = document.getElementById('featured-grid');
  const artisanGrid = document.getElementById('artisan-grid');
  featuredGrid.innerHTML = UI.spinner();

  Products.categories().then((cats) => {
    catGrid.innerHTML = cats.map((c) => `
      <a class="category-tile" href="/products.html?category=${encodeURIComponent(c.slug)}">${icon(c.icon || 'package')}<span>${esc(Products.catName(c))}</span>
      <span class="small muted">${c.productCount} ${esc(t('seller.products'))}</span></a>`).join('');
  });

  async function loadFeatured() {
    try {
      // Featured first; top up with promoted / newest so the section is never empty
      let { data } = await API.get('/products', { featured: 'true', limit: 8 });
      if (data.length < 8) {
        const more = await API.get('/products', { sort: 'popular', limit: 8 });
        const ids = new Set(data.map((p) => p._id));
        data = data.concat(more.data.filter((p) => !ids.has(p._id))).slice(0, 8);
      }
      featuredGrid.innerHTML = data.length
        ? data.map((p) => Products.ProductCard(p)).join('')
        : UI.emptyState({ icon: 'package-open', title: t('market.noProducts'), text: t('home.noProductsText'), actionLabel: t('home.ctaSell'), actionHref: '/register.html?role=seller' });
    } catch (err) {
      featuredGrid.innerHTML = UI.errorState(err, loadFeatured);
    }
  }

  async function loadArtisans() {
    try {
      const { data } = await API.get('/sellers', { featured: 'true', limit: 6 });
      artisanGrid.innerHTML = data.length ? data.map(Products.SellerCard).join('') : `<p class="muted">${esc(t('home.noArtisans'))}</p>`;
    } catch (err) {
      artisanGrid.innerHTML = '';
    }
  }

  await Promise.all([loadFeatured(), loadArtisans()]);
});
