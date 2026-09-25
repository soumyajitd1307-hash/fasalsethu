/**
 * Notification Service (B3 Task)
 *
 * Manages in-app notifications for deals, status transitions, and offer events.
 * Single source of truth: Prisma PostgreSQL. Database errors are mapped to
 * clean application errors and never silently become in-memory writes.
 */

const { getPrisma } = require('../config/database');

function notFound(id) {
  const err = new Error(`Notification not found: ${id}`);
  err.status = 404;
  return err;
}

function forbidden(msg) {
  const err = new Error(msg || 'Forbidden: cannot access notification');
  err.status = 403;
  return err;
}

function dbNotConfigured() {
  const err = new Error('Database not configured (DATABASE_URL is not set)');
  err.status = 503;
  return err;
}

function clientOrThrow() {
  const prisma = getPrisma();
  if (!prisma) throw dbNotConfigured();
  return prisma;
}

// Map raw Prisma errors to clean API errors (never leak DB internals).
function toApiError(err, id) {
  if (err && err.code === 'P2025') {
    return notFound(id);
  }
  return err;
}

/**
 * Creates an event notification for a user.
 */
async function createNotification(data) {
  const {
    userId,
    userRole = null,
    type,
    title,
    message,
    dealId = null,
    offerId = null,
  } = data;

  if (!userId) throw new Error('userId is required for notification');
  if (!type) throw new Error('type is required for notification');
  if (!title) throw new Error('title is required for notification');
  if (!message) throw new Error('message is required for notification');

  const prisma = clientOrThrow();
  return prisma.notification.create({
    data: {
      userId,
      userRole,
      type,
      title,
      message,
      dealId,
      offerId,
      read: false,
    },
  });
}

/**
 * Retrieves notifications for a specific user with pagination and optional read filter.
 */
async function getUserNotifications(userId, { page = 1, limit = 20, read = undefined } = {}) {
  if (!userId) throw new Error('userId is required');

  const prisma = clientOrThrow();
  const skip = (page - 1) * limit;
  const where = { userId };
  if (read !== undefined) {
    where.read = Boolean(read);
  }

  const [rows, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data: rows,
    pagination: { page, limit, total, totalPages },
  };
}

/**
 * Returns count of unread notifications for a user.
 */
async function getUnreadCount(userId) {
  if (!userId) throw new Error('userId is required');

  const prisma = clientOrThrow();
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

/**
 * Marks a single notification as read, enforcing user ownership.
 */
async function markAsRead(notificationId, userId) {
  if (!notificationId) throw notFound(notificationId);

  const prisma = clientOrThrow();
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!existing) throw notFound(notificationId);
  if (userId && existing.userId !== userId) {
    throw forbidden('You cannot modify another user’s notification');
  }

  try {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  } catch (err) {
    throw toApiError(err, notificationId);
  }
}

/**
 * Marks all unread notifications as read for a user.
 */
async function markAllAsRead(userId) {
  if (!userId) throw new Error('userId is required');

  const prisma = clientOrThrow();
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return { success: true, updatedCount: result.count };
}

module.exports = {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
