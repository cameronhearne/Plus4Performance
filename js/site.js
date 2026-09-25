/* Plus 4 Performance — shared header/footer + site-wide behaviour.
   Included on every page via <script src="/js/site.js" defer></script>
   with empty <div id="site-header"></div> / <div id="site-footer"></div>
   placeholders in the markup. */
(function(){
  var TIDYCAL = 'https://tidycal.com/cameronhearne/30-minute-meeting';
  window.P4P_TIDYCAL_URL = TIDYCAL;

  var path = window.location.pathname.replace(/\/index\.html$/, '/');
  function current(href){
    if(href === '/') return path === '/' ? 'page' : null;
    return path.indexOf(href) === 0 ? 'page' : null;
  }

  var headerHTML =
    '<div class="wrap site-header-inner">' +
      '<a href="/" class="brand" aria-label="Plus 4 Performance home">' +
        '<img src="/logo-mark.png" alt="" class="brand-mark" width="26" height="39">' +
        '<span class="brand-word">PLUS<span class="accent">4</span>PERFORMANCE</span>' +
      '</a>' +
      '<nav class="site-nav" aria-label="Primary">' +
        '<a href="/"' + (current('/') ? ' aria-current="page"' : '') + '>Home</a>' +
        '<a href="/guaranteed-coaching"' + (current('/guaranteed-coaching') ? ' aria-current="page"' : '') + '>Guaranteed Coaching</a>' +
        '<a href="/shop"' + (current('/shop') ? ' aria-current="page"' : '') + '>Shop</a>' +
      '</nav>' +
      '<div class="site-header-actions">' +
        '<a href="' + TIDYCAL + '" target="_blank" rel="noopener" class="btn-ghost btn-sm nav-cta">Book a Call</a>' +
        '<button type="button" class="hamburger" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div id="mobile-menu" class="mobile-menu">' +
      '<a href="/"' + (current('/') ? ' aria-current="page"' : '') + '>Home</a>' +
      '<a href="/guaranteed-coaching"' + (current('/guaranteed-coaching') ? ' aria-current="page"' : '') + '>Guaranteed Coaching</a>' +
      '<a href="/shop"' + (current('/shop') ? ' aria-current="page"' : '') + '>Shop</a>' +
      '<a href="' + TIDYCAL + '" target="_blank" rel="noopener" class="btn-filled">Book a Call</a>' +
    '</div>';

  var footerHTML =
    '<div class="wrap">' +
      '<div class="footer-top">' +
        '<div>' +
          '<div class="footer-mark">PLUS<span>4</span>PERFORMANCE</div>' +
          '<div class="footer-tag">Average to Elite.</div>' +
        '</div>' +
        '<div class="footer-links">' +
          '<div class="footer-col">' +
            '<h5>Coaching</h5>' +
            '<a href="/guaranteed-coaching">Guaranteed Coaching</a>' +
            '<a href="' + TIDYCAL + '" target="_blank" rel="noopener">Book a Call</a>' +
            '<a href="/guarantee-terms">Guarantee Terms</a>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5>Shop</h5>' +
            '<a href="/shop">Clothing</a>' +
            '<a href="/size-guide">Size Guide</a>' +
            '<a href="/shipping-returns">Shipping &amp; Returns</a>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5>Company</h5>' +
            '<a href="/about">About</a>' +
            '<a href="https://instagram.com/plus4performance" target="_blank" rel="noopener">Instagram</a>' +
            '<a href="https://tiktok.com/@plus4performance" target="_blank" rel="noopener">TikTok</a>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5>Legal</h5>' +
            '<a href="/privacy.html">Privacy Policy</a>' +
            '<a href="/terms.html">Terms</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<span>&copy; 2026 Plus 4 Performance. All rights reserved.</span>' +
      '</div>' +
    '</div>';

  function injectChrome(){
    var headerMount = document.getElementById('site-header');
    var footerMount = document.getElementById('site-footer');
    if(headerMount){
      headerMount.innerHTML = headerHTML;
      var menu = document.getElementById('mobile-menu');
      var toggle = headerMount.querySelector('.hamburger');
      if(toggle && menu){
        toggle.addEventListener('click', function(){
          var open = menu.classList.toggle('is-open');
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        });
      }
    }
    if(footerMount){
      footerMount.innerHTML = footerHTML;
    }
  }

  function initReveal(){
    var els = document.querySelectorAll('.reveal, .reveal-stagger');
    if(!els.length) return;
    if(!('IntersectionObserver' in window)){
      els.forEach(function(el){ el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    els.forEach(function(el){ io.observe(el); });
  }

  // Old sales page anchors (#how, #guarantee, #pricing, #faq) used to live on
  // the homepage. The homepage is now a different page, so a server redirect
  // can't see the fragment (fragments never reach the server) — catch it here.
  function redirectLegacyHash(){
    if(!document.body.hasAttribute('data-legacy-hash-redirect')) return;
    var legacy = ['how', 'guarantee', 'pricing', 'faq'];
    var hash = window.location.hash.replace('#', '');
    if(legacy.indexOf(hash) !== -1){
      window.location.replace('/guaranteed-coaching#' + hash);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    injectChrome();
    initReveal();
    redirectLegacyHash();
    document.body.classList.add('loaded');
  });
})();
