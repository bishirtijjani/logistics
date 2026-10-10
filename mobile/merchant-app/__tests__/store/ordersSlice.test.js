import reducer, {
  setStatusFilter,
  orderReceived,
  orderStatusPatched,
  fetchOrders,
  acceptOrder,
} from "../../src/store/slices/ordersSlice";

const initial = reducer(undefined, { type: "@@INIT" });

describe("ordersSlice", () => {
  it("setStatusFilter updates the filter", () => {
    const s = reducer(initial, setStatusFilter("REQUESTED"));
    expect(s.statusFilter).toBe("REQUESTED");
  });

  it("orderReceived prepends, dedupes by requestId, and bumps total", () => {
    let s = reducer(initial, orderReceived({ requestId: "a", status: "REQUESTED" }));
    expect(s.orders).toHaveLength(1);
    expect(s.total).toBe(1);

    // duplicate ignored
    s = reducer(s, orderReceived({ requestId: "a", status: "REQUESTED" }));
    expect(s.orders).toHaveLength(1);
    expect(s.total).toBe(1);

    // new one prepended
    s = reducer(s, orderReceived({ requestId: "b" }));
    expect(s.orders[0].id).toBe("b");
    expect(s.orders).toHaveLength(2);
  });

  it("orderStatusPatched merges into the matching order", () => {
    let s = reducer(initial, fetchOrders.fulfilled({ list: [{ id: "a", status: "REQUESTED" }], page: 1, total: 1, append: false }, "x", {}));
    s = reducer(s, orderStatusPatched({ requestId: "a", status: "PROCESSING" }));
    expect(s.orders[0].status).toBe("PROCESSING");
  });

  it("fetchOrders replaces on page 1 and appends on later pages", () => {
    let s = reducer(initial, fetchOrders.fulfilled({ list: [{ id: "a" }], page: 1, total: 2, append: false }, "x", {}));
    s = reducer(s, fetchOrders.fulfilled({ list: [{ id: "b" }], page: 2, total: 2, append: true }, "x", {}));
    expect(s.orders.map((o) => o.id)).toEqual(["a", "b"]);

    // replacing again on page 1 drops the old rows
    s = reducer(s, fetchOrders.fulfilled({ list: [{ id: "c" }], page: 1, total: 1, append: false }, "x", {}));
    expect(s.orders.map((o) => o.id)).toEqual(["c"]);
  });

  it("acceptOrder.fulfilled upserts the updated order", () => {
    let s = reducer(initial, fetchOrders.fulfilled({ list: [{ id: "a", status: "REQUESTED" }], page: 1, total: 1, append: false }, "x", {}));
    s = reducer(s, acceptOrder.fulfilled({ id: "a", status: "ACCEPTED" }, "x", "a"));
    expect(s.orders[0].status).toBe("ACCEPTED");
  });
});
