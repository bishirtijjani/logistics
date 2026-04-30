import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchProfile = createAsyncThunk(
  "profile/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/auth/profile");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const updateProfile = createAsyncThunk(
  "profile/update",
  async (data, { rejectWithValue }) => {
    try {
      const response = await api.patch("/auth/profile", data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const updateProfilePicture = createAsyncThunk(
  "profile/updatePicture",
  async (url, { rejectWithValue }) => {
    try {
      const response = await api.put("/auth/profile/picture", { url });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const verifyBvn = createAsyncThunk(
  "profile/verifyBvn",
  async ({ bvn, firstName, lastName }, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/kyc/verify-bvn", {
        bvn,
        firstName,
        lastName,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchNotificationPreferences = createAsyncThunk(
  "profile/fetchNotificationPreferences",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/auth/notification-preferences");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const updateNotificationPreferences = createAsyncThunk(
  "profile/updateNotificationPreferences",
  async (data, { rejectWithValue }) => {
    try {
      const response = await api.patch("/auth/notification-preferences", data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const getUploadSignature = createAsyncThunk(
  "profile/getUploadSignature",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/upload-signature");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const setTransactionPin = createAsyncThunk(
  "profile/setPin",
  async (pin, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/pin", { pin });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const deleteAccount = createAsyncThunk(
  "profile/deleteAccount",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.delete("/auth/account");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

export const changeTransactionPin = createAsyncThunk(
  "profile/changePin",
  async ({ currentPin, newPin }, { rejectWithValue }) => {
    try {
      const response = await api.post("/auth/pin/change", {
        currentPin,
        newPin,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);

const initialState = {
  profile: null,
  notificationPreferences: null,
  isLoading: false,
  isUpdating: false,
  error: null,
};

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    clearProfileError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch profile
    builder.addCase(fetchProfile.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchProfile.fulfilled, (state, action) => {
      state.isLoading = false;
      state.profile = action.payload;
    });
    builder.addCase(fetchProfile.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    // Update profile
    builder.addCase(updateProfile.pending, (state) => {
      state.isUpdating = true;
      state.error = null;
    });
    builder.addCase(updateProfile.fulfilled, (state, action) => {
      state.isUpdating = false;
      state.profile = action.payload;
    });
    builder.addCase(updateProfile.rejected, (state, action) => {
      state.isUpdating = false;
      state.error = action.payload;
    });

    // Update profile picture
    builder.addCase(updateProfilePicture.fulfilled, (state, action) => {
      if (state.profile) {
        state.profile.profilePicture = action.payload.profilePicture;
      }
    });

    // Verify BVN
    builder.addCase(verifyBvn.pending, (state) => {
      state.isUpdating = true;
      state.error = null;
    });
    builder.addCase(verifyBvn.fulfilled, (state, action) => {
      state.isUpdating = false;
      if (state.profile) {
        state.profile.kycStatus = action.payload.kycStatus;
      }
    });
    builder.addCase(verifyBvn.rejected, (state, action) => {
      state.isUpdating = false;
      state.error = action.payload;
    });

    // Fetch notification preferences
    builder.addCase(fetchNotificationPreferences.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchNotificationPreferences.fulfilled, (state, action) => {
      state.isLoading = false;
      state.notificationPreferences = action.payload;
    });
    builder.addCase(fetchNotificationPreferences.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    });

    // Update notification preferences
    builder.addCase(updateNotificationPreferences.pending, (state) => {
      state.isUpdating = true;
      state.error = null;
    });
    builder.addCase(updateNotificationPreferences.fulfilled, (state, action) => {
      state.isUpdating = false;
      state.notificationPreferences = action.payload;
    });
    builder.addCase(updateNotificationPreferences.rejected, (state, action) => {
      state.isUpdating = false;
      state.error = action.payload;
    });

    // Set PIN
    builder.addCase(setTransactionPin.pending, (state) => {
      state.isUpdating = true;
      state.error = null;
    });
    builder.addCase(setTransactionPin.fulfilled, (state) => {
      state.isUpdating = false;
      if (state.profile) {
        state.profile.hasPinSet = true;
      }
    });
    builder.addCase(setTransactionPin.rejected, (state, action) => {
      state.isUpdating = false;
      state.error = action.payload;
    });

    // Change PIN
    builder.addCase(changeTransactionPin.pending, (state) => {
      state.isUpdating = true;
      state.error = null;
    });
    builder.addCase(changeTransactionPin.fulfilled, (state) => {
      state.isUpdating = false;
    });
    builder.addCase(changeTransactionPin.rejected, (state, action) => {
      state.isUpdating = false;
      state.error = action.payload;
    });

    // Delete account
    builder.addCase(deleteAccount.pending, (state) => {
      state.isUpdating = true;
      state.error = null;
    });
    builder.addCase(deleteAccount.fulfilled, (state) => {
      state.isUpdating = false;
      state.profile = null;
      state.notificationPreferences = null;
    });
    builder.addCase(deleteAccount.rejected, (state, action) => {
      state.isUpdating = false;
      state.error = action.payload;
    });
  },
});

export const { clearProfileError } = profileSlice.actions;
export default profileSlice.reducer;
