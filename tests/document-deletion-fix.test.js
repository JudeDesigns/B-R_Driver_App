// Verifies the two fixes applied to:
//   1) src/app/api/admin/documents/[id]/route.ts  — refcount guard on unlink
//   2) src/lib/fileManager.ts                     — disk-existence check in findDuplicate
//
// Run with:  node --test tests/document-deletion-fix.test.js
//
// This file deliberately replicates the production logic in self-contained
// functions so it can run without a database or HTTP server. The logic below
// is a 1:1 mirror of the code in the two files above — if production changes,
// this file must change too.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

// ── In-memory Prisma mock ──────────────────────────────────────────────────
const db = { files: [], documents: [] };
const prismaMock = {
  file: {
    findFirst: async ({ where, orderBy }) => {
      let rows = db.files.filter((r) => {
        if (where.checksum && r.checksum !== where.checksum) return false;
        if (where.isArchived !== undefined && r.isArchived !== where.isArchived) return false;
        return true;
      });
      if (orderBy?.createdAt === 'desc') rows.sort((a, b) => b.createdAt - a.createdAt);
      return rows[0] || null;
    },
    update: async ({ where, data }) => {
      const row = db.files.find((r) => r.id === where.id);
      Object.assign(row, data);
      return row;
    },
    create: async ({ data }) => {
      const row = { id: crypto.randomUUID(), createdAt: new Date(), isArchived: false, ...data };
      db.files.push(row);
      return row;
    },
  },
  document: {
    count: async ({ where }) => db.documents.filter((r) => {
      if (where.filePath && r.filePath !== where.filePath) return false;
      if (where.isDeleted !== undefined && r.isDeleted !== where.isDeleted) return false;
      if (where.id?.not && r.id === where.id.not) return false;
      return true;
    }).length,
    update: async ({ where, data }) => {
      const row = db.documents.find((r) => r.id === where.id);
      Object.assign(row, data);
      return row;
    },
    create: async ({ data }) => {
      const row = { id: crypto.randomUUID(), isDeleted: false, ...data };
      db.documents.push(row);
      return row;
    },
  },
};

// ── Mirror of findDuplicate (src/lib/fileManager.ts) ───────────────────────
async function findDuplicate(checksum, publicRoot) {
  const existing = await prismaMock.file.findFirst({
    where: { checksum, isArchived: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!existing) return null;
  if (!existing.filePath.startsWith('/uploads/')) return null;

  const diskPath = path.join(publicRoot, existing.filePath);
  try {
    await fs.access(diskPath);
  } catch {
    try {
      await prismaMock.file.update({
        where: { id: existing.id },
        data: { isArchived: true, archivedAt: new Date() },
      });
    } catch {}
    return null;
  }
  return existing;
}

// ── Mirror of uploadFile dedup-then-write flow ─────────────────────────────
async function uploadFile(buffer, originalName, publicRoot) {
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const existing = await findDuplicate(checksum, publicRoot);
  if (existing) return existing;
  const storedName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const relPath = `/uploads/documents/${storedName}`;
  const fullPath = path.join(publicRoot, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  // tiny delay so createdAt timestamps are strictly ordered across rows
  await new Promise((r) => setTimeout(r, 5));
  return prismaMock.file.create({
    data: { originalName, storedName, filePath: relPath, checksum, fileSize: buffer.length },
  });
}

// ── Mirror of DELETE handler unlink guard (admin/documents/[id]/route.ts) ──
async function deleteDocument(id, publicRoot) {
  const doc = db.documents.find((d) => d.id === id && !d.isDeleted);
  if (!doc) return { ok: false, reason: 'not_found' };
  await prismaMock.document.update({ where: { id }, data: { isDeleted: true } });

  let unlinked = false;
  try {
    const otherRefs = await prismaMock.document.count({
      where: { filePath: doc.filePath, isDeleted: false, id: { not: id } },
    });
    if (otherRefs === 0) {
      const fullPath = path.join(publicRoot, doc.filePath);
      try {
        await fs.unlink(fullPath);
        unlinked = true;
      } catch {}
    }
  } catch {}
  return { ok: true, unlinked };
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function setupTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'br-fix-test-'));
  return root;
}
async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}
function resetDb() { db.files.length = 0; db.documents.length = 0; }


// ── Scenarios ─────────────────────────────────────────────────────────────────

test('Scenario 1: unique file, single Document — delete unlinks the disk file', async () => {
  resetDb();
  const root = await setupTempRoot();
  const upload = await uploadFile(Buffer.from('unique-pdf-bytes-1'), 'invoice.pdf', root);
  const doc = await prismaMock.document.create({ data: { filePath: upload.filePath } });

  assert.equal(await fileExists(path.join(root, upload.filePath)), true, 'file should exist before delete');
  const result = await deleteDocument(doc.id, root);
  assert.equal(result.ok, true);
  assert.equal(result.unlinked, true, 'unique file must be unlinked');
  assert.equal(await fileExists(path.join(root, upload.filePath)), false, 'disk file should be gone');
});

