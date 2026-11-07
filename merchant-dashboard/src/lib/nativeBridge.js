/**
 * Native shell bridge (Logistics Platform Merchant app).
 *
 * The native app (mobile/merchant-app) loads this dashboard inside a WebView
 * and owns the auth session. It flags itself by setting `window.__LOGISTICS_NATIVE__`
 * and injecting a `window.__logisticsNativePost(payload)` postMessage helper plus
 * a `window.__logisticsApplyAuth({ token, refreshToken, user })` setter (see the
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
  typeof window !== 'undefined' && window.__LOGISTICS_NATIVE__ === true

export const postToNative = (payload) => {
  if (!isNative()) return
  try {
    window.__logisticsNativePost?.(payload)
  } catch {
    // Never let a bridge failure break the web app.
  }
}

/** Ask the native shell to refresh the session and re-inject fresh tokens. */
export const requestNativeRefresh = () => postToNative({ type: 'refresh-request' })

/**
 * Ask the native shell to refresh, resolving once fresh tokens have been
 * injected (the shell re-injects then fires `logistics-auth`). Rejects if the
 * shell doesn't respond in time - callers should treat that as "session dead".
 */
export const refreshViaNative = (timeoutMs = 12000) =>
  new Promise((resolve, reject) => {
    if (!isNative()) {
      reject(new Error('not-native'))
      return
    }
    let settled = false
    const onAuth = () => {
      if (settled) return
      settled = true
      window.removeEventListener('logistics-auth', onAuth)
      resolve()
    }
    window.addEventListener('logistics-auth', onAuth)
    window.setTimeout(() => {
      if (settled) return
      settled = true
      window.removeEventListener('logistics-auth', onAuth)
      reject(new Error('native-refresh-timeout'))
    }, timeoutMs)
    requestNativeRefresh()
  })
