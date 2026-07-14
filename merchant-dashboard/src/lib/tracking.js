// Statuses with a rider actively moving the order - the only window where a
// live tracking map means anything. Mirrors ACTIVE_TRACK_STATUSES on the
// backend (request.service.js getActiveRoute).
export const TRACKABLE_STATUSES = ['RIDER_ASSIGNED', 'RIDER_EN_ROUTE', 'PICKED_UP', 'IN_TRANSIT']
