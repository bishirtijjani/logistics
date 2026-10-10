import React, { useRef, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, BackHandler, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import * as SecureStore from "../../lib/storage";
import api, { BASE_URL } from "../../services/api";

const WEB_URL = process.env.EXPO_PUBLIC_MERCHANT_WEB_URL || "https://merchant.iprime.ng";
const DEFAULT_PATH = "/dashboard/orders";

/**
 * Injected before any page script runs. Marks the page as running under the
 * native shell so the web app can (a) skip its own token refresh and (b) expose
 * a helper the shell calls to push tokens in. Defines the postMessage channel.
 */
const BRIDGE_BOOT = `
(function () {
  window.__IPRIME_NATIVE__ = true;
  window.__iprimeNativePost = function (payload) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch (e) {}
  };
  window.__iprimeApplyAuth = function (auth) {
    try {
      if (auth && auth.token) localStorage.setItem('token', auth.token);
      if (auth && auth.refreshToken) localStorage.setItem('refreshToken', auth.refreshToken);
      if (auth && auth.user) localStorage.setItem('merchant_user', JSON.stringify(auth.user));
      window.dispatchEvent(new Event('iprime-auth'));
    } catch (e) {}
  };
  document.addEventListener('DOMContentLoaded', function () {
    window.__iprimeNativePost({ type: 'ready' });
  });
})();
true;
`;

const applyAuth = (auth) =>
  `window.__iprimeApplyAuth && window.__iprimeApplyAuth(${JSON.stringify(auth)}); true;`;

export default function WebAppScreen({ route }) {
  const { tokens } = useTheme();
  const { t } = useT();
  const webRef = useRef(null);
  const canGoBack = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const initialUrl = `${WEB_URL}${route?.params?.initialPath || DEFAULT_PATH}`;

  const pushTokensToWeb = useCallback(async () => {
    const token = await SecureStore.getItemAsync("accessToken");
    const refreshToken = await SecureStore.getItemAsync("refreshToken");
    const userRaw = await SecureStore.getItemAsync("merchant_user");
    let user = null;
    try { user = userRaw ? JSON.parse(userRaw) : null; } catch (_) {}
    if (!token) return;
    webRef.current?.injectJavaScript(applyAuth({ token, refreshToken, user }));
  }, []);

  const handleRefreshRequest = useCallback(async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (!refreshToken) return;
      const res = await api.post("/auth/refresh", { refreshToken });
      const data = res.data || res;
      const tks = data?.tokens || data;
      if (tks?.accessToken && tks?.refreshToken) {
        await SecureStore.setItemAsync("accessToken", tks.accessToken);
        await SecureStore.setItemAsync("refreshToken", tks.refreshToken);
        await pushTokensToWeb();
      }
    } catch (_) {
      // Native session is likely dead; the app-level 401 flow handles logout.
    }
  }, [pushTokensToWeb]);

  const onMessage = useCallback(
    async (event) => {
      let msg;
      try { msg = JSON.parse(event.nativeEvent.data); } catch (_) { return; }
      if (!msg || !msg.type) return;
      if (msg.type === "ready") {
        pushTokensToWeb();
      } else if (msg.type === "refresh-request") {
        handleRefreshRequest();
      } else if (msg.type === "auth-changed" && msg.token) {
        await SecureStore.setItemAsync("accessToken", msg.token);
        if (msg.refreshToken) await SecureStore.setItemAsync("refreshToken", msg.refreshToken);
        if (msg.user) await SecureStore.setItemAsync("merchant_user", JSON.stringify(msg.user));
      }
    },
    [pushTokensToWeb, handleRefreshRequest],
  );

  const onShouldStartLoadWithRequest = useCallback((req) => {
    const url = req.url || "";
    // Keep same-origin + API + about:blank inside the webview; open the rest externally.
    if (
      url.startsWith(WEB_URL) ||
      url.startsWith(BASE_URL) ||
      url.startsWith("about:") ||
      url.startsWith("data:") ||
      url.startsWith("blob:")
    ) {
      return true;
    }
    WebBrowser.openBrowserAsync(url).catch(() => {});
    return false;
  }, []);

  const goBack = useCallback(() => {
    if (canGoBack.current && webRef.current) {
      webRef.current.goBack();
      return true;
    }
    return false;
  }, []);

  // Android hardware back → webview history.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", goBack);
      return () => sub.remove();
    }, [goBack]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border.default,
        }}
      >
        <Text style={{ flex: 1, fontSize: 18, fontWeight: "800", color: tokens.text.primary }}>
          {t("merchant.moreTitle", "Manage")}
        </Text>
        <TouchableOpacity onPress={() => webRef.current?.reload()} style={{ padding: 6 }}>
          <Ionicons name="refresh" size={20} color={tokens.text.muted} />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Ionicons name="cloud-offline-outline" size={40} color={tokens.text.muted} />
          <Text style={{ color: tokens.text.primary, fontWeight: "700", marginTop: 12, marginBottom: 6 }}>
            {t("merchant.webError", "Couldn't load this section")}
          </Text>
          <Text style={{ color: tokens.text.muted, textAlign: "center", marginBottom: 16 }}>
            {t("merchant.webErrorSub", "Check your connection and try again.")}
          </Text>
          <TouchableOpacity
            onPress={() => { setError(false); setLoading(true); setReloadKey((k) => k + 1); }}
            style={{ backgroundColor: tokens.brand.default, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800" }}>{t("common.retry", "Retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <WebView
            key={reloadKey}
            ref={webRef}
            source={{ uri: initialUrl }}
            originWhitelist={["*"]}
            injectedJavaScriptBeforeContentLoaded={BRIDGE_BOOT}
            onMessage={onMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setError(true); setLoading(false); }}
            onHttpError={() => { setError(true); setLoading(false); }}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onNavigationStateChange={(nav) => { canGoBack.current = nav.canvasGoBack || nav.canGoBack; }}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            javaScriptEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            // File inputs (product/store images) use the OS picker automatically.
            allowsFileAccess
            // Android: hand downloads to the OS download manager.
            {...(Platform.OS === "android" ? { allowFileAccess: true } : {})}
          />
          {loading ? (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: tokens.bg.canvas }}>
              <ActivityIndicator size="large" color={tokens.brand.default} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
