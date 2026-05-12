import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";
import { setCachedSettings } from "../../services/settings";

/**
 * Settings slice — mirrors `/settings/public` into Redux so screens can
 * subscribe via `useSelector` and re-render when settings load or change.
 *
 * The non-React `getSetting()` helper still works (read from the same cache
 * via setCachedSettings) but components that should react to setting changes
 * use `usePlatformSetting(key, defaultValue)` from services/settings.
 */
export const fetchPublicSettings = createAsyncThunk(
  "settings/fetchPublic",
  async (_, { rejectWithValue }) => {
    try {
      // api.js interceptor unwraps to the envelope body — payload is `envelope.data`.
      const envelope = await api.get("/settings/public");
      const data = envelope?.data || {};
      setCachedSettings(data);
      return data;
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to load settings");
    }
  },
);

const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    values: {},
    isLoaded: false,
    isLoading: false,
    error: null,
  },
  reducers: {
    settingsHydratedFromCache: (state, action) => {
      state.values = action.payload || {};
      state.isLoaded = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPublicSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPublicSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isLoaded = true;
        state.values = action.payload || {};
      })
      .addCase(fetchPublicSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { settingsHydratedFromCache } = settingsSlice.actions;
export default settingsSlice.reducer;
