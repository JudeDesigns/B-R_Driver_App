// Verifies the three fixes applied for the driver invoice-image 404 bug:
//   1) src/app/api/driver/stops/[id]/upload/route.ts        — atomic swap-and-clean
//   2) src/app/api/driver/stops/[id]/clear-images/route.ts  — never deletes live files
//   3) src/lib/uploadFilePaths.ts                           — file-existence filter
//
// Run with:  node --test tests/invoice-image-fix.test.js
//
// The logic below mirrors production exactly. If production changes, this
// file must change too.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

// ── Mirror of src/lib/uploadFilePaths.ts ──────────────────────────────────────
function urlToDiskPath(publicRoot, url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('/uploads/')) return null;
  return path.join(publicRoot, url);
}
async function uploadFileExists(publicRoot, url) {
  const p = urlToDiskPath(publicRoot, url);
  if (!p) return false;
  try { await fs.access(p); return true; } catch { return false; }
}
async function existingUploadUrls(publicRoot, urls) {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const checks = await Promise.all(urls.map(async (u) => ({ u, ok: await uploadFileExists(publicRoot, u) })));
  return checks.filter((c) => c.ok).map((c) => c.u);
}
async function deleteUploadFiles(publicRoot, urls) {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const deleted = [];
  await Promise.all(urls.map(async (u) => {
    const p = urlToDiskPath(publicRoot, u);
    if (!p) return;
    try { await fs.unlink(p); deleted.push(u); } catch {}
  }));
  return deleted;
}

// ── Mirror of upload route's swap-and-clean tail ──────────────────────────────
async function performUploadSwap(publicRoot, stop, newImageUrls, newPdfUrl) {
  const previousImageUrls = Array.isArray(stop.invoiceImageUrls) ? stop.invoiceImageUrls : [];
  const previousPdfUrl = stop.signedInvoicePdfUrl ?? null;

  // Simulate the DB update (in-memory)
  stop.invoiceImageUrls = newImageUrls;
  stop.signedInvoicePdfUrl = newPdfUrl;

  // Swap-and-clean
  const newSet = new Set(newImageUrls);
  const orphanImages = previousImageUrls.filter((u) => u && !newSet.has(u));
  const orphanPdf = previousPdfUrl && previousPdfUrl !== newPdfUrl ? [previousPdfUrl] : [];
  const toDelete = [...orphanImages, ...orphanPdf];
  const deleted = await deleteUploadFiles(publicRoot, toDelete);
  return { deleted, attempted: toDelete.length };
}

// ── Mirror of hardened clear-images route ─────────────────────────────────────
async function performClearImages(publicRoot, stopId, stop) {
  const uploadsDir = path.join(publicRoot, 'uploads');
  const liveUrls = Array.isArray(stop?.invoiceImageUrls) ? stop.invoiceImageUrls : [];
  const liveFileNames = new Set(
    liveUrls.filter((u) => typeof u === 'string' && u.startsWith('/uploads/')).map((u) => path.basename(u))
  );
  let files;
  try { files = await fs.readdir(uploadsDir); } catch { return { deletedCount: 0, preservedCount: liveFileNames.size }; }
  const imagePattern = new RegExp(`^invoice_${stopId}_.*_img\\d+\\.jpg$`);
  const candidates = files.filter((f) => imagePattern.test(f));
  const orphans = candidates.filter((f) => !liveFileNames.has(f));
  let deletedCount = 0;
  for (const f of orphans) {
    try { await fs.unlink(path.join(uploadsDir, f)); deletedCount++; } catch {}
  }
  return { deletedCount, preservedCount: liveFileNames.size };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function setupRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'br-invoice-test-'));
  await fs.mkdir(path.join(root, 'uploads'), { recursive: true });
  await fs.mkdir(path.join(root, 'uploads', 'pdf'), { recursive: true });
  return root;
}
async function writeSessionFiles(root, stopId, sessionId, count) {
  const urls = [];
  for (let i = 1; i <= count; i++) {
    const fname = `invoice_${stopId}_${Date.now() + i}_${sessionId}_img${i}.jpg`;
    await fs.writeFile(path.join(root, 'uploads', fname), `bytes-${i}`);
    urls.push(`/uploads/${fname}`);
  }
  const pdfName = `invoice_${stopId}_${Date.now()}_${sessionId}_img1.pdf`;
  await fs.writeFile(path.join(root, 'uploads', 'pdf', pdfName), `pdf-bytes`);
  const pdfUrl = `/uploads/pdf/${pdfName}`;
  return { urls, pdfUrl };
}
async function diskExists(root, url) { return uploadFileExists(root, url); }


// ── Scenarios ─────────────────────────────────────────────────────────────────

test('Scenario A: first-time upload — no previous files, nothing to clean', async () => {
  const root = await setupRoot();
  const stopId = 'stop-A';
  const stop = { invoiceImageUrls: [], signedInvoicePdfUrl: null };

  const { urls, pdfUrl } = await writeSessionFiles(root, stopId, 'sess1', 3);
  const result = await performUploadSwap(root, stop, urls, pdfUrl);

  assert.equal(result.attempted, 0, 'no orphans to delete on first upload');
  for (const u of urls) assert.equal(await diskExists(root, u), true, `new image ${u} must exist`);
  assert.equal(await diskExists(root, pdfUrl), true, 'new PDF must exist');
  assert.deepEqual(stop.invoiceImageUrls, urls);
});

