import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./useAppStore";

beforeEach(() => {
  useAppStore.setState({
    sessionStatus: "loading",
    user: null,
    isGuest: false,
  });
});

describe("session state", () => {
  it("does not erase Guest Mode when cloud auth reports no session", () => {
    useAppStore.getState().enterGuestMode();
    useAppStore.getState().setSession(null);

    expect(useAppStore.getState().isGuest).toBe(true);
    expect(useAppStore.getState().sessionStatus).toBe("guest");
  });

  it("replaces Guest Mode when an authenticated session arrives", () => {
    useAppStore.getState().enterGuestMode();
    useAppStore.getState().setSession({ user: { id: "user-1" } });

    expect(useAppStore.getState().isGuest).toBe(false);
    expect(useAppStore.getState().sessionStatus).toBe("authenticated");
  });
});
