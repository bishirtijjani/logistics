import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { newIdempotencyKey } from '../../services/idempotency';
import {
  loadOnboardingDraft,
  saveOnboardingDraft,
  clearOnboardingDraft,
} from '../../lib/onboardingPersistence';

/**
 * Onboarding slice - Become-Rider multi-step draft state.
 * Persisted to SecureStore via lib/onboardingPersistence so a kill-and-restart
 * resumes mid-application with all uploaded Cloudinary URLs preserved.
 */

// For this stage of the business the rider join flow is intentionally light:
// personal + vehicle only. The document / KYC capture (NIN, ID, licence,
// vehicle registration, insurance, vehicle photo) has been removed from the
// app. The backing Rider columns still exist and admin review still runs, so
// KYC can be reinstated later without a migration.
const emptyDraft = {
  personal: null,
  vehicle: null,
};

const initialState = {
  step: 0,
  draft: emptyDraft,
  status: 'idle', // idle | submitting | submitted | error
  error: null,
};

/**
 * Hydrate persisted draft into Redux on app boot. Safe to call multiple times.
 */
export const hydrateOnboarding = createAsyncThunk(
  'onboarding/hydrate',
  async () => {
    const draft = await loadOnboardingDraft();
    return draft;
  },
);

/**
 * Submit the rider application.
 * Only vehicle + personal fields are collected at this stage. vehicleType and
 * plateNumber are the only fields the backend requires; everything else is
 * optional in the validator, so a slim payload submits cleanly.
 */
export const submitRiderApplication = createAsyncThunk(
  'onboarding/submit',
  async (_, { getState, rejectWithValue }) => {
    const { draft } = getState().onboarding;
    const personal = draft.personal || {};
    const vehicle = draft.vehicle || {};

    const payload = {
      // Vehicle (the only required fields backend-side)
      vehicleType: vehicle.vehicleType,
      plateNumber: vehicle.plateNumber,
      vehicleColor: vehicle.vehicleColor || undefined,

      // Personal - persisted on the User record (optional backend-side)
      ...(personal.dob && { dateOfBirth: personal.dob }),
      ...(personal.address && { address: personal.address }),
    };

    try {
      const envelope = await api.post('/rider/register', payload, {
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      });
      // Clear persisted draft on success.
      await clearOnboardingDraft();
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to submit application');
    }
  },
);

const slice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    onboardingStepSet: (state, action) => {
      state.step = action.payload;
      // Async persistence - fire-and-forget.
      saveOnboardingDraft({ step: state.step, draft: state.draft });
    },
    onboardingDraftMerged: (state, action) => {
      const patch = action.payload || {};
      state.draft = { ...state.draft, ...patch };
      saveOnboardingDraft({ step: state.step, draft: state.draft });
    },
    onboardingPersonalSet: (state, action) => {
      state.draft.personal = action.payload || null;
      saveOnboardingDraft({ step: state.step, draft: state.draft });
    },
    onboardingVehicleSet: (state, action) => {
      state.draft.vehicle = action.payload || null;
      saveOnboardingDraft({ step: state.step, draft: state.draft });
    },
    resetOnboarding: () => {
      clearOnboardingDraft();
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hydrateOnboarding.fulfilled, (state, action) => {
      const persisted = action.payload;
      if (persisted && typeof persisted === 'object') {
        state.step = persisted.step ?? 0;
        state.draft = { ...emptyDraft, ...persisted.draft };
      }
    });

    builder
      .addCase(submitRiderApplication.pending, (state) => {
        state.status = 'submitting';
        state.error = null;
      })
      .addCase(submitRiderApplication.fulfilled, (state) => {
        state.status = 'submitted';
        state.draft = emptyDraft;
        state.step = 0;
      })
      .addCase(submitRiderApplication.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload;
      });
  },
});

export const {
  onboardingStepSet,
  onboardingDraftMerged,
  onboardingPersonalSet,
  onboardingVehicleSet,
  resetOnboarding,
} = slice.actions;
export default slice.reducer;
