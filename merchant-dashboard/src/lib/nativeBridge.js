/**
 * Native shell bridge (iPrime Merchant app).
 *
 * The native app (mobile/merchant-app) loads this dashboard inside a WebView
 * and owns the auth session. It flags itself by setting `window.__IPRIME_NATIVE__`
 * and injecting a `window.__iprimeNativePost(payload)` postMessage helper plus
 * a `window.__iprimeApplyAuth({ token, refreshToken, user })` setter (see the
 * app's WebAppScreen injectedJavaScriptBeforeContentLoaded).
 *
 * When running under the native shell:
 *   - api.js must NOT hard-redirect on 401; it asks native to refresh instead.
 *   - useAuthSession must NOT run its own refresh poll (single-use rotating
 *     refresh tokens would otherwise be consumed/conflicted by two clients).
 *
 * Everything here is a no-op in a normal browser.
 */

export const isNative = () =>
  typeof window !== 'undefined' && window.__IPRIME_NATIVE__ === true

export const postToNative = (payload) => {
  if (!isNative()) return
  try {
    window.__iprimeNativePost?.(payload)
  } catch {
    // Never let a bridge failure break the web app.
  }
}

/** Ask the native shell to refresh the session and re-inject fresh tokens. */
export const requestNativeRefresh = () => postToNative({ type: 'refresh-request' })
