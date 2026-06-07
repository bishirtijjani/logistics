import { Alert, Platform } from "react-native";

/**
 * Cross-platform Alert.
 *
 * react-native-web ships an `Alert.alert` whose multi-button `onPress`
 * callbacks never fire, so every confirm/chooser dialog silently does nothing
 * on web. This module renders a themed modal instead (see AlertHost) and, on
 * web, monkeypatches `Alert.alert` so EXISTING `Alert.alert(...)` call sites
 * across the app just work — no per-site rewrites.
 *
 * Native is untouched: installWebAlert() no-ops off web, so the real OS Alert
 * keeps handling everything on iOS/Android.
 */

// The mounted <AlertHost/> registers its state setter here.
let _present = null;

export function _registerAlertHost(present) {
  _present = present;
  return () => {
    if (_present === present) _present = null;
  };
}

/**
 * Same signature as RN's Alert.alert: (title, message?, buttons?, options?).
 * buttons: [{ text, onPress?, style?: 'default' | 'cancel' | 'destructive' }]
 */
export function showAlert(title, message, buttons, options) {
  const list = Array.isArray(buttons) && buttons.length ? buttons : [{ text: "OK" }];
  if (_present) {
    _present({ title, message, buttons: list, options });
    return;
  }
  // Host not mounted yet (very early startup) — best-effort via the browser so
  // a prompt is never silently dropped.
  if (typeof window !== "undefined" && list.length > 1 && window.confirm) {
    const cancel = list.find((b) => b.style === "cancel");
    const primary = list.find((b) => b.style !== "cancel") || list[0];
    const ok = window.confirm([title, message].filter(Boolean).join("\n\n"));
    (ok ? primary : cancel || {}).onPress?.();
  } else if (typeof window !== "undefined" && window.alert) {
    window.alert([title, message].filter(Boolean).join("\n\n"));
    list[0]?.onPress?.();
  }
}

let _installed = false;

/**
 * On web, route every Alert.alert(...) through the themed host. No-op on native
 * and safe to call more than once.
 */
export function installWebAlert() {
  if (Platform.OS !== "web" || _installed) return;
  try {
    Alert.alert = showAlert;
    _installed = true;
  } catch (_) {
    // If Alert is frozen on some platform, leave it as-is.
  }
}
