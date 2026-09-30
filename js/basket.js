/* Plus 4 Performance — shopping basket.
   Included on every page via <script src="/js/basket.js" defer></script>,
   after js/site.js. Owns localStorage, the basket icon badge, and the
   slide-out drawer. Product pages call window.P4PBasket.add(...) to add
   a line; every page gets the badge count and drawer for free.

   Basket lines store a full display snapshot (name/image/colour/size/price)
   taken at add-to-basket time, so the drawer never needs the product
   catalogue loaded. Checkout re-validates everything (including price)
   against the server-side catalogue in create-checkout-session — the
   snapshot here is display-only and never trusted for money. */
(function(){
  var STORAGE_KEY = 'p4p_basket_v1';
  var PREVIEW_KEY = 'p4p_preview_v1';
  var MAX_QTY = 10;
  var memoryFallback = [];
  var storageOK = true;

  /* ?preview=1 lets the site owner run a real checkout while SHOP_LIVE is
     off. Persist that as a sessionStorage flag (not just the current
     page's URL) so it survives navigating from /shop?preview=1 to a
     product page that has no query string of its own. ?preview=0 clears
     it explicitly. Runs immediately, before DOMContentLoaded, so it's
     captured on every page load. */
  (function syncPreviewFlag(){
    try {
      var preview = new URLSearchParams(window.location.search).get('preview');
      if(preview === '1'){
        window.sessionStorage.setItem(PREVIEW_KEY, '1');
      } else if(preview === '0'){
        window.sessionStorage.removeItem(PREVIEW_KEY);
      }
    } catch(e) { /* sessionStorage unavailable, ignore */ }
  })();

  function readBasket(){
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      storageOK = false;
      return memoryFallback;
    }
  }

  function writeBasket(lines){
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch(e) {
      storageOK = false;
      memoryFallback = lines;
    }
  }

  function lineKey(l){
    return l.productId + '|' + l.colour + '|' + l.size;
  }

  function getLines(){
    var lines = readBasket();
    return Array.isArray(lines) ? lines : [];
  }

  function setLines(lines){
    writeBasket(lines);
    render();
    document.dispatchEvent(new CustomEvent('p4p:basket:change', { detail: { lines: lines } }));
  }

  function add(item){
    var lines = getLines();
    var key = lineKey(item);
    var existing = lines.filter(function(l){ return lineKey(l) === key; })[0];
    if(existing){
      existing.qty = Math.min(MAX_QTY, existing.qty + item.qty);
    } else {
      lines.push({
        productId: item.productId,
        name: item.name,
        colour: item.colour,
        size: item.size,
        image: item.image,
        price: item.price,
        qty: Math.min(MAX_QTY, Math.max(1, item.qty))
      });
    }
    setLines(lines);
    open();
  }

  function updateQty(key, qty){
    var lines = getLines();
    var line = lines.filter(function(l){ return lineKey(l) === key; })[0];
    if(!line) return;
    qty = Math.max(1, Math.min(MAX_QTY, qty));
    line.qty = qty;
    setLines(lines);
  }

  function remove(key){
    var lines = getLines().filter(function(l){ return lineKey(l) !== key; });
    setLines(lines);
  }

  function clear(){
    setLines([]);
  }

  function count(){
    return getLines().reduce(function(sum, l){ return sum + l.qty; }, 0);
  }

  function subtotal(){
    return getLines().reduce(function(sum, l){ return sum + (l.price * l.qty); }, 0);
  }

  function money(n){
    return '£' + n.toFixed(2).replace(/\.00$/, '');
  }

  /* ---------- drawer DOM ---------- */

  var drawerEl, overlayEl;

  function buildDrawerShell(){
    overlayEl = document.createElement('div');
    overlayEl.className = 'basket-overlay';
    overlayEl.setAttribute('hidden', '');

    drawerEl = document.createElement('aside');
    drawerEl.className = 'basket-drawer';
    drawerEl.setAttribute('role', 'dialog');
    drawerEl.setAttribute('aria-modal', 'true');
    drawerEl.setAttribute('aria-label', 'Basket');
    drawerEl.setAttribute('hidden', '');

    document.body.appendChild(overlayEl);
    document.body.appendChild(drawerEl);

    overlayEl.addEventListener('click', close);
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && !drawerEl.hasAttribute('hidden')) close();
    });
  }

  function lineHTML(l){
    var key = lineKey(l);
    return (
      '<div class="basket-line" data-key="' + escapeAttr(key) + '">' +
        '<div class="basket-line-media"><img src="' + escapeAttr(l.image || '') + '" alt="' + escapeAttr(l.name) + '" loading="lazy"></div>' +
        '<div class="basket-line-body">' +
          '<div class="basket-line-name">' + escapeHTML(l.name) + '</div>' +
          '<div class="basket-line-meta">' + escapeHTML(l.colour) + ' &middot; ' + escapeHTML(l.size) + '</div>' +
          '<div class="basket-line-qty" role="group" aria-label="Quantity">' +
            '<button type="button" class="qty-btn" data-action="dec" aria-label="Decrease quantity">&minus;</button>' +
            '<span class="qty-value">' + l.qty + '</span>' +
            '<button type="button" class="qty-btn" data-action="inc" aria-label="Increase quantity"' + (l.qty >= MAX_QTY ? ' disabled' : '') + '>&plus;</button>' +
          '</div>' +
        '</div>' +
        '<div class="basket-line-side">' +
          '<div class="basket-line-price">' + money(l.price * l.qty) + '</div>' +
          '<button type="button" class="basket-line-remove" aria-label="Remove ' + escapeAttr(l.name) + '">Remove</button>' +
        '</div>' +
      '</div>'
    );
  }

  function escapeHTML(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function escapeAttr(s){ return escapeHTML(s); }

  function render(){
    if(!drawerEl) return;
    var lines = getLines();

    var bodyHTML;
    if(!lines.length){
      bodyHTML = '<div class="basket-empty">Your basket is empty.</div>';
    } else {
      bodyHTML = '<div class="basket-lines">' + lines.map(lineHTML).join('') + '</div>';
    }

    var live = window.P4P_SHOP_LIVE === true;
    var checkoutHTML = lines.length
      ? '<button type="button" class="btn-filled basket-checkout-btn" id="basket-checkout-btn">Checkout</button>' +
        '<div class="basket-checkout-msg" id="basket-checkout-msg" hidden></div>'
      : '<button type="button" class="btn-filled basket-checkout-btn" disabled>Checkout</button>';

    drawerEl.innerHTML =
      '<div class="basket-drawer-head">' +
        '<h2>Your Basket</h2>' +
        '<button type="button" class="basket-close" aria-label="Close basket">&times;</button>' +
      '</div>' +
      '<div class="basket-drawer-body">' + bodyHTML + '</div>' +
      '<div class="basket-drawer-foot">' +
        '<div class="basket-summary-row"><span>Subtotal</span><span>' + money(subtotal()) + '</span></div>' +
        '<div class="basket-summary-row basket-summary-muted"><span>Free UK delivery</span><span>&pound;0</span></div>' +
        checkoutHTML +
        '<p class="basket-fineprint">Made to order. Usually arrives in 2 to 3 weeks. ' +
          'By checking out you agree to our <a href="/terms-of-sale">Terms of Sale</a>.</p>' +
      '</div>';

    drawerEl.querySelector('.basket-close').addEventListener('click', close);

    drawerEl.querySelectorAll('.basket-line').forEach(function(lineEl){
      var key = lineEl.getAttribute('data-key');
      lineEl.querySelector('[data-action="dec"]').addEventListener('click', function(){
        var line = getLines().filter(function(l){ return lineKey(l) === key; })[0];
        if(!line) return;
        if(line.qty <= 1){ remove(key); } else { updateQty(key, line.qty - 1); }
      });
      lineEl.querySelector('[data-action="inc"]').addEventListener('click', function(){
        var line = getLines().filter(function(l){ return lineKey(l) === key; })[0];
        if(!line) return;
        updateQty(key, line.qty + 1);
      });
      lineEl.querySelector('.basket-line-remove').addEventListener('click', function(){
        remove(key);
      });
    });

    var checkoutBtn = document.getElementById('basket-checkout-btn');
    if(checkoutBtn){
      checkoutBtn.addEventListener('click', handleCheckout);
    }

    updateBadge();
  }

  function updateBadge(){
    var n = count();
    document.querySelectorAll('[data-basket-count]').forEach(function(el){
      el.textContent = n;
      el.hidden = n <= 0;
    });
  }

  function open(){
    if(!drawerEl) buildDrawerShell();
    render();
    overlayEl.removeAttribute('hidden');
    drawerEl.removeAttribute('hidden');
    requestAnimationFrame(function(){
      overlayEl.classList.add('is-open');
      drawerEl.classList.add('is-open');
    });
    document.body.classList.add('basket-drawer-open');
  }

  function close(){
    if(!drawerEl) return;
    overlayEl.classList.remove('is-open');
    drawerEl.classList.remove('is-open');
    document.body.classList.remove('basket-drawer-open');
    window.setTimeout(function(){
      if(overlayEl) overlayEl.setAttribute('hidden', '');
      if(drawerEl) drawerEl.setAttribute('hidden', '');
    }, 260);
  }

  function isPreview(){
    try {
      var current = new URLSearchParams(window.location.search).get('preview');
      if(current === '1') return true;
      if(current === '0') return false;
      return window.sessionStorage.getItem(PREVIEW_KEY) === '1';
    } catch(e) {
      try {
        return new URLSearchParams(window.location.search).get('preview') === '1';
      } catch(e2) {
        return false;
      }
    }
  }

  function handleCheckout(){
    var btn = document.getElementById('basket-checkout-btn');
    var msg = document.getElementById('basket-checkout-msg');
    if(!btn) return;
    btn.disabled = true;
    btn.textContent = 'Redirecting…';
    if(msg){ msg.hidden = true; msg.textContent = ''; }

    var lines = getLines();
    var payload = {
      preview: isPreview(),
      items: lines.map(function(l){
        return { productId: l.productId, colour: l.colour, size: l.size, quantity: l.qty };
      })
    };

    fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
    .then(function(result){
      if(result.ok && result.data && result.data.url){
        window.location.href = result.data.url;
        return;
      }
      btn.disabled = false;
      btn.textContent = 'Checkout';
      if(msg){
        msg.hidden = false;
        msg.textContent = (result.data && result.data.error === 'shop_not_live')
          ? 'Checkout launching soon.'
          : 'Something went wrong. Please try again.';
      }
    })
    .catch(function(){
      btn.disabled = false;
      btn.textContent = 'Checkout';
      if(msg){
        msg.hidden = false;
        msg.textContent = 'Something went wrong. Please try again.';
      }
    });
  }

  window.P4PBasket = {
    add: add,
    updateQty: updateQty,
    remove: remove,
    clear: clear,
    count: count,
    subtotal: subtotal,
    open: open,
    close: close,
    MAX_QTY: MAX_QTY
  };

  function wireToggleButtons(){
    document.querySelectorAll('[data-basket-toggle]').forEach(function(btn){
      btn.addEventListener('click', open);
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    buildDrawerShell();
    render();
    wireToggleButtons();
  });
})();
