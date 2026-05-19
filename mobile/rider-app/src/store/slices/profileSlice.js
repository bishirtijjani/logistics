import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

/**
 * Profile slice — wraps the auth/profile + Phase 7 profile-management
 * surface (edit, photo, password, account deletion, performance,
 * notification preferences). `hasPinSet` drives the PIN-guard hook and the
 * onboarding gate.
 */

export const fetchProfile = createAsyncThunk(
  "profile/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get("/auth/profile");
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load profile");
    }
  },
);

export const updateProfile = createAsyncThunk(
  "profile/update",
  async (data, { rejectWithValue }) => {
    try {
      const envelope = await api.patch("/auth/profile", data);
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to update profile");
    }
  },
);

export const updateProfilePicture = createAsyncThunk(
  "profile/updatePicture",
  async (url, { rejectWithValue }) => {
    try {
      const envelope = await api.put("/auth/profile/picture", { url });
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to update photo");
    }
  },
);

export const setTransactionPin = createAsyncThunk(
  "profile/setPin",
  async (pin, { rejectWithValue }) => {
    try {
      const envelope = await api.post("/auth/pin", { pin });
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to set PIN");
    }
  },
);

export const changeTransactionPin = createAsyncThunk(
  "profile/changePin",
  async ({ oldPin, newPin, currentPin }, { rejectWithValue }) => {
    try {
      // Server accepts `currentPin` (validator); legacy callers may pass `oldPin`.
      const envelope = await api.post("/auth/pin/change", {
        currentPin: currentPin ?? oldPin,
        newPin,
      });
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to change PIN");
    }
  },
);

export const deleteAccount = createAsyncThunk(
  "profile/deleteAccount",
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.delete("/auth/account");
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to delete account");
    }
  },
);

export const fetchNotificationPreferences = createAsyncThunk(
  "profile/fetchNotificationPreferences",
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get("/auth/notification-preferences");
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load preferences");
    }
  },
);

export const updateNotificationPreferences = createAsyncThunk(
  "profile/updateNotificationPreferences",
  async (data, { rejectWithValue }) => {
    try {
      const envelope = await api.patch("/auth/notification-preferences", data);
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to update preferences");
    }
  },
);

/**
 * Phase 7 — rider performance metrics (trailing 30 days). Backend computes
 * acceptance / cancellation / on-time / rating breakdown + streak.
 */
export const fetchPerformance = createAsyncThunk(
  "profile/fetchPerformance",
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get("/rider/performance");
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to load performance");
    }
  },
);

/**
 * Phase 7 — re-upload a rider KYC document. Caller must upload the file
 * to Cloudinary first (via `/auth/upload-signature` with `kind=rider_doc`)
 * and pass the resulting secure_url here along with the kind + expiry.
 */
export const reuploadRiderDocument = createAsyncThunk(
  "profile/reuploadRiderDocument",
  async ({ kind, url, expiresAt }, { rejectWithValue }) => {
    try {
      const envelope = await api.post("/rider/documents", { kind, url, expiresAt });
      return envelope?.data || envelope || {};
    } catch (err) {
      return rejectWithValue({
        code: err?.code || "DOC_REUPLOAD_FAILED",
        message: err?.message || "Failed to upload document",
      });
    }
  },
);

const initialState = {
  profile: null,
  notificationPreferences: null,
  performance: null,
  performanceLoadedAt: null,
  performanceLoading: false,
  isLoading: false,
  isUpdating: false,
  error: null,
};

const slice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    profileUpdatedLocal: (state, action) => {
      state.profile = { ...(state.profile || {}), ...(action.payload || {}) };
    },
    clearProfileError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── Fetch profile ────────────────────────────────────────────────────
      .addCase(fetchProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder
      // ── Update profile ───────────────────────────────────────────────────
      .addCase(updateProfile.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isUpdating = false;
        state.profile = { ...(state.profile || {}), ...(action.payload || {}) };
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      });

    builder.addCase(updateProfilePicture.fulfilled, (state, action) => {
      if (state.profile) {
        state.profile.profilePicture = action.payload?.profilePicture || action.payload?.url;
      }
    });

    builder
      // ── Set / change PIN ─────────────────────────────────────────────────
      .addCase(setTransactionPin.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(setTransactionPin.fulfilled, (state) => {
        state.isUpdating = false;
        if (state.profile) state.profile.hasPinSet = true;
      })
      .addCase(setTransactionPin.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      });

    builder
      .addCase(changeTransactionPin.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(changeTransactionPin.fulfilled, (state) => {
        state.isUpdating = false;
      })
      .addCase(changeTransactionPin.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      });

    builder
      // ── Delete account ───────────────────────────────────────────────────
      .addCase(deleteAccount.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(deleteAccount.fulfilled, (state) => {
        state.isUpdating = false;
        state.profile = null;
        state.notificationPreferences = null;
      })
      .addCase(deleteAccount.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload;
      });

    builder
      // ── Notification preferences ─────────────────────────────────────────
      .addCase(fetchNotificationPreferences.fulfilled, (state, action) => {
        state.notificationPreferences = action.payload;
      })
      .addCase(updateNotificationPreferences.fulfilled, (state, action) => {
        state.notificationPreferences = action.payload;
      });

    builder
      // ── Performance ──────────────────────────────────────────────────────
      .addCase(fetchPerformance.pending, (state) => {
        state.performanceLoading = true;
      })
      .addCase(fetchPerformance.fulfilled, (state, action) => {
        state.performanceLoading = false;
        state.performance = action.payload;
        state.performanceLoadedAt = Date.now();
      })
      .addCase(fetchPerformance.rejected, (state) => {
        state.performanceLoading = false;
      });
  },
});

export const { profileUpdatedLocal, clearProfileError } = slice.actions;
export default slice.reducer;
