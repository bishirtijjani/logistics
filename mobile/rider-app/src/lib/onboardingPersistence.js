import * as SecureStore from "./storage";

const KEY = "rider.onboarding.draft.v1";

export async function loadOnboardingDraft() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export async function saveOnboardingDraft(draft) {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(draft || {}));
  } catch (_) {
    // Non-fatal — draft will rebuild on next interaction.
  }
}

export async function clearOnboardingDraft() {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch (_) {}
}
