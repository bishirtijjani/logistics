import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as SecureStore from "../../lib/storage";
import api from "../../services/api";
import { registerPushToken } from "../../services/notifications";
import { clearOnboardingDraft } from "../../lib/onboardingPersistence";

/**
 * Check SecureStore for existing tokens on app startup.
 * If a valid access token exists, fetch the user profile to restore the session.
 */
export const hydrateAuth = createAsyncThunk(
  "auth/hydrate",
  async () => {
    try {
      const accessToken = await SecureStore.getItemAsync("accessToken");
      if (!accessToken) return null;

      const response = await api.get("/auth/profile");
      return { user: response.data };
    } catch (error) {
      await SecureStore.deleteItemAsync("accessToken");
      await SecureStore.deleteItemAsync("refreshToken");
      return null;
    }
  },
);

export const login = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/login", credentials);
      const { user, tokens } = response.data;
      await SecureStore.setItemAsync("accessToken", tokens.accessToken);
      await SecureStore.setItemAsync("refreshToken", tokens.refreshToken);
      registerPushToken().catch(() => {});
      return { user, tokens };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const register = createAsyncThunk(
  "auth/register",
  async (userData, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/rider/register", userData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async (verificationData, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/otp/verify", verificationData);
      const data = response.data;
      if (data?.tokens?.accessToken && data?.tokens?.refreshToken && data?.user) {
        await SecureStore.setItemAsync("accessToken", data.tokens.accessToken);
        await SecureStore.setItemAsync("refreshToken", data.tokens.refreshToken);
        registerPushToken().catch(() => {});
      }
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const logout = createAsyncThunk(
  "auth/logout",
  async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken });
      }
    } catch (error) {
      console.warn("Logout API failed, continuing local logout", error);
    } finally {
      await SecureStore.deleteItemAsync("accessToken");
      await SecureStore.deleteItemAsync("refreshToken");
      // Drop the persisted onboarding draft - a different user signing in on
      // the same device must not inherit an in-progress KYC application.
      try { await clearOnboardingDraft(); } catch (_) {}
    }
  },
);

export const requestPasswordReset = createAsyncThunk(
  "auth/requestPasswordReset",
  async (email, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/password/forgot", { email });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async ({ email, code, newPassword }, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/password/reset", {
        email,
        code,
        newPassword,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrating: true,
  error: null,
  pendingEmail: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setPendingEmail: (state, action) => {
      state.pendingEmail = action.payload;
    },
    forceLogout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isHydrating = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hydrateAuth.fulfilled, (state, action) => {
      state.isHydrating = false;
      if (action.payload) {
        state.isAuthenticated = true;
        state.user = action.payload.user;
        registerPushToken().catch(() => {});
      }
    });
    builder.addCase(hydrateAuth.rejected, (state) => {
      state.isHydrating = false;
    });

    builder.addCase(login.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
    });
    builder.addCase(login.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    builder.addCase(register.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(register.fulfilled, (state, action) => {
      state.isLoading = false;
      state.pendingEmail = action.meta.arg.email;
    });
    builder.addCase(register.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    builder.addCase(verifyOtp.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(verifyOtp.fulfilled, (state, action) => {
      state.isLoading = false;
      state.pendingEmail = null;
      if (action.payload?.user && action.payload?.tokens) {
        state.isAuthenticated = true;
        state.user = action.payload.user;
      }
    });
    builder.addCase(verifyOtp.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    builder.addCase(logout.fulfilled, (state) => {
      state.user = null;
      state.isAuthenticated = false;
    });

    builder.addCase(requestPasswordReset.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(requestPasswordReset.fulfilled, (state) => {
      state.isLoading = false;
    });
    builder.addCase(requestPasswordReset.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    builder.addCase(resetPassword.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(resetPassword.fulfilled, (state) => {
      state.isLoading = false;
    });
    builder.addCase(resetPassword.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });
  },
});

export const { clearError, setPendingEmail, forceLogout } = authSlice.actions;
export default authSlice.reducer;
