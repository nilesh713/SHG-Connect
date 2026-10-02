/* Reusable UI components: toast, modal, confirm, spinner, empty state, pagination,
   form validation, badges, stars and small formatting helpers. Exposed as window.UI */
(function () {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  // Always escape user/API text before putting it into HTML
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

  const icon = (name, cls = '') => `<i data-lucide="${esc(name)}" class="${esc(cls)}" aria-hidden="true"></i>`;

  function refreshIcons() {
    if (window.lucide && lucide.createIcons) lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
  }

  const locale = () => (window.I18N && I18N.lang === 'hi' ? 'hi-IN' : 'en-IN');
  const price = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const number = (n) => Number(n || 0).toLocaleString('en-IN');
  const date = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => (d ? new Date(d).toLocaleDateString(locale(), opts) : '');
  const dateTime = (d) => (d ? new Date(d).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
  function timeAgo(d) {
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return t('time.justNow');
    if (s < 3600) return t('time.minutes', { n: Math.floor(s / 60) });
    if (s < 86400) return t(s < 7200 ? 'time.hour' : 'time.hours', { n: Math.floor(s / 3600) });
    if (s < 604800) return t(s < 172800 ? 'time.day' : 'time.days', { n: Math.floor(s / 86400) });
    return date(d);
  }

  const debounce = (fn, ms = 350) => {
    let id;
    return (...a) => {
      clearTimeout(id);
      id = setTimeout(() => fn(...a), ms);
    };
  };

  const isEmail = (v) => /^\S+@\S+\.\S+$/.test(String(v).trim());
  const qs = (name) => new URLSearchParams(location.search).get(name);
  const imageUrl = (src) => src || '/assets/placeholder.svg';

  // ---------- Toast ----------
  function toast(message, type = 'info', timeout = 4500) {
    let region = document.getElementById('toast-region');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toast-region';
      region.className = 'toast-region';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('role', 'status');
      document.body.appendChild(region);
    }
    const icons = { success: 'circle-check', error: 'circle-alert', warning: 'triangle-alert', info: 'info' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `${icon(icons[type] || 'info')}<span>${esc(message)}</span><button type="button" aria-label="${esc(t('common.close'))}">×</button>`;
    region.appendChild(el);
    refreshIcons();
    const remove = () => el.remove();
    el.querySelector('button').addEventListener('click', remove);
    setTimeout(remove, timeout);
  }

  // ---------- Modal ----------
  function modal({ title, body = '', actions = [], size, onOpen } = {}) {
    const prevFocus = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const id = 'modal-title-' + Math.random().toString(36).slice(2, 8);
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${id}" ${size ? `style="max-width:${size}px"` : ''}>
        <div class="modal-head">
          <h2 id="${id}">${esc(title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="${esc(t('common.close'))}">${icon('x')}</button>
        </div>
        <div class="modal-body"></div>
        ${actions.length ? '<div class="modal-foot"></div>' : ''}
      </div>`;
    const bodyEl = backdrop.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else bodyEl.appendChild(body);

    const close = () => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };

    const foot = backdrop.querySelector('.modal-foot');
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.type = a.type || 'button';
      b.className = `btn ${a.variant || 'btn-secondary'}`;
      b.innerHTML = (a.icon ? icon(a.icon) : '') + `<span>${esc(a.label)}</span>`;
      if (a.form) b.setAttribute('form', a.form);
      b.addEventListener('click', async () => {
        if (!a.onClick) return close();
        const r = await a.onClick({ close, button: b, body: bodyEl });
        if (r !== false && a.closeOnClick !== false) close();
      });
      foot.appendChild(b);
    });

    // Focus trap + Escape to close
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const f = backdrop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const list = [...f].filter((x) => !x.disabled && x.offsetParent !== null);
        if (!list.length) return;
        if (e.shiftKey && document.activeElement === list[0]) { e.preventDefault(); list[list.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === list[list.length - 1]) { e.preventDefault(); list[0].focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelector('[data-close]').addEventListener('click', close);

    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    refreshIcons();
    const first = bodyEl.querySelector('input, select, textarea') || backdrop.querySelector('.modal-foot .btn') || backdrop.querySelector('[data-close]');
    if (first) first.focus();
    if (onOpen) onOpen({ body: bodyEl, close });
    return { close, el: backdrop, body: bodyEl };
  }

  function confirmDialog(message, { title = t('common.areYouSure'), confirmLabel = t('common.yes'), danger = false } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      const m = modal({
        title,
        body: `<p>${esc(message)}</p>`,
        actions: [
          { label: t('common.cancel'), variant: 'btn-ghost', onClick: () => { answered = true; resolve(false); } },
          { label: confirmLabel, variant: danger ? 'btn-danger' : 'btn-primary', onClick: () => { answered = true; resolve(true); } }
        ]
      });
      // Resolve false when closed with X / Escape / backdrop
      const obs = new MutationObserver(() => {
        if (!document.body.contains(m.el)) { obs.disconnect(); if (!answered) resolve(false); }
      });
      obs.observe(document.body, { childList: true });
    });
  }

  // ---------- Loading / empty ----------
  const spinner = (text = t('common.loading')) => `<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span><span>${esc(text)}</span></div>`;

  function setLoading(btn, on) {
    if (!btn) return;
    if (on) {
      btn.dataset.html = btn.innerHTML;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${esc(t('common.pleaseWait'))}</span>`;
    } else {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
      refreshIcons();
    }
  }

  function emptyState({ icon: ic = 'package-open', title, text = '', actionLabel, actionHref, actionId } = {}) {
    const action = actionLabel
      ? actionHref
        ? `<a class="btn btn-primary" href="${esc(actionHref)}">${icon('plus')}<span>${esc(actionLabel)}</span></a>`
        : `<button class="btn btn-primary" type="button" id="${esc(actionId || '')}">${esc(actionLabel)}</button>`
      : '';
    return `<div class="empty-state"><div class="empty-icon">${icon(ic)}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
  }

  function errorState(err, retry) {
    const id = 'retry-' + Math.random().toString(36).slice(2, 7);
    setTimeout(() => {
      const b = document.getElementById(id);
      if (b && retry) b.addEventListener('click', retry);
    });
    return `<div class="empty-state"><div class="empty-icon" style="background:var(--error-bg);color:var(--error)">${icon('wifi-off')}</div>
      <h3>${esc(t('err.loadTitle'))}</h3><p>${esc(err && err.message ? err.message : t('err.generic'))}</p>
      ${retry ? `<button class="btn btn-secondary" id="${id}" type="button">${icon('refresh-cw')}<span>${esc(t('common.retry'))}</span></button>` : ''}</div>`;
  }

  // ---------- Pagination ----------
  function pagination(container, meta, onPage) {
    if (!container) return;
    if (!meta || meta.pages <= 1) { container.innerHTML = ''; return; }
    const { page, pages } = meta;
    const nums = [];
    for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
    container.innerHTML = `
      <button type="button" data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="${esc(t('common.prev'))}">‹</button>
      ${nums.map((n) => `<button type="button" data-p="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`).join('')}
      <button type="button" data-p="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="${esc(t('common.next'))}">›</button>`;
    container.setAttribute('aria-label', t('common.pagination'));
    container.querySelectorAll('button[data-p]').forEach((b) =>
      b.addEventListener('click', () => onPage(Number(b.dataset.p)))
    );
  }

  // ---------- Badges & stars ----------
  const STATUS_TONE = {
    new: 'pending', confirmed: 'pending', processing: 'warning', ready_to_ship: 'warning', shipped: 'pending',
    out_for_delivery: 'warning', delivered: 'success', cancelled: 'error',
    pending: 'warning', paid: 'success', failed: 'error', refunded: 'neutral',
    approved: 'success', rejected: 'error', draft: 'neutral', flagged: 'warning', hidden: 'error',
    active: 'success', suspended: 'error', ended: 'neutral'
  };
  const badge = (status, group = 'status') => `<span class="badge badge-${STATUS_TONE[status] || 'neutral'}">${esc(t(`${group}.${status}`))}</span>`;

  function stars(rating, count) {
    const r = Math.round(Number(rating || 0));
    let html = `<span class="stars" aria-label="${esc(t('product.ratingAria', { rating: Number(rating || 0).toFixed(1) }))}">`;
    for (let i = 1; i <= 5; i++) html += icon('star', i <= r ? 'filled' : '');
    if (count !== undefined) html += `<span class="count">${count ? `${Number(rating).toFixed(1)} (${count})` : esc(t('product.noRatings'))}</span>`;
    return html + '</span>';
  }

  function starInput(name = 'rating') {
    let html = `<fieldset class="star-input-wrap" style="border:0;padding:0;margin:0"><legend class="label">${esc(t('review.yourRating'))}</legend><div class="star-input">`;
    for (let i = 5; i >= 1; i--) {
      html += `<input type="radio" id="${name}-${i}" name="${name}" value="${i}"><label for="${name}-${i}" title="${i}">${icon('star')}<span class="sr-only">${i} ${esc(t('review.stars'))}</span></label>`;
    }
    return html + '</div></fieldset>';
  }

  // ---------- Form validation ----------
  // rules: { fieldName: (value, form) => errorMessage | '' }
  function validator(form, rules) {
    form.setAttribute('novalidate', '');
    const errorEl = (name) => {
      const field = form.elements[name];
      const el = field && (field.length && !field.tagName ? field[0] : field);
      if (!el) return null;
      const group = el.closest('.form-group') || el.closest('fieldset') || el.parentElement;
      let err = group.querySelector('.field-error');
      if (!err) {
        err = document.createElement('p');
        err.className = 'field-error';
        err.id = `err-${name}-${Math.random().toString(36).slice(2, 6)}`;
        group.appendChild(err);
      }
      return { el, err };
    };

    function setError(name, message) {
      const r = errorEl(name);
      if (!r) return;
      r.err.textContent = message || '';
      const inputs = form.elements[name].length && !form.elements[name].tagName ? [...form.elements[name]] : [r.el];
      inputs.forEach((i) => {
        if (message) {
          i.setAttribute('aria-invalid', 'true');
          i.setAttribute('aria-describedby', r.err.id);
        } else {
          i.removeAttribute('aria-invalid');
        }
      });
    }

    function check(name) {
      const field = form.elements[name];
      if (!field) return true;
      const value = field.length && !field.tagName ? (form.querySelector(`[name="${name}"]:checked`) || {}).value || '' : field.value;
      const msg = rules[name](value, form);
      setError(name, msg);
      return !msg;
    }

    Object.keys(rules).forEach((name) => {
      const field = form.elements[name];
      if (!field) return;
      const list = field.length && !field.tagName ? [...field] : [field];
      list.forEach((el) => {
        el.addEventListener('blur', () => { if (el.getAttribute('aria-invalid') || el.value) check(name); });
        el.addEventListener('change', () => { if (el.getAttribute('aria-invalid')) check(name); });
      });
    });

    return {
      validate(names = Object.keys(rules)) {
        let firstBad = null;
        names.forEach((n) => {
          if (!check(n) && !firstBad) firstBad = n;
        });
        if (firstBad) {
          const f = form.elements[firstBad];
          (f.length && !f.tagName ? f[0] : f).focus();
          toast(t('val.fixErrors'), 'error');
        }
        return !firstBad;
      },
      setError,
      check
    };
  }

  // Show server-side validation errors next to the fields (or as a toast)
  function formError(form, err) {
    let shown = false;
    if (err && err.errors && err.errors.length && form) {
      err.errors.forEach((e) => {
        const field = form.elements[e.field] || form.elements[(e.field || '').split('.').pop()];
        if (!field) return;
        const el = field.length && !field.tagName ? field[0] : field;
        const group = el.closest('.form-group') || el.parentElement;
        let p = group.querySelector('.field-error');
        if (!p) {
          p = document.createElement('p');
          p.className = 'field-error';
          group.appendChild(p);
        }
        p.textContent = e.message;
        el.setAttribute('aria-invalid', 'true');
        if (!shown) el.focus();
        shown = true;
      });
    }
    toast(err && err.message ? err.message : t('err.generic'), 'error');
  }

  // Password show/hide buttons: <button class="toggle-pass" data-target="id">
  function bindPasswordToggles(root = document) {
    root.querySelectorAll('.toggle-pass').forEach((b) => {
      b.addEventListener('click', () => {
        const input = document.getElementById(b.dataset.target);
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        b.setAttribute('aria-label', show ? t('auth.hidePassword') : t('auth.showPassword'));
        b.innerHTML = icon(show ? 'eye-off' : 'eye');
        refreshIcons();
      });
    });
  }

  // WhatsApp share/contact links (no backend integration needed)
  const whatsappLink = (phone, text) => `https://wa.me/${encodeURIComponent(phone || '')}?text=${encodeURIComponent(text)}`;
  const whatsappShare = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

  window.UI = {
    esc, icon, refreshIcons, price, number, date, dateTime, timeAgo, debounce, isEmail, qs, imageUrl,
    toast, modal, confirm: confirmDialog, spinner, setLoading, emptyState, errorState, pagination,
    badge, stars, starInput, validator, formError, bindPasswordToggles, whatsappLink, whatsappShare
  };
})();
