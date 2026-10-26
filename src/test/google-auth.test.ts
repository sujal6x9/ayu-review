import { describe, expect, it } from "vitest";
import { parseOAuthCallback } from "@/lib/google-auth";

describe("Google OAuth callback", () => {
  it("extracts a native Supabase session", () => {
    expect(
      parseOAuthCallback(
        "com.ayuscholar.review://auth/callback#access_token=access&refresh_token=refresh",
      ),
    ).toEqual({ accessToken: "access", refreshToken: "refresh" });
  });

  it("returns provider errors without accepting unrelated links", () => {
    expect(
      parseOAuthCallback("com.ayuscholar.review://auth/callback#error_description=Access%20denied"),
    ).toEqual({ error: "Access denied" });
    expect(parseOAuthCallback("https://example.com/#access_token=bad")).toBeNull();
  });
});
