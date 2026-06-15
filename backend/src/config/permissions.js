/**
 * Admin permission constants.
 * These strings are stored in the user.permissions array.
 */
const PERMISSIONS = {
  ALL: 'ALL', // Super Admin - can do everything
  MANAGE_USERS: 'MANAGE_USERS', // Customers, Riders
  MANAGE_MERCHANTS: 'MANAGE_MERCHANTS', // Merchants, Categories, Tags
  MANAGE_FINANCE: 'MANAGE_FINANCE', // Transactions, Revenue, Payouts
  MANAGE_SUPPORT: 'MANAGE_SUPPORT', // Tickets, Disputes
  MANAGE_SETTINGS: 'MANAGE_SETTINGS', // Platform settings, Marketing, Banners
  MANAGE_VTU: 'MANAGE_VTU', // VTU plans and networks
  MANAGE_STAFF: 'MANAGE_STAFF', // Create/Edit other Admin users
};

module.exports = { PERMISSIONS };
