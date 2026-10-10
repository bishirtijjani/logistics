import reducer, {
  clearError,
  setPendingEmail,
  forceLogout,
  login,
  logout,
  deleteAccount,
} from "../../src/store/slices/authSlice";

const initial = reducer(undefined, { type: "@@INIT" });

describe("authSlice", () => {
  it("clearError resets the error", () => {
    const s = reducer({ ...initial, error: "boom" }, clearError());
    expect(s.error).toBeNull();
  });

  it("setPendingEmail stores the pending email", () => {
    const s = reducer(initial, setPendingEmail("a@b.com"));
    expect(s.pendingEmail).toBe("a@b.com");
  });

  it("forceLogout clears the session", () => {
    const authed = { ...initial, isAuthenticated: true, user: { id: "u1" }, isHydrating: false };
    const s = reducer(authed, forceLogout());
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
  });

  it("login.fulfilled authenticates and stores the user", () => {
    const s = reducer(initial, login.fulfilled({ user: { id: "u1", merchantId: "m1" }, tokens: {} }, "x", {}));
    expect(s.isAuthenticated).toBe(true);
    expect(s.user.merchantId).toBe("m1");
    expect(s.isLoading).toBe(false);
  });

  it("login.rejected surfaces the error", () => {
    const s = reducer(initial, login.rejected(null, "x", {}, "Invalid credentials"));
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe("Invalid credentials");
  });

  it("logout.fulfilled and deleteAccount.fulfilled clear the session", () => {
    const authed = { ...initial, isAuthenticated: true, user: { id: "u1" } };
    expect(reducer(authed, logout.fulfilled()).isAuthenticated).toBe(false);
    expect(reducer(authed, deleteAccount.fulfilled()).isAuthenticated).toBe(false);
  });
});
