import { accountEmailSchema } from "@/lib/accounts";

export type GoogleAccountFlow = "signup" | "signin";

export function googleCreatorAction(flow: GoogleAccountFlow, roles: readonly string[]) {
  if (roles.includes("admin")) {
    throw new Error("Administrator accounts must use the separate admin sign-in page.");
  }
  if (flow === "signin") {
    if (roles.includes("uploader")) return "signin" as const;
    throw new Error("No paper-creator account was found. Sign up with Google first.");
  }
  if (roles.length === 0) return "create" as const;
  if (roles.includes("uploader")) {
    throw new Error("This paper-creator account already exists. Use Google sign in.");
  }
  throw new Error("This Google account cannot create a paper-creator account.");
}

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
