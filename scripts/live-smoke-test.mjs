import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  (await readFile(".env", "utf8"))
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      let value = line.slice(index + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      return [line.slice(0, index), value];
    }),
);

const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secretKey = env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && publishableKey && secretKey, "Supabase environment variables are required");

function apiFetch(input, init) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  if (
    secretKey.startsWith("sb_secret_") &&
    headers.get("Authorization") === `Bearer ${secretKey}`
  ) {
    headers.delete("Authorization");
  }
  return fetch(input, { ...init, headers });
}

const admin = createClient(url, secretKey, {
  global: { fetch: apiFetch },
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const email = `ayu-smoke-${runId}@example.com`;
const password = `Ayu-Smoke-${crypto.randomUUID()}!`;
let uploaderId;
let anonymousId;
let doctorId;
let paperId;
let filePath;

function client(key = publishableKey) {
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function checked(label, operation) {
  const result = await operation;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  console.log(`✓ ${label}`);
  return result.data;
}

try {
  const created = await checked(
    "create temporary paper creator",
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { managed_account: "true" },
      user_metadata: { full_name: "Ayu smoke test" },
    }),
  );
  uploaderId = created.user.id;
  await checked(
    "grant uploader role",
    admin.from("user_roles").insert({ user_id: uploaderId, role: "uploader" }),
  );

  const uploader = client();
  await checked("paper creator sign-in", uploader.auth.signInWithPassword({ email, password }));
  const doctor = await checked(
    "create Dr directory record",
    uploader
      .from("doctors")
      .insert({ name: "Smoke Test Dr", specialization: "BAMS", created_by: uploaderId })
      .select()
      .single(),
  );
  doctorId = doctor.id;

  const unattachedPaper = await checked(
    "create temporary unattached paper",
    uploader.rpc("create_paper", {
      _title: `Cleanup check ${runId}`,
      _file_name: "cleanup.pdf",
      _file_type: "pdf",
    }),
  );
  await checked(
    "remove failed upload record",
    uploader.rpc("delete_unattached_paper", { _paper_id: unattachedPaper.id }),
  );
  const removedPaper = await checked(
    "verify failed upload cleanup",
    admin.from("papers").select("id").eq("id", unattachedPaper.id).maybeSingle(),
  );
  assert.equal(removedPaper, null);

  const paper = await checked(
    "create paper through verified RPC",
    uploader.rpc("create_paper", {
      _title: `Smoke paper ${runId}`,
      _exam_name: "Smoke exam",
      _subject: "Integration testing",
      _test_number: "1",
      _file_name: "smoke.pdf",
      _file_type: "pdf",
    }),
  );
  paperId = paper.id;
  assert.equal(paper.uploader_id, uploaderId);

  filePath = `${paperId}/original/smoke.pdf`;
  await checked(
    "upload original file through storage RLS",
    uploader.storage.from("papers").upload(filePath, new TextEncoder().encode("%PDF-1.4 smoke"), {
      contentType: "application/pdf",
    }),
  );
  await checked(
    "attach uploaded file",
    uploader.from("papers").update({ file_path: filePath }).eq("id", paperId),
  );
  const disposablePath = `${paperId}/original/cleanup-check.pdf`;
  await checked(
    "upload disposable file",
    uploader.storage
      .from("papers")
      .upload(disposablePath, new TextEncoder().encode("%PDF-1.4 cleanup"), {
        contentType: "application/pdf",
      }),
  );
  await checked(
    "remove uploaded file through storage RLS",
    uploader.storage.from("papers").remove([disposablePath]),
  );

  const shareToken = await checked(
    "assign Dr and create password link",
    uploader.rpc("configure_paper_share", {
      _paper_id: paperId,
      _doctor_id: doctorId,
      _password: "smoke-pass-123",
    }),
  );
  assert.match(shareToken, /^[0-9a-f-]{36}$/i);

  const guest = client();
  const anonymous = await checked(
    "anonymous Dr session",
    guest.auth.signInAnonymously({ options: { data: { full_name: "Guest Dr" } } }),
  );
  anonymousId = anonymous.user.id;
  const unlockedId = await checked(
    "unlock shared paper with password",
    guest.rpc("unlock_paper_share", { _token: shareToken, _password: "smoke-pass-123" }),
  );
  assert.equal(unlockedId, paperId);
  await checked(
    "guest reads assigned paper",
    guest.from("papers").select("id,title,status").eq("id", paperId).single(),
  );
  await checked("guest downloads original", guest.storage.from("papers").download(filePath));

  const comment = await checked(
    "guest saves pen mark",
    guest
      .from("comments")
      .insert({
        paper_id: paperId,
        author_id: anonymousId,
        body: "Pen mark",
        mark: "incorrect",
        anchor: {
          type: "pdf",
          page: 1,
          x: 0.1,
          y: 0.1,
          w: 0.2,
          h: 0.2,
          tool: "pen",
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.2 },
          ],
        },
      })
      .select()
      .single(),
  );
  await checked(
    "guest starts review",
    guest.rpc("update_paper_review_status", {
      _paper_id: paperId,
      _status: "under_review",
      _review_cycle: 0,
    }),
  );
  await checked(
    "guest requests changes",
    guest.rpc("update_paper_review_status", {
      _paper_id: paperId,
      _status: "changes_requested",
      _review_cycle: 1,
    }),
  );
  await checked(
    "paper creator starts corrections",
    uploader.rpc("update_paper_review_status", {
      _paper_id: paperId,
      _status: "corrections_in_progress",
      _review_cycle: 1,
    }),
  );
  await checked(
    "paper creator resubmits",
    uploader.rpc("update_paper_review_status", {
      _paper_id: paperId,
      _status: "resubmitted",
      _review_cycle: 1,
    }),
  );
  await checked(
    "guest restarts review",
    guest.rpc("update_paper_review_status", {
      _paper_id: paperId,
      _status: "under_review",
      _review_cycle: 1,
    }),
  );
  await checked(
    "guest approves paper",
    guest.rpc("update_paper_review_status", {
      _paper_id: paperId,
      _status: "approved",
      _review_cycle: 2,
    }),
  );
  await checked(
    "guest undoes own pen mark",
    guest.from("comments").delete().eq("id", comment.id).eq("author_id", anonymousId),
  );

  const finalPaper = await checked(
    "paper creator sees final status",
    uploader.from("papers").select("status,review_cycle").eq("id", paperId).single(),
  );
  assert.deepEqual(finalPaper, { status: "approved", review_cycle: 2 });
  console.log("\nLive smoke test passed.");
} finally {
  if (filePath) await admin.storage.from("papers").remove([filePath]);
  if (paperId) await admin.from("papers").delete().eq("id", paperId);
  if (doctorId) await admin.from("doctors").delete().eq("id", doctorId);
  if (anonymousId) await admin.auth.admin.deleteUser(anonymousId);
  if (uploaderId) await admin.auth.admin.deleteUser(uploaderId);
}
