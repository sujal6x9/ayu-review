import { describe, expect, it } from "vitest";
import { googleCreatorAction, googleCreatorProfile } from "@/lib/google-signup";

describe("Google self-signup", () => {
  it("requires signup before paper-creator sign in", () => {
    expect(googleCreatorAction("signup", [])).toBe("create");
    expect(googleCreatorAction("signin", ["uploader"])).toBe("signin");
    expect(() => googleCreatorAction("signin", [])).toThrow("Sign up with Google first");
    expect(() => googleCreatorAction("signup", ["uploader"])).toThrow("already exists");
  });

  it("never opens or creates administrator access through the user Google flow", () => {
    expect(() => googleCreatorAction("signup", ["admin"])).toThrow("admin sign-in");
    expect(() => googleCreatorAction("signin", ["admin"])).toThrow("admin sign-in");
  });

  it("accepts a verified Gmail identity and normalizes its profile", () => {
    expect(
      googleCreatorProfile({
        email: " Creator@GMAIL.com ",
        emailConfirmedAt: "2026-10-26T08:00:00Z",
        providers: ["google"],
        fullName: "  Ayu Creator  ",
      }),
    ).toEqual({ email: "creator@gmail.com", fullName: "Ayu Creator" });
  });

  it("uses the Gmail username when Google provides no display name", () => {
    expect(
      googleCreatorProfile({
        email: "creator@gmail.com",
        emailConfirmedAt: "2026-10-26T08:00:00Z",
        providers: ["google"],
      }).fullName,
    ).toBe("creator");
  });

  it("rejects unverified, non-Google, and non-Gmail identities", () => {
    expect(() =>
      googleCreatorProfile({ email: "creator@gmail.com", providers: ["google"] }),
    ).toThrow("verified Google");
    expect(() =>
      googleCreatorProfile({
        email: "creator@gmail.com",
        emailConfirmedAt: "2026-10-26T08:00:00Z",
        providers: ["email"],
      }),
    ).toThrow("verified Google");
    expect(() =>
      googleCreatorProfile({
        email: "creator@example.com",
        emailConfirmedAt: "2026-10-26T08:00:00Z",
        providers: ["google"],
      }),
    ).toThrow("valid Gmail");
  });
});
