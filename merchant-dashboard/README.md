# Merchant Dashboard

A React-based web dashboard for merchants/merchants to manage their orders, products, earnings, and analytics.

## Features

- **Authentication**: Secure login with MERCHANT role
- **Orders Management**: View, accept, reject, and update order statuses
- **Menu Management**: Create, edit, delete, and toggle product availability
- **Earnings**: View wallet balance, transaction history, and request withdrawals
- **Analytics**: Sales summary, order history, and earnings breakdown with charts
- **Settings**: Profile management and notification preferences

## Tech Stack

- **Frontend**: React 18, Vite
- **State Management**: Redux Toolkit
- **Routing**: React Router
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Prerequisites

- Node.js 18+ and npm
- Backend API running on `/api`

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`

## Build

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   └── Layout.jsx          # Main layout with sidebar navigation
├── lib/
│   └── api.js              # Axios instance with auth interceptor
├── pages/
│   ├── LoginPage.jsx        # Login page
│   ├── OrdersPage.jsx      # Orders management
│   ├── MenuPage.jsx        # Product/menu management
│   ├── EarningsPage.jsx    # Wallet and earnings
│   ├── AnalyticsPage.jsx   # Sales analytics
│   └── SettingsPage.jsx    # Profile and settings
├── store/
│   ├── slices/
│   │   ├── authSlice.js    # Authentication state
│   │   ├── ordersSlice.js  # Orders state
│   │   ├── productsSlice.js # Products state
│   │   ├── earningsSlice.js # Earnings state
│   │   ├── analyticsSlice.js # Analytics state
│   │   └── settingsSlice.js # Settings state
│   └── store.js            # Redux store configuration
├── index.css               # Tailwind imports
└── main.jsx                # App entry point with routing
```

## API Endpoints

The dashboard communicates with the backend at `/merchants/merchant/:merchantId/`:

- `GET /profile` - Get merchant profile
- `PATCH /profile` - Update merchant profile
- `GET /orders` - Get orders with pagination
- `PATCH /orders/:requestId/accept` - Accept order
- `PATCH /orders/:requestId/reject` - Reject order
- `PATCH /orders/:requestId/status` - Update order status
- `GET /wallet` - Get wallet balance
- `POST /wallet/withdraw` - Request withdrawal
- `GET /products` - Get products
- `POST /products` - Create product
- `PUT /products/:productId` - Update product
- `DELETE /products/:productId` - Delete product
- `PATCH /products/:productId/availability` - Toggle availability
- `GET /analytics/sales` - Get sales summary
- `GET /analytics/orders` - Get order history
- `GET /analytics/earnings` - Get earnings breakdown

## Authentication

The dashboard uses JWT tokens stored in `localStorage`:
- `merchant_token` - JWT token for API requests
- `merchant_user` - User data object

All API requests include the token in the `Authorization` header.

## Environment Variables

No environment variables are required for development. The API base URL is configured as `/api` for proxying through the backend.
