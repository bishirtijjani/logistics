import {
  formatNaira,
  formatDistanceKm,
  formatDurationMin,
  formatTimeHm,
} from "../../src/lib/formatters";

describe("formatNaira", () => {
  it("formats whole-naira amounts without decimals", () => {
    expect(formatNaira(1500)).toBe("₦1,500");
    expect(formatNaira(0)).toBe("₦0");
    expect(formatNaira(1000000)).toBe("₦1,000,000");
  });

  it("keeps two decimals when fractional naira is present", () => {
    expect(formatNaira(1500.5)).toBe("₦1,500.50");
    expect(formatNaira(99.99)).toBe("₦99.99");
  });

  it("renders a minus sign for negative amounts", () => {
    expect(formatNaira(-250)).toBe("-₦250");
  });

  it("omits the symbol when withSymbol=false", () => {
    expect(formatNaira(1500, { withSymbol: false })).toBe("1,500");
  });

  it("handles null/undefined/NaN safely", () => {
    expect(formatNaira(null)).toBe("₦0");
    expect(formatNaira(undefined)).toBe("₦0");
    expect(formatNaira(Number.NaN)).toBe("₦0");
  });
});

describe("formatDistanceKm", () => {
  it("returns metres when under 1 km", () => {
    expect(formatDistanceKm(400)).toBe("400 m");
    expect(formatDistanceKm(999)).toBe("999 m");
  });

  it("returns km with one decimal under 10 km", () => {
    expect(formatDistanceKm(1500)).toBe("1.5 km");
    expect(formatDistanceKm(9900)).toBe("9.9 km");
  });

  it("rounds to integer km at 10+ km", () => {
    expect(formatDistanceKm(15000)).toBe("15 km");
    expect(formatDistanceKm(99500)).toBe("100 km");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatDistanceKm(null)).toBe("");
    expect(formatDistanceKm(undefined)).toBe("");
  });
});

describe("formatDurationMin", () => {
  it("returns minutes under an hour", () => {
    expect(formatDurationMin(60)).toBe("1 min");
    expect(formatDurationMin(180)).toBe("3 min");
    expect(formatDurationMin(3540)).toBe("59 min");
  });

  it("returns hours when exactly divisible", () => {
    expect(formatDurationMin(3600)).toBe("1 hr");
    expect(formatDurationMin(7200)).toBe("2 hr");
  });

  it("returns hours + minutes when non-divisible", () => {
    expect(formatDurationMin(3900)).toBe("1 hr 5 min");
    expect(formatDurationMin(7320)).toBe("2 hr 2 min");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatDurationMin(null)).toBe("");
    expect(formatDurationMin(undefined)).toBe("");
  });
});

describe("formatTimeHm", () => {
  it("returns empty string when called with no value", () => {
    expect(formatTimeHm(null)).toBe("");
    expect(formatTimeHm(undefined)).toBe("");
  });

  it("formats a Date / ISO string into HH:MM with am/pm marker", () => {
    // We assert just that the output contains digits + a colon — locale
    // formatting of am/pm varies across runtimes.
    const out = formatTimeHm(new Date("2026-05-01T09:30:00Z"));
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });
});
