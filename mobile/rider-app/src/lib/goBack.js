// Web-safe back navigation.
//
// On native, every navigation.navigate() pushes onto the in-memory stack, so
// navigation.goBack() always has a previous screen to return to. On web the
// stack is reconstructed from the URL via the NavigationContainer `linking`
// config: a reloaded page, a bookmarked/shared deep link, or any screen listed
// at the top level of the linking config lands as the ROOT of the stack
// (index 0). There a bare goBack() reads the stack index, finds nothing
// beneath it, and silently no-ops - which is why in-app back buttons appear
// dead in the browser while working fine on device.
//
// goBackOr() guards that case: pop if we can, otherwise navigate to a known
// destination (the home tab by default) so the user is never stranded.
export function goBackOr(
  navigation,
  fallback = { name: "MainTabs", params: { screen: "HomeTab" } }
) {
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
  } else {
    navigation.navigate(fallback.name, fallback.params);
  }
}
