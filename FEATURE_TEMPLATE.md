# Feature Template

> How to add a new feature module to the platform. Follow this template exactly.

---

## Backend Module Structure

When adding a new feature (e.g., `referrals`), create these files:

```
backend/src/modules/referrals/
├── referrals.routes.js        # Express router + middleware
├── referrals.controller.js    # HTTP handler (thin layer)
├── referrals.service.js       # Business logic + DB operations
└── referrals.validator.js     # Zod schemas for request validation
```

### Step 1: Create Validator (`referrals.validator.js`)

```javascript
const { z } = require('zod');

const createReferralSchema = z.object({
  referredPhone: z.string().regex(/^0[789][01]\d{8}$/, 'Invalid phone'),
});

module.exports = { createReferralSchema };
```

### Step 2: Create Service (`referrals.service.js`)

```javascript
const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');

const createReferral = async (userId, { referredPhone }) => {
  // Business logic here - use prisma.$transaction for financial ops
  logger.info('Referral created', { userId, referredPhone });
  return result;
};

module.exports = { createReferral };
```

### Step 3: Create Controller (`referrals.controller.js`)

```javascript
const referralsService = require('./referrals.service');
const { ApiResponse } = require('../../utils/api-response');

const create = async (req, res, next) => {
  try {
    const result = await referralsService.createReferral(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Referral created', result));
  } catch (error) {
    next(error);
  }
};

module.exports = { create };
```

### Step 4: Create Routes (`referrals.routes.js`)

```javascript
const { Router } = require('express');
const controller = require('./referrals.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { createReferralSchema } = require('./referrals.validator');

const router = Router();
router.use(authenticate);
router.post('/', validate(createReferralSchema), controller.create);

module.exports = router;
```

### Step 5: Register in `app.js`

```javascript
const referralRoutes = require('./modules/referrals/referrals.routes');
app.use(`${API_PREFIX}/referrals`, referralRoutes);
```

---

## Mobile Feature Structure (Customer or Rider App)

```
src/features/referrals/
├── screens/
│   ├── ReferralScreen.js         # Main screen
│   └── ReferralDetailScreen.js   # Detail view
├── components/
│   ├── ReferralCard.js           # Feature-specific component
│   └── ReferralForm.js
├── referralsSlice.js             # Redux slice
├── referralsService.js           # API calls
└── referralsValidation.js        # Client-side validation
```

### Redux Slice Pattern

```javascript
const { createSlice, createAsyncThunk } = require('@reduxjs/toolkit');
const referralsService = require('./referralsService');

const fetchReferrals = createAsyncThunk(
  'referrals/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await referralsService.getAll();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed');
    }
  }
);

const referralsSlice = createSlice({
  name: 'referrals',
  initialState: {
    items: [],
    status: 'idle',    // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReferrals.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchReferrals.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchReferrals.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

module.exports = { referralsSlice, fetchReferrals };
```

### API Service Pattern

```javascript
const api = require('../../services/api');

const getAll = () => api.get('/referrals');
const create = (data) => api.post('/referrals', data);

module.exports = { getAll, create };
```

---

## Checklist Before Submitting

- [ ] Validator covers all inputs with proper constraints
- [ ] Service uses `prisma.$transaction()` for financial operations
- [ ] Controller only calls service + formats response
- [ ] Routes have proper auth + validation middleware
- [ ] Route registered in `app.js`
- [ ] Redux slice follows the `idle/loading/succeeded/failed` pattern
- [ ] No direct API calls from React components
- [ ] Error messages are user-friendly
