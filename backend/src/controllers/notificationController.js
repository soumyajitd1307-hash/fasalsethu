/**
 * Notification Controller (B3 Task)
 * 
 * Thin controller layer over notificationService.
 * Enforces authenticated user identity on all notification endpoints.
 */

const notificationService = require('../services/notificationService');

async function list(req, res, next) {
  try {
    const userId = (req.user && req.user.id) || req.query.userId || req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required to access notifications',
      });
    }

    const { page, limit, read } = req.query;
    const result = await notificationService.getUserNotifications(userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      read,
    });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    return next(err);
  }
}

async function getUnread(req, res, next) {
  try {
    const userId = (req.user && req.user.id) || req.query.userId || req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required to access notifications',
      });
    }

    const unreadCount = await notificationService.getUnreadCount(userId);
    const recentUnread = await notificationService.getUserNotifications(userId, {
      page: 1,
      limit: 10,
      read: false,
    });

    return res.json({
      success: true,
      unreadCount,
      data: recentUnread.data,
    });
  } catch (err) {
    return next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const userId = (req.user && req.user.id) || req.headers['x-user-id'];
    const notification = await notificationService.markAsRead(req.params.id, userId);

    return res.json({
      success: true,
      data: notification,
    });
  } catch (err) {
    return next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    const userId = (req.user && req.user.id) || req.body.userId || req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required to mark notifications as read',
      });
    }

    const result = await notificationService.markAllAsRead(userId);
    return res.json({
      success: true,
      updatedCount: result.updatedCount,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  getUnread,
  markRead,
  markAllRead,
};
