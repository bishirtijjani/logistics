import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

// Surface the backend's helpful message (e.g. "Category with slug 'furniture'
// already exists") instead of axios's generic "Request failed with status code 409".
// Re-throwing an Error keeps `.message` intact through both `.unwrap()` at the call
// site and `action.error.message` in the rejected reducers.
const backendError = (err) =>
  new Error(err.response?.data?.message || err.message || 'Request failed')

export const fetchCategories = createAsyncThunk(
  'categories/fetchAll',
  async (params = {}) => {
    try {
      const response = await api.get('/admin/categories', { params })
      return response.data
    } catch (err) {
      throw backendError(err)
    }
  }
)

export const createCategory = createAsyncThunk(
  'categories/create',
  async (payload) => {
    try {
      const response = await api.post('/admin/categories', payload)
      return response.data.data
    } catch (err) {
      throw backendError(err)
    }
  }
)

export const updateCategory = createAsyncThunk(
  'categories/update',
  async ({ categoryId, ...payload }) => {
    try {
      const response = await api.put(`/admin/categories/${categoryId}`, payload)
      return response.data.data
    } catch (err) {
      throw backendError(err)
    }
  }
)

export const deleteCategory = createAsyncThunk(
  'categories/delete',
  async (categoryId) => {
    try {
      const response = await api.delete(`/admin/categories/${categoryId}`)
      return { categoryId, ...response.data.data }
    } catch (err) {
      throw backendError(err)
    }
  }
)

export const updateCategoryAttributeSchema = createAsyncThunk(
  'categories/updateAttributeSchema',
  async ({ categoryId, attributeSchema }) => {
    try {
      const response = await api.patch(`/admin/categories/${categoryId}/attribute-schema`, {
        attributeSchema,
      })
      return response.data.data
    } catch (err) {
      throw backendError(err)
    }
  }
)

const initialState = {
  list: [],
  total: 0,
  page: 1,
  limit: 50,
  loading: false,
  error: null,
}

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false
        state.list = action.payload.data || []
        state.total = action.payload.meta?.total ?? state.list.length
        state.page = action.payload.meta?.page ?? 1
        state.limit = action.payload.meta?.limit ?? 50
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.list.push(action.payload)
        state.list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const idx = state.list.findIndex((c) => c.id === action.payload.id)
        if (idx >= 0) state.list[idx] = { ...state.list[idx], ...action.payload }
      })
      .addCase(updateCategoryAttributeSchema.fulfilled, (state, action) => {
        const idx = state.list.findIndex((c) => c.id === action.payload.id)
        if (idx >= 0) state.list[idx] = { ...state.list[idx], ...action.payload }
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        if (action.payload.soft) {
          const idx = state.list.findIndex((c) => c.id === action.payload.categoryId)
          if (idx >= 0) state.list[idx].isActive = false
        } else {
          state.list = state.list.filter((c) => c.id !== action.payload.categoryId)
        }
      })
  },
})

export default categoriesSlice.reducer
