import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchHomeCategories = createAsyncThunk(
  'homeCategories/fetch',
  async () => {
    const response = await api.get('/admin/home/categories')
    return response.data.data
  }
)

export const updateHomeCategories = createAsyncThunk(
  'homeCategories/update',
  async (items) => {
    const response = await api.put('/admin/home/categories', { items })
    return response.data.data
  }
)

const initialState = {
  categories: [],
  featuredIds: [],
  loading: false,
  saving: false,
  error: null,
}

const homeCategoriesSlice = createSlice({
  name: 'homeCategories',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchHomeCategories.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchHomeCategories.fulfilled, (state, action) => {
        state.loading = false
        state.categories = action.payload.categories || []
        state.featuredIds = action.payload.featuredIds || []
      })
      .addCase(fetchHomeCategories.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(updateHomeCategories.pending, (state) => {
        state.saving = true
      })
      .addCase(updateHomeCategories.fulfilled, (state, action) => {
        state.saving = false
        const items = action.payload.items || []
        const order = new Map(items.map((it, i) => [it.id, i]))
        state.featuredIds = items.filter((i) => i.featured).map((i) => i.id)
        state.categories = state.categories
          .map((c) => ({
            ...c,
            featured: order.has(c.id),
            homePosition: order.has(c.id) ? order.get(c.id) : null,
          }))
          .sort((a, b) => {
            if (a.featured !== b.featured) return a.featured ? -1 : 1
            if (a.featured && b.featured) return (a.homePosition ?? 0) - (b.homePosition ?? 0)
            return 0
          })
      })
      .addCase(updateHomeCategories.rejected, (state, action) => {
        state.saving = false
        state.error = action.error.message
      })
  },
})

export default homeCategoriesSlice.reducer
