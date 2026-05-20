import fs from "fs/promises";
import path from "path";

// Public uploads root — files under /uploads/<...> on the web map 1:1 to
// public/uploads/<...> on disk, served either by Next.js or, in production,
// directly by nginx.
const PUBLIC_ROOT = path.join(process.cwd(), "public");

/**
 * Convert a public URL like "/uploads/foo.jpg" to an absolute disk path.
 * Returns null for URLs that don't live under /uploads/ (defensive — we never
 * want to translate arbitrary paths to filesystem paths).
 */
export function urlToDiskPath(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith("/uploads/")) return null;
  return path.join(PUBLIC_ROOT, url);
}

/**
 * Returns true if the file backing a /uploads/... URL exists on disk.
 * Any non-/uploads/ URL returns false (we can't verify external URLs here).
 */
export async function uploadFileExists(url: string): Promise<boolean> {
  const diskPath = urlToDiskPath(url);
  if (!diskPath) return false;
  try {
    await fs.access(diskPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Filter an array of /uploads/... URLs down to only those whose files
 * currently exist on disk. Used by admin-facing endpoints and email/PDF
 * generators so that orphaned URLs (e.g. files deleted by a stale cleanup)
 * never get surfaced to customers.
 *
 * Preserves input order. Non-string / falsy entries are dropped.
 */
export async function existingUploadUrls(urls: ReadonlyArray<string>): Promise<string[]> {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const checks = await Promise.all(
    urls.map(async (url) => ({ url, ok: await uploadFileExists(url) }))
  );
  return checks.filter((c) => c.ok).map((c) => c.url);
}

/**
 * Best-effort delete of files backing /uploads/... URLs. Missing files and
 * non-/uploads/ URLs are silently skipped (this is used in cleanup paths
 * where the goal is "make sure these are gone" — already-gone is success).
 * Returns the list of URLs whose files were successfully unlinked.
 */
export async function deleteUploadFiles(urls: ReadonlyArray<string>): Promise<string[]> {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const deleted: string[] = [];
  await Promise.all(
    urls.map(async (url) => {
      const diskPath = urlToDiskPath(url);
      if (!diskPath) return;
      try {
        await fs.unlink(diskPath);
        deleted.push(url);
      } catch {
        // Already gone or unreadable — treat as success for cleanup purposes.
      }
    })
  );
  return deleted;
}
