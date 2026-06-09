import React, { useCallback } from "react";
import { Modal, StatusBar, Platform } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../theme";
import JobOfferScreen from "../features/offers/JobOfferScreen";
import { offerDismissed } from "../store/slices/offersSlice";

/**
 * Root-level offer overlay. Renders a full-screen Modal hosting the
 * `JobOfferScreen` whenever `offers.activeOfferId` is set.
 *
 * Back-gesture policy:
 *   - While `status === 'showing'` or `'accepting'`, the Android back press is
 *     swallowed - riders can't fat-finger their way out of a live offer.
 *   - On any terminal state (`taken`, `expired`, `error`, `accepted`), back
 *     dismisses the sheet so the rider isn't trapped looking at a "Try again"
 *     button they no longer want.
 */
export default function OfferOverlayNavigator() {
  const dispatch = useDispatch();
  const activeOfferId = useSelector((s) => s.offers?.activeOfferId);
  const status = useSelector((s) => s.offers?.status);
  const { tokens, isDark } = useTheme();

  const onRequestClose = useCallback(() => {
    if (!activeOfferId) return;
    const isTerminal = status === "taken" || status === "expired" || status === "error" || status === "accepted";
    if (isTerminal) {
      dispatch(offerDismissed({ requestId: activeOfferId, outcome: status }));
    }
    // While 'showing' or 'accepting' the back press is intentionally swallowed.
  }, [activeOfferId, status, dispatch]);

  return (
    <Modal
      visible={!!activeOfferId}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      {Platform.OS === "android" ? (
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={tokens.bg.canvas}
        />
      ) : null}
      {activeOfferId ? <JobOfferScreen /> : null}
    </Modal>
  );
}
