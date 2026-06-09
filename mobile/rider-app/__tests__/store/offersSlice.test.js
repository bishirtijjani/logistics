/**
 * Tests the offersSlice - the FSM-style state machine that drives the
 * job-offer overlay. acceptOffer thunk is exercised via synthetic
 * pending/fulfilled/rejected actions; the network is never touched.
 */

// We need to mock socketService BEFORE the slice is imported because it
// fires socket emits inside reducers (rejection / acceptance optimistic
// signals). The slice also calls `serverNow()` from api.js - for tests
// we want a deterministic clock.
jest.mock("../../src/services/socket", () => ({
  __esModule: true,
  default: {
    emitJobAccept: jest.fn(),
    emitJobReject: jest.fn(),
  },
}));

jest.mock("../../src/services/api", () => ({
  __esModule: true,
  default: {},
  serverNow: () => 1_700_000_000_000, // fixed instant: 2023-11-14T22:13:20Z
}));

const reducer = require("../../src/store/slices/offersSlice").default;
const {
  offerEnqueued,
  offerDismissed,
  offerRejected,
  offerTaken,
  offerExpired,
  offersPruneStale,
  resetOffers,
  acceptOffer,
} = require("../../src/store/slices/offersSlice");

const NOW = 1_700_000_000_000;
const makeOffer = (overrides = {}) => ({
  requestId: "req-1",
  pickupLat: 12.0,
  pickupLng: 7.6,
  fare: 1500,
  distanceKm: 3.2,
  timeout: 60,
  offeredAt: NOW,
  ...overrides,
});

const initial = reducer(undefined, { type: "@@INIT" });

describe("offersSlice.offerEnqueued", () => {
  it("enqueues a well-formed offer and sets it active", () => {
    const next = reducer(initial, offerEnqueued(makeOffer()));
    expect(next.queue).toHaveLength(1);
    expect(next.activeOfferId).toBe("req-1");
    expect(next.status).toBe("showing");
  });

  it("rejects offers missing requestId", () => {
    expect(reducer(initial, offerEnqueued({ pickupLat: 1, pickupLng: 1 }))).toEqual(initial);
  });

  it("rejects offers missing pickup coords", () => {
    expect(reducer(initial, offerEnqueued({ requestId: "x" }))).toEqual(initial);
  });

  it("dedupes a re-broadcast of the same requestId", () => {
    const first = reducer(initial, offerEnqueued(makeOffer()));
    const dup = reducer(first, offerEnqueued(makeOffer()));
    expect(dup.queue).toHaveLength(1);
  });

  it("skips an offer whose TTL has already elapsed before enqueue", () => {
    const stale = makeOffer({ offeredAt: NOW - 120_000, timeout: 60 });
    expect(reducer(initial, offerEnqueued(stale))).toEqual(initial);
  });
});