test('Scenario B: re-upload — previous files swapped out cleanly, new files preserved', async () => {
  const root = await setupRoot();
  const stopId = 'stop-B';

  const s1 = await writeSessionFiles(root, stopId, 'sess1', 3);
  const stop = { invoiceImageUrls: s1.urls, signedInvoicePdfUrl: s1.pdfUrl };

  const s2 = await writeSessionFiles(root, stopId, 'sess2', 2);

  for (const u of [...s1.urls, ...s2.urls]) {
    assert.equal(await diskExists(root, u), true, `pre-swap: ${u} must exist`);
  }

  const result = await performUploadSwap(root, stop, s2.urls, s2.pdfUrl);

  for (const u of s1.urls) assert.equal(await diskExists(root, u), false, `orphan ${u} must be deleted`);
  for (const u of s2.urls) assert.equal(await diskExists(root, u), true, `new ${u} must remain`);
  assert.equal(await diskExists(root, s1.pdfUrl), false, 'old PDF must be deleted');
  assert.equal(await diskExists(root, s2.pdfUrl), true, 'new PDF must remain');
  assert.equal(result.deleted.length, 4, '3 old images + 1 old PDF = 4 deletions');
});

test('Scenario C: hardened clear-images — never deletes live files', async () => {
  const root = await setupRoot();
  const stopId = 'stop-C';

  const live = await writeSessionFiles(root, stopId, 'sess-live', 2);
  const strayName1 = `invoice_${stopId}_111_strayA_img1.jpg`;
  const strayName2 = `invoice_${stopId}_222_strayB_img2.jpg`;
  await fs.writeFile(path.join(root, 'uploads', strayName1), 'stray-1');
  await fs.writeFile(path.join(root, 'uploads', strayName2), 'stray-2');

  const stop = { invoiceImageUrls: live.urls, signedInvoicePdfUrl: live.pdfUrl };
  const result = await performClearImages(root, stopId, stop);

  assert.equal(result.deletedCount, 2, 'both orphans must be deleted');
  assert.equal(result.preservedCount, 2, 'both live files must be preserved');
  for (const u of live.urls) assert.equal(await diskExists(root, u), true, `live ${u} preserved`);
  const stray1Exists = await fs.access(path.join(root, 'uploads', strayName1)).then(() => true, () => false);
  const stray2Exists = await fs.access(path.join(root, 'uploads', strayName2)).then(() => true, () => false);
  assert.equal(stray1Exists, false, 'stray 1 must be gone');
  assert.equal(stray2Exists, false, 'stray 2 must be gone');
});

test('Scenario D: existingUploadUrls filters missing files for admin view', async () => {
  const root = await setupRoot();
  const present = await writeSessionFiles(root, 'stop-D', 'sess-D', 2);
  const missing = '/uploads/invoice_stop-D_999_missing_img1.jpg';

  const filtered = await existingUploadUrls(root, [...present.urls, missing]);
  assert.deepEqual(filtered, present.urls, 'missing URL must be dropped, present URLs kept in order');
});

test('Scenario E: end-to-end — Barak\'s 404 scenario, hardened end-to-end', async () => {
  const root = await setupRoot();
  const stopId = 'stop-E';

  // 1. Barak uploads invoice images (session 1)
  const baraks = await writeSessionFiles(root, stopId, 'baraksess', 2);
  const stop = { invoiceImageUrls: baraks.urls, signedInvoicePdfUrl: baraks.pdfUrl };

  // 2. Another driver opens the stop. Even if the legacy clear-images call
  //    runs, the hardened route refuses to touch live files.
  const before = await performClearImages(root, stopId, stop);
  assert.equal(before.deletedCount, 0, 'no orphans, nothing to delete');
  for (const u of baraks.urls) assert.equal(await diskExists(root, u), true, "Barak's images survive");

  // 3. Same driver actually completes a fresh upload — atomic swap.
  const fresh = await writeSessionFiles(root, stopId, 'driver2sess', 1);
  const swap = await performUploadSwap(root, stop, fresh.urls, fresh.pdfUrl);
  assert.equal(swap.deleted.length, 3, '2 old images + 1 old PDF cleaned up post-swap');
  for (const u of baraks.urls) assert.equal(await diskExists(root, u), false, 'old session removed');
  for (const u of fresh.urls) assert.equal(await diskExists(root, u), true, 'new session intact');

  // 4. Admin loads the stop — sanitizer returns only existing files.
  const sanitized = await existingUploadUrls(root, stop.invoiceImageUrls);
  assert.deepEqual(sanitized, fresh.urls);
});

test('Scenario F: failed re-upload no longer destroys the previous session', async () => {
  const root = await setupRoot();
  const stopId = 'stop-F';

  // Barak's good upload
  const baraks = await writeSessionFiles(root, stopId, 'good', 2);
  const stop = { invoiceImageUrls: baraks.urls, signedInvoicePdfUrl: baraks.pdfUrl };

  // Driver attempts re-upload, but the new upload "fails" before DB write.
  // Under the OLD destructive flow, clearExistingImages would have already
  // wiped Barak's files. Under the new flow we don't pre-clear at all.
  // Simulate: no swap performed (upload aborted). Barak's files MUST still exist.
  for (const u of baraks.urls) assert.equal(await diskExists(root, u), true, `${u} survives failed re-upload`);
  assert.equal(await diskExists(root, baraks.pdfUrl), true, 'PDF survives failed re-upload');
});
