/* Shared device chrome for the merchant screenshot mockups.
 *
 * Reads ?device=ios|android|ipad, sets the density unit, and injects the
 * status bar / tab bar / home indicator into the placeholders each screen
 * template declares (`[data-statusbar]`, `[data-tabbar]`, `[data-homebar]`).
 */
(function () {
  var DEVICE_DP = { ios: '0.2326vw', android: '0.2778vw', ipad: '0.0977vw' };
  var params = new URLSearchParams(location.search);
  var device = params.get('device') || 'ios';
  var root = document.documentElement;
  root.dataset.device = device;
  root.style.setProperty('--dp', DEVICE_DP[device] || DEVICE_DP.ios);

  var ICON = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.3 8h11.4l-1.1 11.2a1.5 1.5 0 0 1-1.5 1.3H8.9a1.5 1.5 0 0 1-1.5-1.3L6.3 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4.2 1.6 5.3 1.6 5.3H4.9s1.6-1.1 1.6-5.3z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.1"/><path d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5"/></svg>',
  };

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function statusbar() {
    return el(
      '<div class="statusbar"><div class="time">9:41</div><div class="right">' +
        '<svg viewBox="0 0 20 14" width="18" height="13"><g fill="currentColor"><rect x="0" y="9" width="3" height="4" rx="1"/><rect x="5" y="6" width="3" height="7" rx="1"/><rect x="10" y="3" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="13" rx="1"/></g></svg>' +
        '<svg viewBox="0 0 16 12" width="17" height="12"><path d="M8 11.4 0.8 4.2a10.2 10.2 0 0 1 14.4 0z" fill="currentColor"/></svg>' +
        '<svg viewBox="0 0 26 13" width="26" height="13"><rect x="0.6" y="0.6" width="20.8" height="11.8" rx="3.6" fill="none" stroke="currentColor" stroke-opacity="0.45"/><rect x="2" y="2" width="16.4" height="9" rx="2.2" fill="currentColor"/><rect x="23" y="4" width="2" height="5" rx="1" fill="currentColor" fill-opacity="0.45"/></svg>' +
      '</div></div>'
    );
  }

  function tabbar(active) {
    var tabs = [
      ['orders', 'Orders', ICON.bag],
      ['alerts', 'Alerts', ICON.bell],
      ['more', 'More', ICON.grid],
      ['settings', 'Settings', ICON.gear],
    ];
    var html = tabs
      .map(function (t) {
        return '<div class="tab ' + (t[0] === active ? 'active' : '') + '">' + t[2] + '<div class="tablbl">' + t[1] + '</div></div>';
      })
      .join('');
    return el('<div class="tabbar">' + html + '</div>');
  }

  function boot() {
    var bezel = document.querySelector('.bezel');
    if (bezel && !bezel.querySelector('.island')) bezel.appendChild(el('<div class="island"></div>'));

    var sb = document.querySelector('[data-statusbar]');
    if (sb) sb.replaceWith(statusbar());

    var tb = document.querySelector('[data-tabbar]');
    if (tb) tb.replaceWith(tabbar(tb.getAttribute('data-tabbar')));

    var hb = document.querySelector('[data-homebar]');
    if (hb) hb.replaceWith(el('<div class="homebar"></div>'));

    window.__ready = true;
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
