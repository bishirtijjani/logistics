import React, { useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, AppState, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme";
import { fetchRiderProfile } from "../store/slices/riderSlice";
import { fetchProfile } from "../store/slices/profileSlice";
import { useOnboardingStage, ONBOARDING_STAGE } from "../lib/useOnboardingStage";

/**
 * Stage-aware "finish becoming a rider" card shown on the Home tab whenever the
 * rider is NOT yet APPROVED. This is the primary nudge that replaces the old
 * onboarding wall — the rider can browse the app, but this keeps the path to
 * earning one tap away and reflects exactly where they are.
 *
 * Renders nothing once APPROVED (Home shows the availability toggle instead) or
 * SUSPENDED (AppNavigator walls that off entirely).
 */
export default function OnboardingHero() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { stage, step, resumeScreen } = useOnboardingStage();
  const createdAt = useSelector((s) => s.rider?.rider?.createdAt);
  const rejectionReason = useSelector((s) => s.rider?.rider?.rejectionReason);
  const isLoading = useSelector((s) => s.rider?.isLoading);

  // While PENDING, refetch the rider profile whenever the app is foregrounded so
  // an admin approval flips the rider into the app without a manual reload.
  const refetch = useCallback(() => {
    dispatch(fetchRiderProfile()).catch?.(() => {});
    dispatch(fetchProfile()).catch?.(() => {});
  }, [dispatch]);

  useEffect(() => {
    if (stage !== ONBOARDING_STAGE.PENDING) return undefined;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refetch();
    });
    return () => sub.remove();
  }, [stage, refetch]);

  if (stage === ONBOARDING_STAGE.APPROVED || stage === ONBOARDING_STAGE.SUSPENDED) {
    return null;
  }

  const goToStart = () => navigation.navigate("BecomeRiderPersonal");
  const goToResume = () => navigation.navigate(resumeScreen);
  // A REJECTED rider already has a Rider record, so re-submitting via
  // POST /rider/register would 409. Recovery goes through KycStatus, which
  // re-uploads documents in place via POST /rider/documents.
  const goToFixDocs = () => navigation.navigate("KycStatus");

  // ── PENDING ───────────────────────────────────────────────────────────────
  if (stage === ONBOARDING_STAGE.PENDING) {
    const submittedAt = createdAt ? new Date(createdAt).toLocaleDateString() : null;
    return (
      <Card tokens={tokens} accent={tokens.brand.soft} accentBorder={tokens.brand.softBorder}>
        <IconBubble tokens={tokens} name="hourglass-outline" color={tokens.brand.default} />
        <Text style={titleStyle(tokens)}>
          {t("onboardingHero.pendingTitle", "Application under review")}
        </Text>
        <Text style={bodyStyle(tokens)}>
          {t(
            "onboardingHero.pendingBody",
            "We're reviewing your documents — usually within a few hours. We'll notify you the moment you're approved.",
          )}
        </Text>
        {submittedAt ? (
          <Text style={{ fontSize: 12, color: tokens.text.placeholder, marginBottom: 14 }}>
            {t("onboardingHero.submitted", "Submitted")}: {submittedAt}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={refetch}
          accessibilityRole="button"
          style={secondaryBtnStyle(tokens)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={tokens.text.primary} size="small" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="refresh" size={16} color={tokens.text.primary} />
              <Text style={{ marginLeft: 8, color: tokens.text.primary, fontWeight: "700" }}>
                {t("onboardingHero.checkStatus", "Check status")}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Card>
    );
  }

  // ── REJECTED ───────────────────────────────────────────────────────────────
  if (stage === ONBOARDING_STAGE.REJECTED) {
    return (
      <Card
        tokens={tokens}
        accent={tokens.status.errorSoft}
        accentBorder={tokens.status.errorSoftBorder}
      >
        <IconBubble tokens={tokens} name="alert-circle-outline" color={tokens.status.errorStrong} />
        <Text style={titleStyle(tokens)}>
          {t("onboardingHero.rejectedTitle", "Your application needs changes")}
        </Text>
        <Text style={bodyStyle(tokens)}>
          {rejectionReason ||
            t(
              "onboardingHero.rejectedBody",
              "Some details couldn't be verified. Update the affected documents and resubmit to try again.",
            )}
        </Text>
        <TouchableOpacity onPress={goToFixDocs} accessibilityRole="button" style={primaryBtnStyle(tokens)}>
          <Text style={primaryBtnTextStyle(tokens)}>
            {t("onboardingHero.rejectedCta", "Update & resubmit")}
          </Text>
        </TouchableOpacity>
      </Card>
    );
  }

  // ── DRAFT ───────────────────────────────────────────────────────────────────
  if (stage === ONBOARDING_STAGE.DRAFT) {
    return (
      <Card tokens={tokens} accent={tokens.brand.soft} accentBorder={tokens.brand.softBorder}>
        <IconBubble tokens={tokens} name="document-text-outline" color={tokens.brand.default} />
        <Text style={titleStyle(tokens)}>
          {t("onboardingHero.draftTitle", "Finish your application")}
        </Text>
        <Text style={bodyStyle(tokens)}>
          {t(
            "onboardingHero.draftBody",
            "You're partway there. Pick up where you left off and start earning.",
          )}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.brand.default, marginBottom: 14 }}>
          {t("onboardingHero.stepProgress", "Step {{n}} of 4", { n: Math.min((step || 0) + 1, 4) })}
        </Text>
        <TouchableOpacity onPress={goToResume} accessibilityRole="button" style={primaryBtnStyle(tokens)}>
          <Text style={primaryBtnTextStyle(tokens)}>
            {t("onboardingHero.draftCta", "Continue application")}
          </Text>
        </TouchableOpacity>
      </Card>
    );
  }

  // ── NONE (default) — reward-first value prop ────────────────────────────────
  return (
    <Card tokens={tokens} accent={tokens.brand.soft} accentBorder={tokens.brand.softBorder}>
      <IconBubble tokens={tokens} name="rocket-outline" color={tokens.brand.default} />
      <Text style={titleStyle(tokens)}>
        {t("onboardingHero.noneTitle", "Start earning as a rider")}
      </Text>
      <Text style={bodyStyle(tokens)}>
        {t(
          "onboardingHero.noneBody",
          "Deliver on your own schedule and cash out anytime. Set up your rider profile to start receiving jobs.",
        )}
      </Text>
      <View style={{ marginBottom: 16 }}>
        <Bullet tokens={tokens} text={t("onboardingHero.benefit1", "Get paid per delivery, withdraw anytime")} />
        <Bullet tokens={tokens} text={t("onboardingHero.benefit2", "Work the hours that suit you")} />
        <Bullet tokens={tokens} text={t("onboardingHero.benefit3", "Takes a few minutes to set up")} />
      </View>
      <TouchableOpacity onPress={goToStart} accessibilityRole="button" style={primaryBtnStyle(tokens)}>
        <Text style={primaryBtnTextStyle(tokens)}>
          {t("onboardingHero.noneCta", "Get started")}
        </Text>
      </TouchableOpacity>
    </Card>
  );
}

