import { describe, expect, it } from "vitest";
import { googleCreatorProfile } from "@/lib/google-signup";

describe("Google self-signup", () => {
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
