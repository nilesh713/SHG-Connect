/* Order helpers shared by customer, seller and admin pages: status flow, timeline, next action. */
(function () {
  const { esc, icon } = UI;

  const FLOW = ['new', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered'];
  // Customers see a simpler timeline ("Ready to ship" is folded into "Processing")
  const CUSTOMER_FLOW = ['new', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
  const STEP_ICON = {
    new: 'clipboard-list', confirmed: 'circle-check', processing: 'package', ready_to_ship: 'package-check',
    shipped: 'truck', out_for_delivery: 'bike', delivered: 'house', cancelled: 'circle-x'
  };

  // The one big button a seller sees for each status
  const NEXT_ACTION = {
    new: { status: 'confirmed', label: 'order.action.confirm', icon: 'circle-check' },
    confirmed: { status: 'processing', label: 'order.action.process', icon: 'package' },
    processing: { status: 'ready_to_ship', label: 'order.action.ready', icon: 'package-check' },
    ready_to_ship: { status: 'shipped', label: 'order.action.ship', icon: 'truck' },
    shipped: { status: 'out_for_delivery', label: 'order.action.outForDelivery', icon: 'bike' },
    out_for_delivery: { status: 'delivered', label: 'order.action.deliver', icon: 'house' }
  };

  const statusLabel = (s) => t(`status.${s}`);

  function timeline(order, viewer = 'customer') {
    const flow = viewer === 'customer' ? CUSTOMER_FLOW : FLOW;
    const history = order.statusHistory || [];
    const at = (s) => {
      const h = [...history].reverse().find((x) => x.status === s);
      return h ? h.at : null;
    };
    const cancelled = order.orderStatus === 'cancelled';
    let current = order.orderStatus;
    if (viewer === 'customer' && current === 'ready_to_ship') current = 'processing';
    const curIdx = cancelled
      ? flow.indexOf((history.filter((h) => h.status !== 'cancelled').pop() || { status: 'new' }).status)
      : flow.indexOf(current);

    const items = flow.map((s, i) => {
      const done = i < curIdx || (i === curIdx && (s === 'delivered' || cancelled));
      const isCur = i === curIdx && !done;
      const when = at(s);
      const cls = done ? 'done' : isCur ? 'current' : '';
      return `<li class="${cls}">
        <span class="tl-dot">${icon(done ? 'check' : STEP_ICON[s])}</span>
        <span class="tl-text"><strong>${esc(s === 'new' ? t('order.placedStep') : statusLabel(s))}</strong>
        <small>${when ? esc(UI.dateTime(when)) : isCur ? esc(t('order.inProgress')) : esc(t('order.waiting'))}</small></span>
        <span class="sr-only">${done ? t('order.stepDone') : isCur ? t('order.stepCurrent') : t('order.stepPending')}</span>
      </li>`;
    });
    if (cancelled) {
      // Show only the steps reached before cancellation, then the cancelled step
      const reached = items.slice(0, curIdx + 1);
      reached.push(`<li class="cancelled"><span class="tl-dot">${icon('x')}</span><span class="tl-text"><strong>${esc(statusLabel('cancelled'))}</strong><small>${esc(UI.dateTime(at('cancelled')))}${order.cancelReason ? ' · ' + esc(order.cancelReason) : ''}</small></span></li>`);
      return `<ol class="timeline" aria-label="${esc(t('order.timeline'))}">${reached.join('')}</ol>`;
    }
    return `<ol class="timeline" aria-label="${esc(t('order.timeline'))}">${items.join('')}</ol>`;
  }

  // Thin progress bar used on order cards
  function progressMini(order) {
    const idx = CUSTOMER_FLOW.indexOf(order.orderStatus === 'ready_to_ship' ? 'processing' : order.orderStatus);
    return `<div class="progress-mini" aria-hidden="true">${CUSTOMER_FLOW.map((s, i) => `<span class="${order.orderStatus !== 'cancelled' && i <= idx ? 'on' : ''}"></span>`).join('')}</div>`;
  }

  const paymentLabel = (m) => t(`payment.${m}`);

  /**
   * Opens a modal to move the order forward. For "shipped" it asks for courier details.
   * Resolves with the updated order or null.
   */
  async function advance(order, nextStatus) {
    const needsShipping = nextStatus === 'shipped';
    const isCancel = nextStatus === 'cancelled';
    return new Promise((resolve) => {
      let done = false;
      const body = `
        <form id="status-form">
          <p>${esc(t('order.changeTo', { order: order.orderNumber, status: statusLabel(nextStatus) }))}</p>
          ${needsShipping ? `
            <div class="form-group"><label for="sf-partner">${esc(t('order.deliveryPartner'))}</label>
              <input class="input" id="sf-partner" name="deliveryPartner" maxlength="60" placeholder="${esc(t('order.deliveryPartnerPh'))}" value="${esc(order.deliveryInfo?.partner || '')}"></div>
            <div class="form-group"><label for="sf-track">${esc(t('order.trackingId'))} <span class="muted small">(${esc(t('common.optional'))})</span></label>
              <input class="input" id="sf-track" name="trackingId" maxlength="60" value="${esc(order.deliveryInfo?.trackingId || '')}"></div>
            <div class="form-group"><label for="sf-date">${esc(t('order.expectedDate'))} <span class="muted small">(${esc(t('common.optional'))})</span></label>
              <input class="input" id="sf-date" type="date" name="expectedDate" min="${new Date().toISOString().slice(0, 10)}"></div>` : ''}
          <div class="form-group"><label for="sf-note">${esc(isCancel ? t('order.cancelReason') : t('order.note'))} <span class="muted small">(${esc(t('common.optional'))})</span></label>
            <input class="input" id="sf-note" name="note" maxlength="200"></div>
        </form>`;
      const m = UI.modal({
        title: isCancel ? t('order.cancelTitle') : statusLabel(nextStatus),
        body,
        actions: [
          { label: t('common.back'), variant: 'btn-ghost', onClick: () => { done = true; resolve(null); } },
          {
            label: isCancel ? t('order.action.cancel') : t('common.confirm'),
            variant: isCancel ? 'btn-danger' : 'btn-primary',
            closeOnClick: false,
            onClick: async ({ close, button, body: b }) => {
              const form = b.querySelector('#status-form');
              const payload = Object.fromEntries(new FormData(form));
              payload.status = nextStatus;
              UI.setLoading(button, true);
              try {
                const res = await API.put(`/orders/${order._id}/status`, payload);
                UI.toast(res.message, 'success');
                done = true;
                close();
                resolve(res.data);
              } catch (err) {
                UI.setLoading(button, false);
                UI.formError(form, err);
              }
            }
          }
        ]
      });
      const obs = new MutationObserver(() => {
        if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(null); }
      });
      obs.observe(document.body, { childList: true });
    });
  }

  function nextActionButton(order, cls = 'btn btn-primary') {
    const a = NEXT_ACTION[order.orderStatus];
    if (!a) return '';
    return `<button type="button" class="${cls}" data-advance="${esc(order._id)}" data-status="${a.status}">${icon(a.icon)}<span>${esc(t(a.label))}</span></button>`;
  }

  const canSellerCancel = (o) => ['new', 'confirmed', 'processing', 'ready_to_ship'].includes(o.orderStatus);

  window.Orders = { FLOW, CUSTOMER_FLOW, NEXT_ACTION, STEP_ICON, statusLabel, timeline, progressMini, paymentLabel, advance, nextActionButton, canSellerCancel };
})();