test('Scenario 2: shared file across 7 customers — deleting 1 keeps disk file', async () => {
  resetDb();
  const root = await setupTempRoot();
  const upload = await uploadFile(Buffer.from('holiday-flyer-bytes'), 'Holiday Flyer.pdf', root);

  const docs = [];
  for (let i = 0; i < 7; i++) {
    docs.push(await prismaMock.document.create({ data: { filePath: upload.filePath } }));
  }

  const result = await deleteDocument(docs[0].id, root);
  assert.equal(result.unlinked, false, 'unlink must be skipped while 6 siblings still reference the file');
  assert.equal(await fileExists(path.join(root, upload.filePath)), true, 'shared file must remain on disk');

  for (let i = 1; i < 7; i++) {
    assert.equal(db.documents.find((d) => d.id === docs[i].id).isDeleted, false);
  }
});

test('Scenario 3: delete all 7 sharers — last delete unlinks; file gone', async () => {
  resetDb();
  const root = await setupTempRoot();
  const upload = await uploadFile(Buffer.from('holiday-flyer-bytes-2'), 'Holiday Flyer.pdf', root);
  const docs = [];
  for (let i = 0; i < 7; i++) {
    docs.push(await prismaMock.document.create({ data: { filePath: upload.filePath } }));
  }

  for (let i = 0; i < 6; i++) {
    const r = await deleteDocument(docs[i].id, root);
    assert.equal(r.unlinked, false, `delete #${i + 1} must not unlink`);
  }
  const last = await deleteDocument(docs[6].id, root);
  assert.equal(last.unlinked, true, 'final delete unlinks the file');
  assert.equal(await fileExists(path.join(root, upload.filePath)), false);
});

test('Scenario 4: findDuplicate against orphan record archives it and returns null', async () => {
  resetDb();
  const root = await setupTempRoot();
  const orphan = await prismaMock.file.create({
    data: {
      originalName: 'Holiday Flyer.pdf',
      storedName: '1_orphan.pdf',
      filePath: '/uploads/documents/1_orphan.pdf',
      checksum: 'orphan-checksum',
      fileSize: 100,
    },
  });

  const result = await findDuplicate('orphan-checksum', root);
  assert.equal(result, null, 'orphan must not be returned as a duplicate');
  assert.equal(db.files.find((f) => f.id === orphan.id).isArchived, true, 'orphan row must be archived');
});

test('Scenario 5: end-to-end recovery — re-upload same PDF after orphan, then dedup uses new record', async () => {
  resetDb();
  const root = await setupTempRoot();
  const bytes = Buffer.from('holiday-flyer-recovery-bytes');
  const checksum = crypto.createHash('sha256').update(bytes).digest('hex');

  await prismaMock.file.create({
    data: {
      originalName: 'Holiday Flyer.pdf',
      storedName: 'old_broken.pdf',
      filePath: '/uploads/documents/old_broken.pdf',
      checksum,
      fileSize: bytes.length,
    },
  });
  assert.equal(await fileExists(path.join(root, '/uploads/documents/old_broken.pdf')), false);

  const upload1 = await uploadFile(bytes, 'Holiday Flyer.pdf', root);
  assert.notEqual(upload1.filePath, '/uploads/documents/old_broken.pdf', 'must NOT reuse the broken path');
  assert.equal(await fileExists(path.join(root, upload1.filePath)), true, 'fresh file must exist on disk');
  assert.equal(db.files.find((f) => f.filePath === '/uploads/documents/old_broken.pdf').isArchived, true);

  for (let i = 0; i < 6; i++) {
    const upload = await uploadFile(bytes, 'Holiday Flyer.pdf', root);
    assert.equal(upload.filePath, upload1.filePath, `iteration ${i + 2} must dedup onto the new fresh file`);
  }
  const live = db.files.filter((f) => f.checksum === checksum && !f.isArchived);
  assert.equal(live.length, 1, 'exactly one live File row should exist for the checksum');
});

test('Scenario 6: normal dedup still works (valid record + existing disk file)', async () => {
  resetDb();
  const root = await setupTempRoot();
  const bytes = Buffer.from('reused-content');
  const first = await uploadFile(bytes, 'doc.pdf', root);
  const second = await uploadFile(bytes, 'doc.pdf', root);
  assert.equal(second.filePath, first.filePath, 'dedup must reuse the existing valid file');
  assert.equal(db.files.length, 1, 'no extra File row should be created');
});
