import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { newIdempotencyKey } from '../../services/idempotency';
import {
  loadOnboardingDraft,
  saveOnboardingDraft,
  clearOnboardingDraft,
} from '../../lib/onboardingPersistence';

/**
 * Onboarding slice — Become-Rider multi-step draft state.
 * Persisted to SecureStore via lib/onboardingPersistence so a kill-and-restart
 * resumes mid-application with all uploaded Cloudinary URLs preserved.
 */

const emptyDraft = {
  personal: null,
  vehicle: null,
  documents: {
    ninNumber: null,
    idDocumentUrl: null,
    driverLicenseNumber: null,
    driverLicenseUrl: null,
    driverLicenseExpiresAt: null,
    vehicleRegistrationUrl: null,
    vehicleRegistrationExpiresAt: null,
    insuranceCertificateUrl: null,
    insuranceExpiresAt: null,
    vehiclePhotoUrl: null,
  },
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
 * Sends the fields the current backend schema supports. Fields gated on
 * BLK-RiderKycExpansion (driverLicense*, vehicleRegistration*, insurance*)
 * are also sent in the payload; the backend will ignore them today and
 * persist them once the migration ships.
 */
export const submitRiderApplication = createAsyncThunk(
  'onboarding/submit',
  async (_, { getState, rejectWithValue }) => {
    const { draft } = getState().onboarding;
    const personal = draft.personal || {};
    const vehicle = draft.vehicle || {};
    const documents = draft.documents || {};

    const payload = {
      // Vehicle (currently in Rider schema)
      vehicleType: vehicle.vehicleType,
      plateNumber: vehicle.plateNumber,
      vehicleColor: vehicle.vehicleColor || undefined,

      // Identity (currently in Rider schema)
      ninNumber: documents.ninNumber,
      idDocumentUrl: documents.idDocumentUrl,
      vehiclePhotoUrl: documents.vehiclePhotoUrl,

      // BLK-RiderKycExpansion (passed now; persisted once migration ships)
      driverLicenseNumber: documents.driverLicenseNumber || undefined,
      driverLicenseUrl: documents.driverLicenseUrl || undefined,
      driverLicenseExpiresAt: documents.driverLicenseExpiresAt || undefined,
      vehicleRegistrationUrl: documents.vehicleRegistrationUrl || undefined,
      vehicleRegistrationExpiresAt: documents.vehicleRegistrationExpiresAt || undefined,
      insuranceCertificateUrl: documents.insuranceCertificateUrl || undefined,
      insuranceExpiresAt: documents.insuranceExpiresAt || undefined,

      // Personal — none of these are on the current Rider schema; sent for
      // forward compatibility. Backend currently ignores.
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
      // Async persistence — fire-and-forget.
      saveOnboardingDraft({ step: state.step, draft: state.draft });
    },
    onboardingDraftMerged: (state, action) => {
      const patch = action.payload || {};
      state.draft = { ...state.draft, ...patch };
      saveOnboardingDraft({ step: state.step, draft: state.draft });
    },
    onboardingDocumentSet: (state, action) => {
      const { key, value } = action.payload || {};
      if (!key) return;
      state.draft.documents = { ...state.draft.documents, [key]: value };
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
  onboardingDocumentSet,
  onboardingPersonalSet,
  onboardingVehicleSet,
  resetOnboarding,
} = slice.actions;
export default slice.reducer;