// ── Presentational helpers ────────────────────────────────────────────────────

function Card({ tokens, accent, accentBorder, children }) {
  return (
    <View
      style={{
        marginTop: 8,
        borderRadius: 18,
        backgroundColor: accent || tokens.bg.surface,
        borderWidth: 1,
        borderColor: accentBorder || tokens.border.default,
        padding: 20,
      }}
    >
      {children}
    </View>
  );
}

function IconBubble({ tokens, name, color }) {
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: tokens.bg.surface,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
      }}
    >
      <Ionicons name={name} size={28} color={color} />
    </View>
  );
}

function Bullet({ tokens, text }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
      <Ionicons name="checkmark-circle" size={18} color={tokens.status.success} />
      <Text style={{ marginLeft: 8, flex: 1, fontSize: 13, color: tokens.text.primary }}>{text}</Text>
    </View>
  );
}

const titleStyle = (tokens) => ({
  fontSize: 20,
  fontWeight: "900",
  color: tokens.text.primary,
  letterSpacing: -0.5,
  marginBottom: 6,
});

const bodyStyle = (tokens) => ({
  fontSize: 14,
  color: tokens.text.muted,
  lineHeight: 20,
  marginBottom: 12,
});

const primaryBtnStyle = (tokens) => ({
  width: "100%",
  padding: 15,
  borderRadius: 14,
  alignItems: "center",
  backgroundColor: tokens.brand.default,
});

const primaryBtnTextStyle = (tokens) => ({
  color: tokens.text.onBrand,
  fontSize: 15,
  fontWeight: "800",
});

const secondaryBtnStyle = (tokens) => ({
  alignSelf: "flex-start",
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 12,
  backgroundColor: tokens.bg.surface,
  borderWidth: 1,
  borderColor: tokens.border.default,
});