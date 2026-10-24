import { z } from "zod";

export const accountEmailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
export const createAccountSchema = z.object({
  email: accountEmailSchema,
  fullName: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
  role: z.enum(["reviewer", "uploader"]),
});
export const resetAccountSchema = z.object({ userId: z.string().uuid(), password: z.string().min(8).max(128) });
export const changeRoleSchema = z.object({ userId: z.string().uuid(), role: z.enum(["reviewer", "uploader"]) });
export function editableAccountRole(roles: readonly string[]) {
  if (roles.includes("admin")) throw new Error("Administrator roles cannot be changed here.");
  const role = roles[0];
  if (roles.length !== 1 || (role !== "reviewer" && role !== "uploader")) throw new Error("This account needs a single reviewer or paper creator role before it can be changed.");
  return role;
}
export function assertAdmin(allowed: boolean | null) {
  if (allowed !== true) throw new Error("Only administrators can manage accounts.");
}
export function accountHome(roles: readonly string[]) {
  return roles.includes("admin") ? "/admin" as const : "/dashboard" as const;
}
