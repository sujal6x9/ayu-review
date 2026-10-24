import { describe, expect, it } from "vitest";
import { canDeleteComment, penBounds } from "../lib/review-tools";

describe("review tools", () => {
  it("allows authors to delete their comments", () => {
    expect(canDeleteComment("author", "author", false)).toBe(true);
    expect(canDeleteComment("author", "other", false)).toBe(false);
  });
  it("allows administrators to delete comments", () => {
    expect(canDeleteComment("author", "admin", true)).toBe(true);
  });
  it("keeps pen marks within the original page coordinates", () => {
    expect(penBounds([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    const bounds = penBounds([{ x: 0.2, y: 0.3 }, { x: 0.4, y: 0.5 }]);
    expect(bounds.x).toBeCloseTo(0.197);
    expect(bounds.w).toBeCloseTo(0.206);
  });
});