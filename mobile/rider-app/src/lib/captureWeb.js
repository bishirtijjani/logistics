/**
 * Native counterpart of captureWeb.web.js. Never invoked on iOS/Android — the
 * receipt screens call captureAndShareWeb only behind a `Platform.OS === 'web'`
 * guard. It exists so Metro can resolve the import on native (Metro picks the
 * .web.js variant when bundling for web).
 */
export async function captureAndShareWeb() {
  throw new Error("captureAndShareWeb is web-only");
}
