const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const notificationService = require('../src/services/notificationService');

// Notifications persist in PostgreSQL only (no in-memory fallback), so these
// tests need a migrated database and use unique user IDs per run.
const HAVE_DB = !!process.env.DATABASE_URL;
const SKIP_DB = HAVE_DB ? false : 'BLOCKED: DATABASE_URL not set — needs local PostgreSQL';
const TS = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

const U = (name) => `${name}-${TS}`;
const createdIds = [];

async function createNotif(data) {
  const notif = await notificationService.createNotification(data);
  createdIds.push(notif.id);
  return notif;
}

describe('B3 Notification Service Unit Tests', { skip: SKIP_DB }, () => {
  before(async () => {
    // Fail loudly if DATABASE_URL is set but unreachable/unmigrated.
    const { getPrisma } = require('../src/config/database');
    await getPrisma().$queryRaw`SELECT 1`;
  });

  after(async () => {
    try {
      const { getPrisma } = require('../src/config/database');
      const prisma = getPrisma();
      if (createdIds.length > 0) {
        await prisma.notification.deleteMany({ where: { id: { in: createdIds } } });
      }
      await prisma.$disconnect();
    } catch (err) {
      console.warn(`cleanup warning (test data may remain): ${err.message}`);
    }
  });

  test('1. Creates and stores notification with default read=false', async () => {
    const notif = await createNotif({
      userId: U('U-100'),
      userRole: 'buyer',
      type: 'DEAL_CREATED',
      title: 'Deal Proposal Accepted',
      message: 'Farmer accepted deal for 200 quintals of Onion.',
    });

    assert.ok(notif.id);
    assert.equal(notif.userId, U('U-100'));
    assert.equal(notif.read, false);
  });

  test('2. User can retrieve only their own notifications', async () => {
    await createNotif({
      userId: U('USER_A'),
      type: 'OFFER_RECEIVED',
      title: 'Offer for User A',
      message: 'Msg A',
    });
    await createNotif({
      userId: U('USER_B'),
      type: 'OFFER_RECEIVED',
      title: 'Offer for User B',
      message: 'Msg B',
    });

    const notifsA = await notificationService.getUserNotifications(U('USER_A'));
    const notifsB = await notificationService.getUserNotifications(U('USER_B'));

    assert.equal(notifsA.data.length, 1);
    assert.equal(notifsA.data[0].userId, U('USER_A'));
    assert.equal(notifsA.data[0].title, 'Offer for User A');

    assert.equal(notifsB.data.length, 1);
    assert.equal(notifsB.data[0].userId, U('USER_B'));
    assert.equal(notifsB.data[0].title, 'Offer for User B');
  });

  test('3. Calculates accurate unread count for user', async () => {
    await createNotif({
      userId: U('U-COUNT'),
      type: 'TEST_1',
      title: 'T1',
      message: 'M1',
    });
    const n2 = await createNotif({
      userId: U('U-COUNT'),
      type: 'TEST_2',
      title: 'T2',
      message: 'M2',
    });

    let unread = await notificationService.getUnreadCount(U('U-COUNT'));
    assert.equal(unread, 2);

    await notificationService.markAsRead(n2.id, U('U-COUNT'));

    unread = await notificationService.getUnreadCount(U('U-COUNT'));
    assert.equal(unread, 1);
  });

  test('4. Mark notification as read verifies ownership and rejects cross-user modification (403)', async () => {
    const notif = await createNotif({
      userId: U('USER_OWNER'),
      type: 'INFO',
      title: 'Owner only',
      message: 'Owner message',
    });

    // Cross-user attempt
    await assert.rejects(
      async () => {
        await notificationService.markAsRead(notif.id, U('IMPOSTOR_USER'));
      },
      (err) => {
        assert.equal(err.status, 403);
        assert.match(err.message, /cannot modify another user/i);
        return true;
      }
    );

    // Legitimate owner
    const updated = await notificationService.markAsRead(notif.id, U('USER_OWNER'));
    assert.equal(updated.read, true);
  });

  test('5. Marks all unread notifications as read for current user only', async () => {
    await createNotif({
      userId: U('USER_BULK'),
      type: 'BULK_1',
      title: 'B1',
      message: 'M1',
    });
    await createNotif({
      userId: U('USER_BULK'),
      type: 'BULK_2',
      title: 'B2',
      message: 'M2',
    });
    await createNotif({
      userId: U('OTHER_USER'),
      type: 'BULK_3',
      title: 'B3',
      message: 'M3',
    });

    const result = await notificationService.markAllAsRead(U('USER_BULK'));
    assert.equal(result.updatedCount, 2);

    const remainingUnreadBulk = await notificationService.getUnreadCount(U('USER_BULK'));
    const remainingUnreadOther = await notificationService.getUnreadCount(U('OTHER_USER'));

    assert.equal(remainingUnreadBulk, 0);
    assert.equal(remainingUnreadOther, 1);
  });
});
