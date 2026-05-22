/**
 * Tests the notificationsSlice reducer paths that don't touch the network.
 * Async thunks are exercised by dispatching synthetic fulfilled/rejected
 * actions so we don't need to mock axios.
 */

import reducer, {
  notificationReceived,
  resetNotifications,
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../src/store/slices/notificationsSlice";

const initial = reducer(undefined, { type: "@@INIT" });

describe("notificationsSlice", () => {
  describe("notificationReceived", () => {
    it("prepends a new notification and bumps total + unreadCount", () => {
      const next = reducer(
        initial,
        notificationReceived({
          id: "n1",
          type: "REQUEST_STATUS",
          title: "Order picked up",
          body: "Your rider has the package",
        }),
      );
      expect(next.list).toHaveLength(1);
      expect(next.list[0].id).toBe("n1");
      expect(next.total).toBe(1);
      expect(next.unreadCount).toBe(1);
    });

    it("dedupes a notification that's already in the list", () => {
      const first = reducer(initial, notificationReceived({ id: "n1", title: "a", body: "b" }));
      const dup = reducer(first, notificationReceived({ id: "n1", title: "a", body: "b" }));
      expect(dup.list).toHaveLength(1);
      expect(dup.unreadCount).toBe(1);
    });

    it("ignores invalid payloads", () => {
      expect(reducer(initial, notificationReceived(null))).toEqual(initial);
      expect(reducer(initial, notificationReceived({}))).toEqual(initial);
    });
  });

  describe("fetchNotifications", () => {
    it("on fulfilled, replaces list when page=1", () => {
      const next = reducer(initial, {
        type: fetchNotifications.fulfilled.type,
        payload: {
          list: [{ id: "a", readAt: null }, { id: "b", readAt: "2026-01-01T00:00Z" }],
          page: 1,
          total: 2,
          unreadCount: 1,
        },
      });
      expect(next.list).toHaveLength(2);
      expect(next.page).toBe(1);
      expect(next.unreadCount).toBe(1);
    });

    it("on fulfilled with page>1, appends de-duped", () => {
      const seeded = reducer(initial, {
        type: fetchNotifications.fulfilled.type,
        payload: { list: [{ id: "a" }], page: 1, total: 5, unreadCount: 0 },
      });
      const next = reducer(seeded, {
        type: fetchNotifications.fulfilled.type,
        payload: { list: [{ id: "a" }, { id: "b" }], page: 2, total: 5, unreadCount: 0 },
      });
      expect(next.list.map((n) => n.id)).toEqual(["a", "b"]);
    });

    it("on rejected, sets error and clears loading", () => {
      const next = reducer(
        { ...initial, isLoading: true },
        { type: fetchNotifications.rejected.type, payload: "boom" },
      );
      expect(next.isLoading).toBe(false);
      expect(next.error).toBe("boom");
    });
  });

  it("fetchUnreadCount.fulfilled writes the count", () => {
    const next = reducer(initial, {
      type: fetchUnreadCount.fulfilled.type,
      payload: 7,
    });
    expect(next.unreadCount).toBe(7);
  });

  describe("markNotificationRead", () => {
    it("marks a row read and decrements unreadCount", () => {
      const seeded = reducer(initial, notificationReceived({ id: "n1", title: "x", body: "y" }));
      expect(seeded.unreadCount).toBe(1);
      const next = reducer(seeded, {
        type: markNotificationRead.fulfilled.type,
        payload: { id: "n1", readAt: "2026-05-20T10:00:00Z" },
      });
      expect(next.list[0].readAt).toBe("2026-05-20T10:00:00Z");
      expect(next.unreadCount).toBe(0);
    });

    it("is a no-op when the row is already read", () => {
      const seeded = reducer(initial, notificationReceived({ id: "n1", title: "x", body: "y" }));
      const marked = reducer(seeded, {
        type: markNotificationRead.fulfilled.type,
        payload: { id: "n1", readAt: "2026-05-20T10:00:00Z" },
      });
      const dup = reducer(marked, {
        type: markNotificationRead.fulfilled.type,
        payload: { id: "n1", readAt: "2026-05-20T11:00:00Z" },
      });
      expect(dup.unreadCount).toBe(0); // doesn't go negative
    });
  });

  it("markAllNotificationsRead.fulfilled marks every row read", () => {
    const a = reducer(initial, notificationReceived({ id: "n1", title: "a", body: "b" }));
    const b = reducer(a, notificationReceived({ id: "n2", title: "c", body: "d" }));
    expect(b.unreadCount).toBe(2);
    const next = reducer(b, { type: markAllNotificationsRead.fulfilled.type });
    expect(next.list.every((n) => n.readAt)).toBe(true);
    expect(next.unreadCount).toBe(0);
  });

  it("resetNotifications returns to initial state", () => {
    const seeded = reducer(initial, notificationReceived({ id: "n1", title: "a", body: "b" }));
    expect(reducer(seeded, resetNotifications())).toEqual(initial);
  });
});
