import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../lib/api'

export const fetchProducts = createAsyncThunk(
  'products/fetchAll',
  async ({ merchantId, page = 1, limit = 50 }) => {
    const params = new URLSearchParams({ page, limit })
    const response = await api.get(`/merchants/merchant/${merchantId}/products?${params}`)
    return response.data.data
  }
)

export const createProduct = createAsyncThunk(
  'products/create',
  async ({ merchantId, productData }) => {
    const response = await api.post(`/merchants/merchant/${merchantId}/products`, productData)
    return response.data.data
  }
)

export const updateProduct = createAsyncThunk(
  'products/update',
  async ({ merchantId, productId, productData }) => {
    const response = await api.put(`/merchants/merchant/${merchantId}/products/${productId}`, productData)
    return response.data.data
  }
)

export const deleteProduct = createAsyncThunk(
  'products/delete',
  async ({ merchantId, productId }) => {
    await api.delete(`/merchants/merchant/${merchantId}/products/${productId}`)
    return productId
  }
)

export const toggleProductAvailability = createAsyncThunk(
  'products/toggleAvailability',
  async ({ merchantId, productId, isAvailable }) => {
    const response = await api.patch(
      `/merchants/merchant/${merchantId}/products/${productId}/availability`,
      { isAvailable }
    )
    return response.data.data
  }
)

// ---------------- Variants ----------------

export const createVariant = createAsyncThunk(
  'products/createVariant',
  async ({ merchantId, productId, variant }) => {
    const response = await api.post(
      `/merchants/merchant/${merchantId}/products/${productId}/variants`,
      variant
    )
    return { productId, variant: response.data.data }
  }
)

export const updateVariant = createAsyncThunk(
  'products/updateVariant',
  async ({ merchantId, productId, variantId, patch }) => {
    const response = await api.patch(
      `/merchants/merchant/${merchantId}/products/${productId}/variants/${variantId}`,
      patch
    )
    return { productId, variant: response.data.data }
  }
)

export const deleteVariant = createAsyncThunk(
  'products/deleteVariant',
  async ({ merchantId, productId, variantId }) => {
    await api.delete(`/merchants/merchant/${merchantId}/products/${productId}/variants/${variantId}`)
    return { productId, variantId }
  }
)

// ---------------- Option groups ----------------

export const createOptionGroup = createAsyncThunk(
  'products/createOptionGroup',
  async ({ merchantId, productId, group }) => {
    const response = await api.post(
      `/merchants/merchant/${merchantId}/products/${productId}/option-groups`,
      group
    )
    return { productId, group: response.data.data }
  }
)

export const updateOptionGroup = createAsyncThunk(
  'products/updateOptionGroup',
  async ({ merchantId, productId, groupId, patch }) => {
    const response = await api.patch(
      `/merchants/merchant/${merchantId}/products/${productId}/option-groups/${groupId}`,
      patch
    )
    return { productId, group: response.data.data }
  }
)

export const deleteOptionGroup = createAsyncThunk(
  'products/deleteOptionGroup',
  async ({ merchantId, productId, groupId }) => {
    await api.delete(`/merchants/merchant/${merchantId}/products/${productId}/option-groups/${groupId}`)
    return { productId, groupId }
  }
)

export const createOptionItem = createAsyncThunk(
  'products/createOptionItem',
  async ({ merchantId, productId, groupId, item }) => {
    const response = await api.post(
      `/merchants/merchant/${merchantId}/products/${productId}/option-groups/${groupId}/items`,
      item
    )
    return { productId, groupId, item: response.data.data }
  }
)

export const updateOptionItem = createAsyncThunk(
  'products/updateOptionItem',
  async ({ merchantId, productId, groupId, itemId, patch }) => {
    const response = await api.patch(
      `/merchants/merchant/${merchantId}/products/${productId}/option-groups/${groupId}/items/${itemId}`,
      patch
    )
    return { productId, groupId, item: response.data.data }
  }
)

export const deleteOptionItem = createAsyncThunk(
  'products/deleteOptionItem',
  async ({ merchantId, productId, groupId, itemId }) => {
    await api.delete(
      `/merchants/merchant/${merchantId}/products/${productId}/option-groups/${groupId}/items/${itemId}`
    )
    return { productId, groupId, itemId }
  }
)

