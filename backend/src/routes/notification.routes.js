/**
 * Notification Routes (B3 Task)
 */

const express = require('express');
const notificationController = require('../controllers/notificationController');
const { notificationQuerySchema, validateQuery } = require('../utils/validate');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

// GET /api/notifications
router.get('/', validateQuery(notificationQuerySchema), notificationController.list);

// GET /api/notifications/unread
router.get('/unread', notificationController.getUnread);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', notificationController.markRead);

// PATCH /api/notifications/read-all
router.patch('/read-all', notificationController.markAllRead);

module.exports = router;
