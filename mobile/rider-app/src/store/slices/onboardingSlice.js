import { createSlice } from '@reduxjs/toolkit';

/**
 * Onboarding slice — Become-Rider multi-step draft state.
 * Persisted to SecureStore in Phase 1.
 */

const initialState = {
  step: 0, // 0..4 (personal, vehicle, documents, review, submitted)
  draft: {
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
  },
  status: 'idle', // idle | submitting | submitted | error
  error: null,
};

const slice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    onboardingStepSet: (state, action) => {
      state.step = action.payload;
    },
    onboardingDraftMerged: (state, action) => {
      const patch = action.payload || {};
      state.draft = { ...state.draft, ...patch };
    },
    onboardingDocumentSet: (state, action) => {
      const { key, value } = action.payload || {};
      if (!key) return;
      state.draft.documents = { ...state.draft.documents, [key]: value };
    },
    resetOnboarding: () => initialState,
  },
});

export const {
  onboardingStepSet,
  onboardingDraftMerged,
  onboardingDocumentSet,
  resetOnboarding,
} = slice.actions;
export default slice.reducer;
