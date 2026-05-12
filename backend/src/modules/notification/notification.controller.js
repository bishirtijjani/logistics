const notificationService = require('./notification.service');
const { ApiResponse } = require('../../utils/api-response');

const listNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unread } = req.query;
    const result = await notificationService.listNotifications(userId, {
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
      unreadOnly: unread === 'true' || unread === '1',
    });
    const body = ApiResponse.paginated(
      'Notifications retrieved',
      result.notifications,
      result.page,
      result.limit,
      result.total,
    );
    body.meta.unreadCount = result.unreadCount;
    res.json(body);
  } catch (err) { next(err); }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.user.id);
    res.json(ApiResponse.success('Unread count', result));
  } catch (err) { next(err); }
};

const markRead = async (req, res, next) => {
  try {
    const result = await notificationService.markRead(req.user.id, req.params.id);
    res.json(ApiResponse.success('Marked as read', result));
  } catch (err) { next(err); }
};

const markAllRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllRead(req.user.id);
    res.json(ApiResponse.success('All notifications marked as read', result));
  } catch (err) { next(err); }
};

module.exports = {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
};
