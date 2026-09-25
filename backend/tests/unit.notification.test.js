const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const notificationService = require('../src/services/notificationService');

describe('B3 Notification Service Unit Tests', () => {
  beforeEach(() => {
    notificationService.__clearTestNotifications();
  });

  test('1. Creates and stores notification with default read=false', async () => {
    const notif = await notificationService.createNotification({
      userId: 'U-100',
      userRole: 'buyer',
      type: 'DEAL_CREATED',
      title: 'Deal Proposal Accepted',
      message: 'Farmer accepted deal for 200 quintals of Onion.',
      dealId: 'D-999',
    });

    assert.ok(notif.id);
    assert.equal(notif.userId, 'U-100');
    assert.equal(notif.read, false);
    assert.equal(notif.dealId, 'D-999');
  });

  test('2. User can retrieve only their own notifications', async () => {
    await notificationService.createNotification({
      userId: 'USER_A',
      type: 'OFFER_RECEIVED',
      title: 'Offer for User A',
      message: 'Msg A',
    });
    await notificationService.createNotification({
      userId: 'USER_B',
      type: 'OFFER_RECEIVED',
      title: 'Offer for User B',
      message: 'Msg B',
    });

    const notifsA = await notificationService.getUserNotifications('USER_A');
    const notifsB = await notificationService.getUserNotifications('USER_B');

    assert.equal(notifsA.data.length, 1);
    assert.equal(notifsA.data[0].userId, 'USER_A');
    assert.equal(notifsA.data[0].title, 'Offer for User A');

    assert.equal(notifsB.data.length, 1);
    assert.equal(notifsB.data[0].userId, 'USER_B');
    assert.equal(notifsB.data[0].title, 'Offer for User B');
  });

  test('3. Calculates accurate unread count for user', async () => {
    await notificationService.createNotification({
      userId: 'U-COUNT',
      type: 'TEST_1',
      title: 'T1',
      message: 'M1',
    });
    const n2 = await notificationService.createNotification({
      userId: 'U-COUNT',
      type: 'TEST_2',
      title: 'T2',
      message: 'M2',
    });

    let unread = await notificationService.getUnreadCount('U-COUNT');
    assert.equal(unread, 2);

    await notificationService.markAsRead(n2.id, 'U-COUNT');

    unread = await notificationService.getUnreadCount('U-COUNT');
    assert.equal(unread, 1);
  });

  test('4. Mark notification as read verifies ownership and rejects cross-user modification (403)', async () => {
    const notif = await notificationService.createNotification({
      userId: 'USER_OWNER',
      type: 'INFO',
      title: 'Owner only',
      message: 'Owner message',
    });

    // Cross-user attempt
    await assert.rejects(
      async () => {
        await notificationService.markAsRead(notif.id, 'IMPOSTOR_USER');
      },
      (err) => {
        assert.equal(err.status, 403);
        assert.match(err.message, /cannot modify another user/i);
        return true;
      }
    );

    // Legitimate owner
    const updated = await notificationService.markAsRead(notif.id, 'USER_OWNER');
    assert.equal(updated.read, true);
  });

  test('5. Marks all unread notifications as read for current user only', async () => {
    await notificationService.createNotification({
      userId: 'USER_BULK',
      type: 'BULK_1',
      title: 'B1',
      message: 'M1',
    });
    await notificationService.createNotification({
      userId: 'USER_BULK',
      type: 'BULK_2',
      title: 'B2',
      message: 'M2',
    });
    await notificationService.createNotification({
      userId: 'OTHER_USER',
      type: 'BULK_3',
      title: 'B3',
      message: 'M3',
    });

    const result = await notificationService.markAllAsRead('USER_BULK');
    assert.equal(result.updatedCount, 2);

    const remainingUnreadBulk = await notificationService.getUnreadCount('USER_BULK');
    const remainingUnreadOther = await notificationService.getUnreadCount('OTHER_USER');

    assert.equal(remainingUnreadBulk, 0);
    assert.equal(remainingUnreadOther, 1);
  });
});
