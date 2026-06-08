import { useSelector } from "react-redux";
import { RIDER_STATUS } from "./constants";

/**
 * Single source of truth for "where is this rider in the join journey".
 *
 * Replaces the old full-screen gating wall in AppNavigator. The whole app now
 * keys off this one stage so the Home hero, the Me-tab row, the Earnings empty
 * state, and the availability toggle all agree without duplicating the logic.
 *
 *   NONE     — signed up, no rider record, no saved draft. Brand new.
 *   DRAFT    — started the application (a draft exists) but hasn't submitted.
 *   PENDING  — submitted; Rider.status === PENDING_APPROVAL. Awaiting admin.
 *   REJECTED — admin rejected; rider can fix + resubmit.
 *   APPROVED — good to go online and earn.
 *   SUSPENDED— banned; AppNavigator still walls this one off.
 */
export const ONBOARDING_STAGE = Object.freeze({
  NONE: "NONE",
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
  APPROVED: "APPROVED",
  SUSPENDED: "SUSPENDED",
});

// Become-Rider step index → screen name. Mirrors the onboarding step counter
// persisted by onboardingSlice so we can resume mid-application.
const STEP_SCREENS = [
  "BecomeRiderPersonal",
  "BecomeRiderVehicle",
  "BecomeRiderDocuments",
  "BecomeRiderReview",
];

/** Resolve the Become-Rider screen to resume at from a saved step index. */
export function resumeScreenForStep(step) {
  const idx = Number.isInteger(step)
    ? Math.min(Math.max(step, 0), STEP_SCREENS.length - 1)
    : 0;
  return STEP_SCREENS[idx];
}

/** True once the rider has entered anything into the application draft. */
function draftStarted(draft) {
  if (!draft) return false;
  if (draft.personal || draft.vehicle) return true;
  const docs = draft.documents || {};
  return Object.values(docs).some(Boolean);
}

/**
 * @returns {{
 *   stage: string,            // ONBOARDING_STAGE.*
 *   step: number,             // saved Become-Rider step index
 *   resumeScreen: string,     // screen name to resume the application at
 *   isApproved: boolean,      // convenience: stage === APPROVED
 *   rejectionReason: ?string, // reviewer note when REJECTED
 * }}
 */
export function useOnboardingStage() {
  const riderStatus = useSelector((s) => s.rider?.rider?.status);
  const rejectionReason = useSelector((s) => s.rider?.rider?.rejectionReason);
  const draft = useSelector((s) => s.onboarding?.draft);
  const step = useSelector((s) => s.onboarding?.step) ?? 0;

  let stage;
  switch (riderStatus) {
    case RIDER_STATUS.APPROVED:
      stage = ONBOARDING_STAGE.APPROVED;
      break;
    case RIDER_STATUS.SUSPENDED:
      stage = ONBOARDING_STAGE.SUSPENDED;
      break;
    case RIDER_STATUS.PENDING_APPROVAL:
      stage = ONBOARDING_STAGE.PENDING;
      break;
    case RIDER_STATUS.REJECTED:
      stage = ONBOARDING_STAGE.REJECTED;
      break;
    default:
      // No rider record yet (GET /rider/profile 404s for a fresh sign-up).
      stage = draftStarted(draft) ? ONBOARDING_STAGE.DRAFT : ONBOARDING_STAGE.NONE;
  }

  return {
    stage,
    step,
    resumeScreen: resumeScreenForStep(step),
    isApproved: stage === ONBOARDING_STAGE.APPROVED,
    rejectionReason: rejectionReason || null,
  };
}