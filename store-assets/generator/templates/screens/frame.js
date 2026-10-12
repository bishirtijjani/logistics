/* Injects the iOS-style status bar, dynamic island and home indicator into
 * each marketing screenshot's phone mockup. Reads ?device= only to allow
 * minor per-device tweaks (kept for future use); the layout itself is
 * viewport-relative so it scales to every canvas size. */
(function () {
  var params = new URLSearchParams(location.search);
  document.documentElement.dataset.device = params.get('device') || 'phone';

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function statusbar() {
    return el(
      '<div class="statusbar"><div class="time">9:41</div><div class="right">' +
        '<svg viewBox="0 0 20 14" width="18" height="13"><g fill="currentColor"><rect x="0" y="9" width="3" height="4" rx="1"/><rect x="5" y="6" width="3" height="7" rx="1"/><rect x="10" y="3" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="13" rx="1"/></g></svg>' +
        '<span class="net">5G</span>' +
        '<svg viewBox="0 0 26 13" width="26" height="13"><rect x="0.6" y="0.6" width="20.8" height="11.8" rx="3.6" fill="none" stroke="currentColor" stroke-opacity="0.45"/><rect x="2" y="2" width="16.4" height="9" rx="2.2" fill="currentColor"/><rect x="23" y="4" width="2" height="5" rx="1" fill="currentColor" fill-opacity="0.45"/></svg>' +
      '</div></div>'
    );
  }

  function boot() {
    var phone = document.querySelector('.phone');
    if (!phone) { window.__ready = true; return; }
    var screen = phone.querySelector('.screen');

    if (!phone.querySelector('.island')) phone.appendChild(el('<div class="island"></div>'));

    var sb = screen.querySelector('[data-statusbar]');
    if (sb) screen.replaceChild(statusbar(), sb);

    if (!screen.querySelector('.homebar')) screen.appendChild(el('<div class="homebar"></div>'));

    window.__ready = true;
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
