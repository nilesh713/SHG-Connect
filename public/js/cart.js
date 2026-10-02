/* Shopping cart kept in the browser (localStorage). Orders themselves are created in MongoDB at checkout. */
(function () {
  const KEY = 'shg_cart';

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }
  function save(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* storage blocked */ }
    document.dispatchEvent(new CustomEvent('cart:change', { detail: { count: Cart.count() } }));
  }

  // Product object from the API → compact cart line
  function lineFrom(p, quantity) {
    return {
      productId: p._id,
      name: p.name,
      price: p.finalPrice ?? p.price,
      image: (p.images && p.images[0]) || '',
      sellerId: p.sellerId,
      sellerName: (p.seller && p.seller.businessName) || '',
      acceptsUpi: Boolean(p.seller && p.seller.acceptsUpi),
      maxQty: p.quantity,
      deliveryCharge: p.deliveryOption === 'pickup' ? 0 : p.deliveryCharge || 0,
      quantity
    };
  }

  const Cart = {
    items: load,
    count: () => load().reduce((s, i) => s + i.quantity, 0),

    add(product, qty = 1) {
      const user = window.Auth && Auth.getUser();
      if (user && String(user._id) === String(product.sellerId)) {
        UI.toast(t('cart.ownProduct'), 'warning');
        return false;
      }
      if (!product.quantity || product.quantity < 1) {
        UI.toast(t('product.outOfStock'), 'error');
        return false;
      }
      const items = load();
      const existing = items.find((i) => i.productId === product._id);
      const before = existing ? existing.quantity : 0;
      const newQty = Math.min(product.quantity, before + qty);
      if (existing) Object.assign(existing, lineFrom(product, newQty));
      else items.push(lineFrom(product, newQty));
      save(items);
      if (newQty === before) UI.toast(t('cart.maxReached', { n: product.quantity }), 'warning');
      else UI.toast(t('cart.added', { name: product.name }), 'success');
      return true;
    },

    setQty(productId, qty) {
      const items = load();
      const it = items.find((i) => i.productId === productId);
      if (!it) return;
      it.quantity = Math.max(1, Math.min(it.maxQty || 100, qty));
      save(items);
    },

    remove(productId) {
      save(load().filter((i) => i.productId !== productId));
    },

    clear(productIds) {
      save(productIds ? load().filter((i) => !productIds.includes(i.productId)) : []);
    },

    // Refresh prices/stock from the API; drops products that are no longer available
    async sync() {
      const items = load();
      const fresh = [];
      const removed = [];
      await Promise.all(
        items.map(async (it) => {
          try {
            const res = await API.get(`/products/${it.productId}`);
            const p = res.data;
            if (p.status !== 'approved' || p.quantity < 1) return removed.push(it.name);
            fresh.push(lineFrom(p, Math.min(it.quantity, p.quantity)));
          } catch (e) {
            if (e.status === 404) removed.push(it.name);
            else fresh.push(it); // keep the line if the network failed
          }
        })
      );
      // keep the original order
      fresh.sort((a, b) => items.findIndex((i) => i.productId === a.productId) - items.findIndex((i) => i.productId === b.productId));
      save(fresh);
      if (removed.length) UI.toast(t('cart.removedUnavailable', { names: removed.join(', ') }), 'warning', 7000);
      return fresh;
    },

    // Group lines by seller and compute totals the same way the server does
    summary(items = load()) {
      const groups = new Map();
      items.forEach((i) => {
        if (!groups.has(i.sellerId)) groups.set(i.sellerId, { sellerId: i.sellerId, sellerName: i.sellerName, acceptsUpi: i.acceptsUpi, items: [] });
        groups.get(i.sellerId).items.push(i);
      });
      let itemsTotal = 0;
      let delivery = 0;
      const list = [...groups.values()].map((g) => {
        g.itemsTotal = g.items.reduce((s, i) => s + i.price * i.quantity, 0);
        g.deliveryCharge = Math.max(0, ...g.items.map((i) => i.deliveryCharge || 0));
        itemsTotal += g.itemsTotal;
        delivery += g.deliveryCharge;
        return g;
      });
      return { groups: list, itemsTotal, delivery, total: itemsTotal + delivery, allAcceptUpi: list.every((g) => g.acceptsUpi) };
    }
  };

  // Keep the cart badge in sync across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) document.dispatchEvent(new CustomEvent('cart:change', { detail: { count: Cart.count() } }));
  });

  window.Cart = Cart;
})();
