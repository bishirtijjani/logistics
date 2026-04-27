import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchProducts = createAsyncThunk(
  'products/fetchAll',
  async ({ providerId, page = 1, limit = 20 }) => {
    const params = new URLSearchParams({ page, limit })
    const response = await api.get(`/providers/merchant/${providerId}/products?${params}`)
    return response.data.data
  }
)

export const createProduct = createAsyncThunk(
  'products/create',
  async ({ providerId, productData }) => {
    const response = await api.post(`/providers/merchant/${providerId}/products`, productData)
    return response.data.data
  }
)

export const updateProduct = createAsyncThunk(
  'products/update',
  async ({ providerId, productId, productData }) => {
    const response = await api.put(`/providers/merchant/${providerId}/products/${productId}`, productData)
    return response.data.data
  }
)

export const deleteProduct = createAsyncThunk(
  'products/delete',
  async ({ providerId, productId }) => {
    await api.delete(`/providers/merchant/${providerId}/products/${productId}`)
    return productId
  }
)

export const toggleProductAvailability = createAsyncThunk(
  'products/toggleAvailability',
  async ({ providerId, productId, isAvailable }) => {
    const response = await api.patch(`/providers/merchant/${providerId}/products/${productId}/availability`, { isAvailable })
    return response.data.data
  }
)

const productsSlice = createSlice({
  name: 'products',
  initialState: {
    products: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false
        state.products = action.payload.products || []
        state.total = action.payload.total
        state.page = action.payload.page
        state.limit = action.payload.limit
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.products.unshift(action.payload)
        state.total += 1
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        const index = state.products.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.products[index] = action.payload
        }
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.products = state.products.filter((p) => p.id !== action.payload)
        state.total -= 1
      })
      .addCase(toggleProductAvailability.fulfilled, (state, action) => {
        const index = state.products.findIndex((p) => p.id === action.payload.id)
        if (index !== -1) {
          state.products[index] = action.payload
        }
      })
  },
})

export default productsSlice.reducer
