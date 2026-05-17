/**
 * Offer alert — loops a sound + fires repeating haptics while a job offer is
 * showing. Stops on dismiss.
 *
 * The sound asset is optional. If `assets/sounds/offer.mp3` exists, expo-av
 * loops it; if not (initial scaffold state), we fall back to haptics-only.
 * Either way the in-app ringtone is decorative — the OS-level FCM
 * notification sound is what wakes a sleeping device when a push arrives.
 *
 * Drop an `offer.mp3` into `mobile/rider-app/assets/sounds/` and uncomment
 * the require below to enable the audio loop.
 */

import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Uncomment this require when an offer.mp3 lands in assets/sounds/.
// const OFFER_SOUND = require("../../assets/sounds/offer.mp3");
const OFFER_SOUND = null;

const HAPTIC_INTERVAL_MS = 5_000;

let _sound = null;
let _hapticTimer = null;
let _started = false;

async function ensureAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch (_) {}
}

function fireHapticBurst() {
  if (Platform.OS === "web") return;
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (_) {}
}

/**
 * Start the offer alert. Idempotent — calling twice while running is a no-op.
 */
export async function startOfferAlert() {
  if (_started) return;
  _started = true;

  // Heavy haptic immediately, then every 5 s while showing.
  fireHapticBurst();
  _hapticTimer = setInterval(fireHapticBurst, HAPTIC_INTERVAL_MS);

  if (!OFFER_SOUND) return;

  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(OFFER_SOUND, {
      shouldPlay: true,
      isLooping: true,
      volume: 1.0,
    });
    _sound = sound;
  } catch (err) {
    // Audio path is best-effort — haptics already running.
    console.warn("[offerRingtone] sound start failed:", err?.message);
  }
}

/** Stop the alert. Idempotent. */
export async function stopOfferAlert() {
  if (!_started) return;
  _started = false;

  if (_hapticTimer) {
    clearInterval(_hapticTimer);
    _hapticTimer = null;
  }

  if (_sound) {
    try { await _sound.stopAsync(); } catch (_) {}
    try { await _sound.unloadAsync(); } catch (_) {}
    _sound = null;
  }
}
