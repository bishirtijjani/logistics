import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchCategories = createAsyncThunk(
  'categories/fetchAll',
  async (params = {}) => {
    const response = await api.get('/admin/categories', { params })
    return response.data
  }
)

export const createCategory = createAsyncThunk(
  'categories/create',
  async (payload) => {
    const response = await api.post('/admin/categories', payload)
    return response.data.data
  }
)

export const updateCategory = createAsyncThunk(
  'categories/update',
  async ({ categoryId, ...payload }) => {
    const response = await api.put(`/admin/categories/${categoryId}`, payload)
    return response.data.data
  }
)

export const deleteCategory = createAsyncThunk(
  'categories/delete',
  async (categoryId) => {
    const response = await api.delete(`/admin/categories/${categoryId}`)
    return { categoryId, ...response.data.data }
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
