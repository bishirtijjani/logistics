# VTU Logistics Admin Dashboard

Admin dashboard for managing the VTU Logistics platform.

## Features

### Dashboard Overview
- Real-time statistics for requests, revenue, providers, riders, and users
- Revenue trend charts (line chart)
- Request trend charts (bar chart)

### Request Management
- View all requests with filtering (type, status, date range)
- Request details modal with full information
- Reassign rider to a request
- Force cancel requests with reason
- Update request status

### Provider Management
- View all providers with filtering (status, search)
- Provider details modal with wallet information
- Approve pending providers
- Reject providers with reason
- Suspend/unsuspend providers
- Update provider commission rates

### Rider Management
- View all riders with filtering (status, availability)
- Rider details modal with tabs:
  - Details tab: Personal information, vehicle details, ratings
  - Earnings tab: Earnings history, completed deliveries, total earnings
  - Delivery History tab: Past deliveries with customer information
- Review pending riders (approve/reject)

### User Management
- View all users with filtering (role, search)
- User details modal with account information
- Suspend users with reason
- Unsuspend users

### Transaction Oversight
- View all transactions with filtering (type, status, search)
- Transaction details modal with full information
- View transaction metadata and user details

### Platform Settings
- Platform configuration (name, currency, timezone, support contact)
- Commission defaults (provider commission, rider commission, delivery fees)
- Notification settings (email, push, SMS, order alerts, rider alerts, payment alerts)

## Tech Stack

- **Frontend**: React 18, Vite
- **State Management**: Redux Toolkit
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Date Utilities**: date-fns

## Project Structure

```
admin-dashboard/
├── src/
│   ├── components/       # Reusable components
│   ├── lib/              # Utility functions (API client)
│   ├── pages/            # Page components
│   │   ├── DashboardPage.jsx
│   │   ├── RequestsPage.jsx
│   │   ├── ProvidersPage.jsx
│   │   ├── RidersPage.jsx
│   │   ├── UsersPage.jsx
│   │   ├── TransactionsPage.jsx
│   │   └── SettingsPage.jsx
│   ├── store/            # Redux store configuration
│   │   └── slices/       # Redux slices
│   │       ├── authSlice.js
│   │       ├── dashboardSlice.js
│   │       ├── requestsSlice.js
│   │       ├── providersSlice.js
│   │       ├── ridersSlice.js
│   │       ├── usersSlice.js
│   │       ├── transactionsSlice.js
│   │       └── settingsSlice.js
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## API Integration

The admin dashboard communicates with the backend API via `/api/admin` endpoints. All requests require authentication with an admin JWT token.

### API Endpoints

#### Dashboard
- `GET /api/admin/dashboard` - Get dashboard statistics

#### Requests
- `GET /api/admin/requests` - Get all requests (with filters)
- `PATCH /api/admin/requests/:requestId/reassign` - Reassign rider
- `PATCH /api/admin/requests/:requestId/cancel` - Force cancel request
- `PATCH /api/admin/requests/:requestId/status` - Update request status

#### Providers
- `GET /api/admin/providers` - Get all providers (with filters)
- `PATCH /api/admin/providers/:providerId/approve` - Approve provider
- `PATCH /api/admin/providers/:providerId/reject` - Reject provider
- `PATCH /api/admin/providers/:providerId/suspend` - Suspend provider
- `PATCH /api/admin/providers/:providerId/unsuspend` - Unsuspend provider
- `PATCH /api/admin/providers/:providerId/commission` - Update commission rate

#### Riders
- `GET /api/admin/riders` - Get all riders (with filters)
- `GET /api/admin/riders/pending` - Get pending riders
- `PATCH /api/admin/riders/:riderId/review` - Review rider (approve/reject)
- `GET /api/admin/riders/:riderId/earnings` - Get rider earnings
- `GET /api/admin/riders/:riderId/deliveries` - Get rider delivery history

#### Users
- `GET /api/admin/users` - Get all users (with filters)
- `PATCH /api/admin/users/:userId/status` - Update user status (suspend/unsuspend)

#### Transactions
- `GET /api/admin/transactions` - Get all transactions (with filters)

#### Settings
- `GET /api/admin/settings` - Get platform settings
- `PATCH /api/admin/settings` - Update platform settings

## Redux State Management

The application uses Redux Toolkit for state management. Each feature has its own slice:

- `authSlice` - Authentication state
- `dashboardSlice` - Dashboard statistics
- `requestsSlice` - Requests data and actions
- `providersSlice` - Providers data and actions
- `ridersSlice` - Riders data and actions
- `usersSlice` - Users data and actions
- `transactionsSlice` - Transactions data and actions
- `settingsSlice` - Platform settings

Each slice includes async thunks for API calls and reducers for state updates.

## Authentication

The admin dashboard requires authentication. Login is handled via the auth slice and stores the JWT token in localStorage. The token is automatically included in all API requests via the Axios interceptor.

## Styling

The dashboard uses Tailwind CSS for styling. The primary color is configured in `tailwind.config.js` and used throughout the application for consistent branding.

## Charts

Revenue and request trends are visualized using Recharts:
- Line chart for revenue trends over time
- Bar chart for request volume over time

## Development

### Adding New Features

1. Create a new page component in `src/pages/`
2. Create a Redux slice in `src/store/slices/`
3. Add the slice to the store in `src/store/store.js`
4. Add the route in `src/App.jsx`
5. Update the navigation in the sidebar

### Code Style

- Use functional components with hooks
- Follow React best practices
- Use Tailwind CSS for styling
- Use Lucide React for icons
- Keep components small and focused
- Use Redux Toolkit for state management

## Production Build

```bash
npm run build
```

The build output will be in the `dist/` directory and can be deployed to any static hosting service.

## License

Proprietary - VTU Logistics