const productsSlice = createSlice({
  name: 'products',
  initialState: {
    products: [],
    total: 0,
    page: 1,
    limit: 50,
    loading: false,
    error: null,
  },
  reducers: {
    // Admin manages multiple merchants from one store; clear the list when
    // leaving a merchant's product page so the next one doesn't flash stale data.
    clearProducts: (state) => {
      state.products = []
      state.total = 0
      state.page = 1
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false
        // fetchProducts returns response.data.data, which is the products ARRAY.
        // Guard against both shapes so a list payload isn't mistaken for an object.
        state.products = Array.isArray(action.payload)
          ? action.payload
          : action.payload?.data || action.payload?.products || []
        state.total = action.payload?.meta?.total ?? action.payload?.total ?? state.products.length
        state.page = action.payload.meta?.page ?? action.payload.page ?? 1
        state.limit = action.payload.meta?.limit ?? action.payload.limit ?? 50
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
        const idx = state.products.findIndex((p) => p.id === action.payload.id)
        if (idx !== -1) state.products[idx] = { ...state.products[idx], ...action.payload }
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.products = state.products.filter((p) => p.id !== action.payload)
        state.total -= 1
      })
      .addCase(toggleProductAvailability.fulfilled, (state, action) => {
        const idx = state.products.findIndex((p) => p.id === action.payload.id)
        if (idx !== -1) state.products[idx] = { ...state.products[idx], ...action.payload }
      })
      // Variants
      .addCase(createVariant.fulfilled, (state, action) => {
        const p = state.products.find((x) => x.id === action.payload.productId)
        if (p) p.variants = [...(p.variants || []), action.payload.variant]
      })
      .addCase(updateVariant.fulfilled, (state, action) => {
        const p = state.products.find((x) => x.id === action.payload.productId)
        if (p && p.variants) {
          const i = p.variants.findIndex((v) => v.id === action.payload.variant.id)
          if (i !== -1) p.variants[i] = action.payload.variant
        }
      })
      .addCase(deleteVariant.fulfilled, (state, action) => {
        const p = state.products.find((x) => x.id === action.payload.productId)
        if (p && p.variants) p.variants = p.variants.filter((v) => v.id !== action.payload.variantId)
      })
      // Option groups
      .addCase(createOptionGroup.fulfilled, (state, action) => {
        const p = state.products.find((x) => x.id === action.payload.productId)
        if (p) p.optionGroups = [...(p.optionGroups || []), action.payload.group]
      })
      .addCase(updateOptionGroup.fulfilled, (state, action) => {
        const p = state.products.find((x) => x.id === action.payload.productId)
        if (p && p.optionGroups) {
          const i = p.optionGroups.findIndex((g) => g.id === action.payload.group.id)
          if (i !== -1) p.optionGroups[i] = { ...p.optionGroups[i], ...action.payload.group }
        }
      })
      .addCase(deleteOptionGroup.fulfilled, (state, action) => {
        const p = state.products.find((x) => x.id === action.payload.productId)
        if (p && p.optionGroups) {
          p.optionGroups = p.optionGroups.filter((g) => g.id !== action.payload.groupId)
        }
      })
      .addCase(createOptionItem.fulfilled, (state, action) => {
        const p = state.products.find((x) => x.id === action.payload.productId)
        const g = p?.optionGroups?.find((g) => g.id === action.payload.groupId)
        if (g) g.items = [...(g.items || []), action.payload.item]
      })
      .addCase(updateOptionItem.fulfilled, (state, action) => {
        const p = state.products.find((x) => x.id === action.payload.productId)
        const g = p?.optionGroups?.find((g) => g.id === action.payload.groupId)
        if (g && g.items) {
          const i = g.items.findIndex((it) => it.id === action.payload.item.id)
          if (i !== -1) g.items[i] = action.payload.item
        }
      })
      .addCase(deleteOptionItem.fulfilled, (state, action) => {
        const p = state.products.find((x) => x.id === action.payload.productId)
        const g = p?.optionGroups?.find((g) => g.id === action.payload.groupId)
        if (g && g.items) g.items = g.items.filter((it) => it.id !== action.payload.itemId)
      })
  },
})

export const { clearProducts } = productsSlice.actions
export default productsSlice.reducer
