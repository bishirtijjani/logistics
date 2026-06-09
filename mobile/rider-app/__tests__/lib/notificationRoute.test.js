import { routeToScreen, parseDeepLink } from "../../src/lib/notificationRoute";

describe("routeToScreen - string forms", () => {
  it("maps offer paths to JobOffer with requestId", () => {
    expect(routeToScreen("/offer/abc-123")).toEqual({
      name: "JobOffer",
      params: { requestId: "abc-123" },
    });
  });

  it("maps trip paths to TripCockpit", () => {
    expect(routeToScreen("trip/xyz-789")).toEqual({
      name: "TripCockpit",
      params: { requestId: "xyz-789" },
    });
  });

  it("maps wallet sub-paths to their screens", () => {
    expect(routeToScreen("/wallet")).toEqual({
      name: "MainTabs",
      params: { screen: "WalletTab" },
    });
    expect(routeToScreen("/wallet/withdraw")).toEqual({
      name: "Withdraw",
      params: {},
    });
    expect(routeToScreen("/wallet/transactions/tx-1")).toEqual({
      name: "TransactionDetail",
      params: { transactionId: "tx-1" },
    });
    expect(routeToScreen("/wallet/beneficiaries")).toEqual({
      name: "Beneficiaries",
      params: {},
    });
  });

  it("maps notifications / kyc / performance / support", () => {
    expect(routeToScreen("/notifications")).toEqual({
      name: "NotificationsCenter",
      params: {},
    });
    expect(routeToScreen("/kyc")).toEqual({ name: "KycStatus", params: {} });
    expect(routeToScreen("/performance")).toEqual({
      name: "Performance",
      params: {},
    });
    expect(routeToScreen("/support")).toEqual({ name: "SupportHome", params: {} });
    expect(routeToScreen("/support/ticket/t-1")).toEqual({
      name: "TicketDetail",
      params: { ticketId: "t-1" },
    });
    expect(routeToScreen("/support/dispute/new/req-1")).toEqual({
      name: "CreateDispute",
      params: { requestId: "req-1" },
    });
    expect(routeToScreen("/support/dispute/d-1")).toEqual({
      name: "DisputeDetail",
      params: { disputeId: "d-1" },
    });
  });

  it("returns null for an unknown route", () => {
    expect(routeToScreen("/something-bogus")).toBeNull();
  });
});

describe("routeToScreen - notification payload forms", () => {
  it("uses data.route when provided", () => {
    expect(
      routeToScreen({ type: "REQUEST_STATUS", data: { route: "/trip/abc" } }),
    ).toEqual({ name: "TripCockpit", params: { requestId: "abc" } });
  });

  it("falls back to requestId then transactionId", () => {
    expect(routeToScreen({ requestId: "req-9" })).toEqual({
      name: "TripCockpit",
      params: { requestId: "req-9" },
    });
    expect(routeToScreen({ transactionId: "tx-9" })).toEqual({
      name: "Transactions",
      params: { highlightRef: "tx-9" },
    });
  });

  it("returns null for empty payloads", () => {
    expect(routeToScreen({})).toBeNull();
    expect(routeToScreen(null)).toBeNull();
  });
});

describe("parseDeepLink", () => {
  it("strips iprime:// before matching", () => {
    expect(parseDeepLink("iprime://trip/abc")).toEqual({
      name: "TripCockpit",
      params: { requestId: "abc" },
    });
  });

  it("strips the legacy riderapp:// prefix", () => {
    expect(parseDeepLink("riderapp://trip/abc")).toEqual({
      name: "TripCockpit",
      params: { requestId: "abc" },
    });
  });

  it("strips a universal-link host before matching", () => {
    expect(
      parseDeepLink("https://rider.iprime.ng/wallet/withdraw"),
    ).toEqual({ name: "Withdraw", params: {} });
  });

  it("returns null for empty input", () => {
    expect(parseDeepLink("")).toBeNull();
    expect(parseDeepLink(null)).toBeNull();
  });
});
