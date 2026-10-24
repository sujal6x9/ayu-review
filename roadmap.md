# Question Paper Review Hub — Roadmap

## Phase 1 (done)
- [x] Initial sign-in implementation
- [x] PDF / Excel upload with Paper ID, reviewer assignment, private storage
- [x] In-browser PDF viewer (zoom, pages, area marking) and Excel grid (sheets, cell comments, search)
- [x] Anchored comments, replies, marks, resolve/reopen, live sync, activity log
- [x] Paper status workflow and dashboard

## Phase 2
- [ ] Question auto-detection and navigation (Q1…Q150)
- [ ] Inline Excel cell editing with version history and conflict detection
- [ ] Accept / reject suggested corrections
- [ ] Revision uploads on resubmit, side-by-side compare
- [ ] Export annotated PDF, revised Excel, review reports

## Current request
- [x] Add comment/reply deletion with confirmation and author/admin Cloud access protection; permission tests pass
- [x] Add persistent mark pen for PDF strokes and spreadsheet cells; coordinate tests pass
- [ ] Verify saving/deletion on small screens with a signed-in account — managed session unavailable and saved temporary admin password no longer accepted; needs preview sign-in
- [x] Restore fixed phone comment navigation and selected-cell action; saved a B2 comment and read it back after reload on the current paper; checked 375/768/1092px
- [x] Lighten sign-in, workspace, and admin presentation; defer document engines, share verified identity requests, and reduce repeat fetches; public screens verified at 375/768/1113px with no runtime errors
- [x] Polish sign-in, header, dashboard, admin, uploads, and review screen presentation; sign-in checked at 375, 768, and 1280px
- [x] Verify signed-in paper review at phone/tablet/desktop widths with the supplied session
- [x] Add and verify admin-only Reviewer / Paper creator role changes; saved changes survive reload and test role restored
- [x] Separate user and admin sign-in pages and navigation; role destination tests pass
- [x] Verify supplied user session opens the paper review workspace
- [x] Username/password-only login; remove public signup and email recovery
- [x] Securely provision initial admin with user-approved generated password
- [x] Admin panel to create reviewers/paper creators and reset passwords
- [x] Verify admin and non-admin permissions end to end

## Phase 3
- [ ] Notifications (in-app, optional email), @mentions
- [x] Admin account creation and password management
- [ ] Audit tools and reviewer analytics
- [ ] Demo accounts and sample papers
