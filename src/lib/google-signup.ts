import { accountEmailSchema } from "@/lib/accounts";

type GoogleSignupIdentity = {
  email?: string | null | undefined;
  emailConfirmedAt?: string | null | undefined;
  providers?: readonly string[] | null | undefined;
  fullName?: string | null | undefined;
};

export function googleCreatorProfile(identity: GoogleSignupIdentity) {
  const email = accountEmailSchema.parse(identity.email);
  if (!identity.emailConfirmedAt || !identity.providers?.includes("google")) {
    throw new Error("Sign up with a verified Google account to continue.");
  }
  if (!email.endsWith("@gmail.com")) {
    throw new Error("Use a valid Gmail address to create an account.");
  }

  const suppliedName = identity.fullName?.trim();
  return {
    email,
    fullName: suppliedName || email.slice(0, -"@gmail.com".length),
  };
}
