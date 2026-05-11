import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../services/api";

const STORAGE_KEY = "categories:cache";

/**
 * Hydrate the categories cache from AsyncStorage so the home screen
 * has tiles instantly on cold start, even before the network call returns.
 */
export const hydrateCategoriesFromCache = createAsyncThunk(
  "categories/hydrate",
  async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
);

export const fetchCategories = createAsyncThunk(
  "categories/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const json = await api.get("/categories");
      const list = json?.data || [];
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {}
      return list;
    } catch (error) {
      return rejectWithValue(error.message || "Failed to load categories");
    }
  }
);

const initialState = {
  list: [],
  loading: false,
  hydrated: false,
  error: null,
  lastFetchedAt: 0,
};

const categoriesSlice = createSlice({
  name: "categories",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(hydrateCategoriesFromCache.fulfilled, (state, action) => {
        state.hydrated = true;
        if (Array.isArray(action.payload) && action.payload.length > 0) {
          state.list = action.payload;
        }
      })
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load categories";
      });
  },
});

export default categoriesSlice.reducer;
