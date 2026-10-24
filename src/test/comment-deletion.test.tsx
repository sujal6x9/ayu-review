import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Comment } from "@/lib/papers";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), changed: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ delete: () => ({ eq: () => ({ select: mocks.remove }) }) }) } }));
vi.mock("@/lib/papers", async (original) => ({ ...await original<typeof import("@/lib/papers")>(), logActivity: vi.fn() }));
import { CommentPanel } from "@/components/review/CommentPanel";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const comment: Comment = { id: "comment-1", paper_id: "paper", author_id: "author", anchor: { type: "general" }, parent_id: null, body: "Review issue", mark: "incorrect", status: "open", question_ref: "", suggested_correction: "", created_at: "2026-10-24T07:44:00Z", updated_at: "2026-10-24T07:44:00Z" };
function panel(meId = "author") {
  return render(<CommentPanel paperId="paper" meId={meId} isAdmin={false} comments={[comment]} activity={[]} nameOf={() => "Reviewer"} pending={null} clearPending={() => {}} focusId={null} onFocus={() => {}} onChanged={mocks.changed} />);
}
describe("comment deletion", () => {
  it("only deletes after confirmation and refreshes saved data", async () => {
    mocks.remove.mockResolvedValue({ data: [{ id: "comment-1" }], error: null });
    panel();
    fireEvent.click(screen.getByRole("button", { name: "Delete comment" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(mocks.changed).toHaveBeenCalledTimes(1));
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
  it("does not offer deletion to another reviewer", () => {
    panel("someone-else");
    expect(screen.queryByRole("button", { name: "Delete comment" })).not.toBeInTheDocument();
  });
});