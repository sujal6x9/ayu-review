import { describe, expect, it } from "vitest";
import { accountHome, assertAdmin, changeRoleSchema, createAccountSchema, editableAccountRole, usernameEmail } from "@/lib/accounts";

describe("Admin-controlled accounts", () => {
  it("allows changing a reviewer to paper creator and back", () => {
    const userId = "775676f4-8a1b-4fb0-9aa8-75727683ff7f";
    expect(changeRoleSchema.parse({ userId, role: "uploader" }).role).toBe("uploader");
    expect(changeRoleSchema.parse({ userId, role: "reviewer" }).role).toBe("reviewer");
    expect(editableAccountRole(["reviewer"])).toBe("reviewer");
    expect(editableAccountRole(["uploader"])).toBe("uploader");
  });
  it("does not promote users to admin through role changes", () => {
    expect(changeRoleSchema.safeParse({ userId: "775676f4-8a1b-4fb0-9aa8-75727683ff7f", role: "admin" }).success).toBe(false);
  });
  it("protects existing administrator roles from role changes", () => {
    expect(() => editableAccountRole(["admin"])).toThrow("Administrator roles cannot");
    expect(() => editableAccountRole(["admin", "reviewer"])).toThrow("Administrator roles cannot");
  });
  it("does not silently replace ambiguous or missing role assignments", () => {
    expect(() => editableAccountRole([])).toThrow("single");
    expect(() => editableAccountRole(["reviewer", "uploader"])).toThrow("single");
  });
  it("opens the separate admin panel for administrators", () => {
    expect(accountHome(["admin"])).toBe("/admin");
  });
  it("opens the user workspace for reviewers and paper creators", () => {
    expect(accountHome(["reviewer"])).toBe("/dashboard");
    expect(accountHome(["uploader"])).toBe("/dashboard");
  });
  it("maps admin username deterministically without OTP", () => {
    expect(usernameEmail(" Admin ")).toBe("admin@app.local");
  });
  it("allows administrator-created reviewer accounts", () => {
    expect(createAccountSchema.parse({ username: "reviewer1", fullName: "Reviewer", password: "A-valid-test-password9!", role: "reviewer" }).role).toBe("reviewer");
  });
  it("allows administrator-created paper creators", () => {
    expect(createAccountSchema.parse({ username: "creator1", fullName: "Creator", password: "A-valid-test-password9!", role: "uploader" }).role).toBe("uploader");
  });
  it("does not let user creation grant admin", () => {
    expect(createAccountSchema.safeParse({ username: "user1", fullName: "User", password: "A-valid-test-password9!", role: "admin" }).success).toBe(false);
  });
  it("denies account management without a verified admin role", () => {
    expect(() => assertAdmin(false)).toThrow("Only administrators");
    expect(() => assertAdmin(null)).toThrow("Only administrators");
    expect(() => assertAdmin(true)).not.toThrow();
  });
});