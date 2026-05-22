import { parseISODate, isValidPastDate, isValidFutureDate, ageFromDob } from "../../src/lib/time";

describe("parseISODate", () => {
  it("parses a well-formed YYYY-MM-DD as UTC midnight", () => {
    const d = parseISODate("2026-05-20");
    expect(d).toBeInstanceOf(Date);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4);
    expect(d.getUTCDate()).toBe(20);
    expect(d.getUTCHours()).toBe(0);
  });

  it("rejects malformed formats", () => {
    expect(parseISODate("2026/05/20")).toBeNull();
    expect(parseISODate("20-05-2026")).toBeNull();
    expect(parseISODate("not a date")).toBeNull();
    expect(parseISODate("")).toBeNull();
    expect(parseISODate(null)).toBeNull();
    expect(parseISODate(undefined)).toBeNull();
    expect(parseISODate(20260520)).toBeNull();
  });

  it("rejects semantically invalid dates that JS would silently roll over", () => {
    expect(parseISODate("2024-02-30")).toBeNull(); // rolls to Mar 1
    expect(parseISODate("2024-13-01")).toBeNull(); // bad month
    expect(parseISODate("2024-00-15")).toBeNull(); // month 0
  });
});

describe("isValidPastDate", () => {
  it("returns true for a date strictly before today", () => {
    expect(isValidPastDate("1990-01-01")).toBe(true);
  });
  it("returns false for today or future dates", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isValidPastDate(today)).toBe(false);
    expect(isValidPastDate("2099-12-31")).toBe(false);
  });
  it("returns false for malformed input", () => {
    expect(isValidPastDate("garbage")).toBe(false);
    expect(isValidPastDate(null)).toBe(false);
  });
});

describe("isValidFutureDate", () => {
  it("returns true for today and future dates", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isValidFutureDate(today)).toBe(true);
    expect(isValidFutureDate("2099-12-31")).toBe(true);
  });
  it("returns false for past dates", () => {
    expect(isValidFutureDate("2000-01-01")).toBe(false);
  });
});

describe("ageFromDob", () => {
  it("returns null for malformed input", () => {
    expect(ageFromDob("not a date")).toBeNull();
  });
  it("computes years between dob and now", () => {
    const fiftyYearsAgo = new Date();
    fiftyYearsAgo.setUTCFullYear(fiftyYearsAgo.getUTCFullYear() - 50);
    const iso = fiftyYearsAgo.toISOString().slice(0, 10);
    expect(ageFromDob(iso)).toBe(50);
  });
});
