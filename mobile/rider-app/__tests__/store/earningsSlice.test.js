/**
 * Tests the earningsSlice — focuses on the race-safe dedup logic for
 * `earningCreditedFromSocket`. That was an explicit Phase 6 audit fix and
 * deserves regression coverage.
 */

import reducer, {
  earningCreditedFromSocket,
  resetEarnings,
  fetchRiderEarnings,
  fetchMoreEarnings,
} from "../../src/store/slices/earningsSlice";

const initial = reducer(undefined, { type: "@@INIT" });

describe("earningCreditedFromSocket", () => {
  it("ignores non-RIDER_EARNING payloads", () => {
    const next = reducer(initial, earningCreditedFromSocket({ type: "WITHDRAWAL", amount: 100 }));
    expect(next).toEqual(initial);
  });

  it("ignores zero / negative amounts", () => {
    const next = reducer(initial, earningCreditedFromSocket({ type: "RIDER_EARNING", amount: 0 }));
    expect(next).toEqual(initial);
  });

  it("bumps all summary buckets on first credit", () => {
    const next = reducer(
      initial,
      earningCreditedFromSocket({
        type: "RIDER_EARNING",
        amount: 500,
        reference: "REF1-RIDER",
        id: "tx-1",
      }),
    );
    expect(next.summary.today.amount).toBe(500);
    expect(next.summary.today.count).toBe(1);
    expect(next.summary.week.amount).toBe(500);
    expect(next.summary.month.amount).toBe(500);
    expect(next.summary.allTime.amount).toBe(500);
    expect(next.allIds).toContain("tx-1");
  });

  it("dedupes by reference — second arrival is a no-op", () => {
    const first = reducer(
      initial,
      earningCreditedFromSocket({
        type: "RIDER_EARNING",
        amount: 500,
        reference: "REF1-RIDER",
        id: "tx-1",
      }),
    );
    const dup = reducer(
      first,
      earningCreditedFromSocket({
        type: "RIDER_EARNING",
        amount: 500,
        reference: "REF1-RIDER",
        id: "tx-1",
      }),
    );
    expect(dup.summary.today.amount).toBe(500); // not doubled
    expect(dup.summary.today.count).toBe(1);
  });

  it("dedupes against rows already merged in via fetch", () => {
    const seeded = {
      ...initial,
      byId: { "tx-9": { id: "tx-9", reference: "REF9-RIDER", amount: 200 } },
      allIds: ["tx-9"],
    };
    const next = reducer(
      seeded,
      earningCreditedFromSocket({
        type: "RIDER_EARNING",
        amount: 200,
        reference: "REF9-RIDER",
        id: "tx-9",
      }),
    );
    // Already-fetched row: tallies must NOT bump.
    expect(next.summary.today.amount).toBe(0);
    expect(next.summary.today.count).toBe(0);
    // But seenSocketReferences should record it so further sockets dedup.
    expect(next.seenSocketReferences).toContain("REF9-RIDER");
  });

  it("caps the seenSocketReferences log at 50 entries", () => {
    let state = initial;
    for (let i = 0; i < 60; i++) {
      state = reducer(
        state,
        earningCreditedFromSocket({
          type: "RIDER_EARNING",
          amount: 10,
          reference: `R-${i}`,
          id: `tx-${i}`,
        }),
      );
    }
    expect(state.seenSocketReferences.length).toBeLessThanOrEqual(50);
    expect(state.summary.today.count).toBe(60); // all 60 still counted
  });
});

describe("fetchRiderEarnings extraReducer", () => {
  it("replaces lists on page 1 fulfilled", () => {
    const next = reducer(initial, {
      type: fetchRiderEarnings.fulfilled.type,
      payload: {
        summary: { today: { amount: 100, count: 1 } },
        daily: [{ date: "2026-05-20", amount: 100, count: 1 }],
        recent: [{ id: "r1", amount: 100 }],
        pagination: { hasMore: true },
        averageRating: 4.6,
        page: 1,
      },
    });
    expect(next.allIds).toEqual(["r1"]);
    expect(next.hasMore).toBe(true);
    expect(next.averageRating).toBe(4.6);
  });

  it("on rejected, surfaces the error and clears loading", () => {
    const pending = reducer(initial, { type: fetchRiderEarnings.pending.type });
    expect(pending.isLoading).toBe(true);
    const next = reducer(pending, {
      type: fetchRiderEarnings.rejected.type,
      payload: "network down",
    });
    expect(next.isLoading).toBe(false);
    expect(next.error).toBe("network down");
  });
});

describe("fetchMoreEarnings", () => {
  it("appends without duplicates on fulfilled", () => {
    const seeded = reducer(initial, {
      type: fetchRiderEarnings.fulfilled.type,
      payload: { recent: [{ id: "a" }], pagination: { hasMore: true }, page: 1 },
    });
    const next = reducer(seeded, {
      type: fetchMoreEarnings.fulfilled.type,
      payload: { recent: [{ id: "a" }, { id: "b" }], pagination: { hasMore: false }, page: 2 },
    });
    expect(next.allIds).toEqual(["a", "b"]);
    expect(next.hasMore).toBe(false);
  });
});

it("resetEarnings returns to initial state", () => {
  const seeded = reducer(
    initial,
    earningCreditedFromSocket({
      type: "RIDER_EARNING",
      amount: 100,
      reference: "X",
      id: "tx-x",
    }),
  );
  expect(reducer(seeded, resetEarnings())).toEqual(initial);
});
