<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Review data lives in Lovable Cloud tables (papers, comments, activity) accessed from the browser client with RLS via `can_access_paper`; live sync uses Realtime postgres_changes per paper. Why: two-way sync without custom servers.
- Comment anchors are JSON (`pdf` page + fractional rect, `cell` sheet + ref, or `general`) stored separately from the original file, which is never modified. Why: annotations survive zoom and keep originals intact.
- Pen strokes extend PDF anchors with fractional point arrays; pen cell marks use existing cell anchors and persist as comment threads. Why: reuse live sync and deletion without changing original documents or loading another drawing engine.
- Comment deletion requires paper access and author ownership or a verified admin role in database RLS; parent deletion cascades replies and the UI requires confirmation. Why: prevent other reviewers from deleting each other's work and avoid orphaned annotations.
- Username accounts map deterministically to synthetic auth emails and have unique normalized profile usernames; passwords stay in Cloud Auth, never source code. Why: username sign-in without custom credential storage.
- Account creation and password resets use authenticated server functions that verify the caller through has_role before dynamically loading the privileged client; public signup is disabled and signup triggers never grant roles. Why: only existing administrators can manage access.
- Role changes verify the caller as admin, reject admin targets, and update the single existing reviewer/uploader role in one statement; no delete-and-insert. Why: protect administrator access and avoid leaving accounts without a role after a failed write.
- Share the credential form between distinct user and admin sign-in routes; derive the destination from stored roles and give the admin page its own navigation context. Why: separate workspaces without duplicating authentication or weakening server authorization.

- At compact widths, fixed bottom navigation switches between document, comments, and progress; selected spreadsheet cells expose a comment action above the grid. Wider screens show all panes. Why: keep phone review controls visible while scrolling large papers.
- Load PDF and spreadsheet viewers on demand and keep query results fresh for 30 seconds; mutations and Realtime still invalidate affected queries. Why: avoid loading unused document engines and repeated requests during navigation.
- Share the cached verified auth-user query between the route guard and account hook; auth events invalidate identity queries, and sign-out clears the cache. Why: avoid duplicate identity requests without changing Cloud authorization.