describe("offersSlice - dismissal paths", () => {
  it("offerDismissed pops the active offer and advances to the next in queue", () => {
    const a = reducer(initial, offerEnqueued(makeOffer({ requestId: "a" })));
    const b = reducer(a, offerEnqueued(makeOffer({ requestId: "b" })));
    expect(b.activeOfferId).toBe("a"); // first-come stays active
    const dismissed = reducer(b, offerDismissed({ requestId: "a", outcome: "rejected" }));
    expect(dismissed.activeOfferId).toBe("b");
    expect(dismissed.lastDismissed).toEqual({ requestId: "a", outcome: "rejected" });
  });

  it("offerRejected dispatches socket emit and dismisses", () => {
    const socket = require("../../src/services/socket").default;
    socket.emitJobReject.mockClear();
    const seeded = reducer(initial, offerEnqueued(makeOffer()));
    const next = reducer(seeded, offerRejected("req-1"));
    expect(socket.emitJobReject).toHaveBeenCalledWith("req-1");
    expect(next.activeOfferId).toBeNull();
    expect(next.lastDismissed.outcome).toBe("rejected");
  });

  it("offerTaken on the active offer transitions to 'taken'", () => {
    const seeded = reducer(initial, offerEnqueued(makeOffer()));
    const next = reducer(seeded, offerTaken({ requestId: "req-1" }));
    expect(next.status).toBe("taken");
  });

  it("offerTaken on a non-active offer just removes it silently from the queue", () => {
    const a = reducer(initial, offerEnqueued(makeOffer({ requestId: "a" })));
    const b = reducer(a, offerEnqueued(makeOffer({ requestId: "b" })));
    const next = reducer(b, offerTaken({ requestId: "b" }));
    expect(next.queue.map((o) => o.requestId)).toEqual(["a"]);
    expect(next.activeOfferId).toBe("a");
    expect(next.status).toBe("showing");
  });

  it("offerExpired flips status to 'expired'", () => {
    const seeded = reducer(initial, offerEnqueued(makeOffer()));
    const next = reducer(seeded, offerExpired("req-1"));
    expect(next.status).toBe("expired");
  });

  it("offersPruneStale clears items whose ttl has elapsed", () => {
    // Fresh offer at NOW, then advance the clock past TTL via the
    // serverNow mock. We re-mock just for this assertion.
    const seeded = reducer(initial, offerEnqueued(makeOffer()));
    jest.resetModules();
    jest.doMock("../../src/services/api", () => ({
      __esModule: true,
      default: {},
      serverNow: () => NOW + 120_000,
    }));
    jest.doMock("../../src/services/socket", () => ({
      __esModule: true,
      default: { emitJobAccept: jest.fn(), emitJobReject: jest.fn() },
    }));
    // eslint-disable-next-line global-require
    const freshReducer = require("../../src/store/slices/offersSlice").default;
    // eslint-disable-next-line global-require
    const { offersPruneStale: freshPrune } = require("../../src/store/slices/offersSlice");
    const next = freshReducer(seeded, freshPrune());
    expect(next.queue).toHaveLength(0);
    expect(next.activeOfferId).toBeNull();
    jest.resetModules();
  });
});

describe("offersSlice - acceptOffer thunk reducers", () => {
  it("pending flips to 'accepting' when an active offer is showing", () => {
    const seeded = reducer(initial, offerEnqueued(makeOffer()));
    const next = reducer(seeded, { type: acceptOffer.pending.type });
    expect(next.status).toBe("accepting");
  });

  it("fulfilled flips the active offer to 'accepted'", () => {
    const seeded = reducer(initial, offerEnqueued(makeOffer()));
    const next = reducer(seeded, {
      type: acceptOffer.fulfilled.type,
      payload: { requestId: "req-1", payload: {} },
    });
    expect(next.status).toBe("accepted");
  });

  it("rejected with OFFER_TAKEN code flips to 'taken'", () => {
    const seeded = reducer(initial, offerEnqueued(makeOffer()));
    const next = reducer(seeded, {
      type: acceptOffer.rejected.type,
      payload: { status: 409, code: "OFFER_TAKEN" },
    });
    expect(next.status).toBe("taken");
  });

  it("rejected with OFFER_EXPIRED code flips to 'expired'", () => {
    const seeded = reducer(initial, offerEnqueued(makeOffer()));
    const next = reducer(seeded, {
      type: acceptOffer.rejected.type,
      payload: { status: 410, code: "OFFER_EXPIRED" },
    });
    expect(next.status).toBe("expired");
  });

  it("rejected on other errors flips to 'error' and preserves payload", () => {
    const seeded = reducer(initial, offerEnqueued(makeOffer()));
    const next = reducer(seeded, {
      type: acceptOffer.rejected.type,
      payload: { status: 500, code: "INTERNAL", message: "boom" },
    });
    expect(next.status).toBe("error");
    expect(next.error.message).toBe("boom");
  });
});

it("resetOffers returns to initial state", () => {
  const seeded = reducer(initial, offerEnqueued(makeOffer()));
  expect(reducer(seeded, resetOffers())).toEqual(initial);
});
