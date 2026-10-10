import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchProfile = createAsyncThunk(
  "profile/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/auth/profile");
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const setTransactionPin = createAsyncThunk(
  "profile/setTransactionPin",
  async (pin, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/pin", { pin });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const changeTransactionPin = createAsyncThunk(
  "profile/changeTransactionPin",
  async ({ currentPin, newPin }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/pin/change", { currentPin, newPin });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const resetTransactionPin = createAsyncThunk(
  "profile/resetTransactionPin",
  async ({ password, pin }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/pin/reset", { password, pin });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const updateProfile = createAsyncThunk(
  "profile/update",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await api.patch("/auth/profile", payload);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

const initialState = {
  profile: null,
  isLoading: false,
  error: null,
};

const slice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    resetProfile: () => initialState,
  },
  extraReducers: (builder) => {
    builder
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

    for (const thunk of [setTransactionPin, changeTransactionPin, resetTransactionPin, updateProfile]) {
      builder.addCase(thunk.fulfilled, (state) => {
        if (state.profile) state.profile.hasPinSet = true;
      });
    }
  },
});

export const { resetProfile } = slice.actions;
export default slice.reducer;
