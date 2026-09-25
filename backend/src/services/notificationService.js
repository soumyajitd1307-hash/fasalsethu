/**
 * Notification Service (B3 Task)
 * 
 * Manages in-app notifications for deals, status transitions, and offer events.
 * Uses Prisma PostgreSQL when DATABASE_URL is configured, with a resilient in-memory
 * fallback store for testing and offline environments.
 */

const { getPrisma } = require('../config/database');

// In-memory fallback storage
const memoryNotifications = [];
let memIdCounter = 1;

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

/**
 * Isolated test helper: clears test notifications.
 */
function __clearTestNotifications() {
  memoryNotifications.length = 0;
  memIdCounter = 1;
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

  const prisma = getPrisma();
  if (prisma) {
    try {
      return await prisma.notification.create({
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
    } catch {
      // Fall through to memory store if DB operation fails or not migrated
    }
  }

  // Memory fallback
  const item = {
    id: `notif-${Date.now()}-${memIdCounter++}`,
    userId,
    userRole,
    type,
    title,
    message,
    dealId,
    offerId,
    read: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryNotifications.unshift(item);
  return item;
}

/**
 * Retrieves notifications for a specific user with pagination and optional read filter.
 */
async function getUserNotifications(userId, { page = 1, limit = 20, read = undefined } = {}) {
  if (!userId) throw new Error('userId is required');

  const prisma = getPrisma();
  const skip = (page - 1) * limit;

  if (prisma) {
    try {
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
    } catch {
      // Fallback to memory store
    }
  }

  // Memory fallback query
  let filtered = memoryNotifications.filter((n) => n.userId === userId);
  if (read !== undefined) {
    filtered = filtered.filter((n) => n.read === Boolean(read));
  }

  const total = filtered.length;
  const rows = filtered.slice(skip, skip + limit);
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

  const prisma = getPrisma();
  if (prisma) {
    try {
      return await prisma.notification.count({
        where: { userId, read: false },
      });
    } catch {
      // Fallback
    }
  }

  return memoryNotifications.filter((n) => n.userId === userId && !n.read).length;
}

/**
 * Marks a single notification as read, enforcing user ownership.
 */
async function markAsRead(notificationId, userId) {
  if (!notificationId) throw notFound(notificationId);

  const prisma = getPrisma();
  if (prisma) {
    try {
      const existing = await prisma.notification.findUnique({
        where: { id: notificationId },
      });
      if (!existing) throw notFound(notificationId);
      if (userId && existing.userId !== userId) {
        throw forbidden('You cannot modify another user’s notification');
      }

      return await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
      });
    } catch (err) {
      if (err.status) throw err;
      // Fallback
    }
  }

  const item = memoryNotifications.find((n) => n.id === notificationId);
  if (!item) throw notFound(notificationId);
  if (userId && item.userId !== userId) {
    throw forbidden('You cannot modify another user’s notification');
  }

  item.read = true;
  item.updatedAt = new Date();
  return item;
}

/**
 * Marks all unread notifications as read for a user.
 */
async function markAllAsRead(userId) {
  if (!userId) throw new Error('userId is required');

  const prisma = getPrisma();
  if (prisma) {
    try {
      const result = await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
      return { success: true, updatedCount: result.count };
    } catch {
      // Fallback
    }
  }

  let count = 0;
  for (const n of memoryNotifications) {
    if (n.userId === userId && !n.read) {
      n.read = true;
      n.updatedAt = new Date();
      count++;
    }
  }

  return { success: true, updatedCount: count };
}

module.exports = {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  __clearTestNotifications,
};
