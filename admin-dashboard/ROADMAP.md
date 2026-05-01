# Admin Dashboard Remediation Roadmap

This roadmap details all improvements needed to make the admin dashboard 100% production-ready and state-of-the-art.

## Completed Work

### Phase 1 — Critical Bug Fixes ✅
- [x] Fix transactionsSlice.js endpoint (changed to `/admin/transactions`)
- [x] Fix settingsSlice.js HTTP method (changed PUT to PATCH)
- [x] Fix usersSlice.js stale list after suspend/unsuspend
- [x] Run Prisma migration
- [x] Add global toast/notification system (sonner)

### Phase 2 — Missing Pages/Features ✅
- [x] Create Pending Riders Review page
- [x] Add Update Status action to Request Details modal
- [x] Add date-range filters to Transactions page
- [x] Add search + status filters to Users page

### Phase 3 — UX/UI Polish ✅
- [x] Add password visibility toggle to login
- [x] Create 404 Not Found page
- [x] Add error boundary component
- [x] Create debounced search utility
- [x] Add debounced search to TransactionsPage
- [x] Add loading states to RequestsPage actions
- [x] Add loading states to PendingRidersPage actions

---

## Remaining Work

### Phase 4 — Missing Features (High Priority)

#### 4.1 Activity Log / Audit Trail Page
- [ ] Create AuditLogPage.jsx component
- [ ] Add audit log backend endpoint if not exists
- [ ] Display: who, what, when, for each admin action
- [ ] Add filters by action type, date range, admin user
- [ ] Add to sidebar navigation with History icon

### Phase 5 — UX/UI Polish (Medium Priority)

#### 5.1 Complete Search Debouncing
- [x] TransactionsPage - DONE
- [ ] UsersPage - apply useDebounce hook to search input
- [ ] MerchantsPage - apply useDebounce hook to search input (if search exists)
- [ ] RequestsPage - apply useDebounce hook to search input (if search exists)

#### 5.2 Responsive Mobile Layout
- [ ] Add hamburger menu toggle to Layout.jsx
- [ ] Make sidebar collapsible on mobile
- [ ] Add horizontal scroll wrapper to tables
- [ ] Adjust grid layouts for smaller screens
- [ ] Test on various screen sizes

#### 5.3 Dashboard Charts Data
- [ ] Remove hardcoded fallback data from DashboardPage.jsx
- [ ] Add empty state when backend doesn't return trend data
- [ ] Add loading state for charts
- [ ] Handle error state for dashboard stats

#### 5.4 Breadcrumb Navigation
- [ ] Create Breadcrumb component
- [ ] Add to Layout.jsx
- [ ] Show current page hierarchy
- [ ] Add navigation to parent pages
- [ ] Sync with current route

#### 5.5 Loading States (Complete Coverage)
- [x] PendingRidersPage - DONE
- [x] RequestsPage - DONE
- [ ] MerchantsPage - add loading states to approve/reject/suspend/unsuspend/commission actions
- [ ] UsersPage - add loading states to suspend/unsuspend actions
- [ ] RidersPage - add loading states to suspend/unsuspend actions

### Phase 6 — Production Features (Medium Priority)

#### 6.1 Real-time Updates
- [ ] Add WebSocket connection for live updates
- [ ] Show live notifications for new merchants, riders, transactions
- [ ] Auto-refresh tables when data changes
- [ ] Add connection status indicator

#### 6.2 Data Export
- [ ] Add CSV export to TransactionsPage
- [ ] Add CSV export to UsersPage
- [ ] Add CSV export to MerchantsPage
- [ ] Add CSV export to RequestsPage
- [ ] Use a library like papaparse or simple JS

#### 6.3 Bulk Actions
- [ ] Add checkbox selection to tables
- [ ] Add bulk approve/reject for pending merchants
- [ ] Add bulk suspend/unsuspend for users
- [ ] Add bulk action buttons in toolbar
- [ ] Add confirmation modals for bulk actions

#### 6.4 Profile/Account Management
- [ ] Add profile dropdown to Layout.jsx sidebar
- [ ] Create ProfilePage.jsx
- [ ] Allow admin to change password
- [ ] Allow admin to update email/name
- [ ] Show admin's activity history

#### 6.5 Notification Bell/Alert Center
- [ ] Add notification bell to header
- [ ] Create NotificationPanel component
- [ ] Show pending merchant approvals
- [ ] Show pending rider applications
- [ ] Show failed transactions
- [ ] Mark notifications as read
- [ ] Link notifications to relevant pages

#### 6.6 KYC/BVN Verification Management
- [ ] Add KYC status to User details modal
- [ ] Show BVN verification status
- [ ] Add manual approve/reject KYC actions
- [ ] Add KYC documents viewer
- [ ] Add to UsersPage as filter/column

#### 6.7 Transaction Actions
- [ ] Add refund button to Transaction details
- [ ] Add reverse charge capability
- [ ] Add mark as completed action
- [ ] Add transaction notes/comments
- [ ] Add action history to transactions

#### 6.8 Dashboard Quick Actions
- [ ] Add "Recent Pending Merchants" list to Dashboard
- [ ] Add "Latest Failed Transactions" list to Dashboard
- [ ] Add "Pending Rider Applications" count to Dashboard
- [ ] Add quick action buttons to approve/reject directly from Dashboard
- [ ] Add clickable items to navigate to full pages

#### 6.9 Dark Mode Toggle
- [ ] Add dark mode toggle to header
- [ ] Implement theme context/provider
- [ ] Add dark mode Tailwind classes
- [ ] Persist theme preference in localStorage
- [ ] Test all pages in dark mode

### Phase 7 — Architectural Modernizations (Low Priority)

#### 7.1 React Query / TanStack Query Migration
- [ ] Install @tanstack/react-query
- [ ] Replace Redux thunks with React Query queries
- [ ] Replace manual caching with React Query cache
- [ ] Add automatic refetching on window focus
- [ ] Add stale-while-revalidate strategy
- [ ] Remove Redux for data fetching (keep for UI state)

#### 7.2 Optimistic Updates
- [ ] Add optimistic updates for merchant approval
- [ ] Add optimistic updates for user suspend/unsuspend
- [ ] Add optimistic updates for rider approval
- [ ] Rollback on error
- [ ] Show visual feedback during optimistic update

#### 7.3 URL-Synced Filters
- [ ] Sync filters with URL query params
- [ ] Update URL when filters change
- [ ] Read filters from URL on page load
- [ ] Enable sharing of filtered views
- [ ] Browser back button restores filter state

#### 7.4 Pagination Component
- [ ] Create reusable Pagination component
- [ ] Add page number buttons (1, 2, 3...)
- [ ] Add "Showing X of Y" display
- [ ] Add page size selector (10, 20, 50, 100)
- [ ] Replace manual pagination on all pages
- [ ] Add "Go to page" input

#### 7.5 Session Expiry Handling
- [ ] Add "Session expired" toast notification
- [ ] Show countdown before logout
- [ ] Save unsaved work before redirect
- [ ] Add refresh token mechanism
- [ ] Add "Stay logged in" prompt

---

## Priority Order

1. **Phase 4** (Activity Log) - Critical for production auditing
2. **Phase 5** (UX Polish) - Improves user experience significantly
3. **Phase 6** (Production Features) - Adds essential functionality
4. **Phase 7** (Architectural) - Long-term modernization (can be deferred)

## Notes

- Each phase should be completed and tested before moving to the next
- Use `multi_edit` for multiple changes to the same file to avoid corruption
- Test all changes in the browser before marking complete
- Update this roadmap as items are completed
