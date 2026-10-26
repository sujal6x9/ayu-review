export const NATIVE_GOOGLE_CALLBACK = "com.ayuscholar.review://auth/callback";

export type OAuthCallback = {
  accessToken?: string;
  refreshToken?: string;
  error?: string;
};

export function parseOAuthCallback(url: string): OAuthCallback | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "com.ayuscholar.review:" || parsed.host !== "auth") return null;
  const params = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const query = parsed.searchParams;
  const error = params.get("error_description") || query.get("error_description");
  if (error) return { error };
  const accessToken = params.get("access_token") || undefined;
  const refreshToken = params.get("refresh_token") || undefined;
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}
