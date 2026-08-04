// Swappable private storage for sensitive KYC documents (government ID scans).
//
// Documents must never be publicly reachable. This interface lets a real
// private bucket (e.g. Supabase Storage private bucket, S3 with no public ACL)
// replace the dev implementation without touching call sites. The dev
// implementation writes to a local directory OUTSIDE the Next.js `public/`
// web root so files are never served over HTTP.
//
// Retention: once verification passes (or is rejected) the raw document is
// deleted via `deleteDocument` and the DB row's storagePath is cleared.

import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

export interface PrivateStorage {
  readonly name: string;
  // Stores bytes privately, returns an opaque storage path (never a public URL).
  put(bytes: Buffer, ext: string): Promise<string>;
  // Deletes the object. Safe to call on an already-deleted path.
  delete(storagePath: string): Promise<void>;
  // Reads bytes back for an authenticated Admin review view.
  get(storagePath: string): Promise<Buffer>;
}

// Local private directory. Defaults to a path outside `public/`. Configurable
// via KYC_PRIVATE_DIR so a deployment can point it at a non-web-served volume.
const PRIVATE_DIR =
  process.env.KYC_PRIVATE_DIR || path.join(process.cwd(), ".private", "id-docs");

class LocalPrivateStorage implements PrivateStorage {
  readonly name = "local";
  async put(bytes: Buffer, ext: string): Promise<string> {
    await mkdir(PRIVATE_DIR, { recursive: true });
    const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
    const filename = `${randomUUID()}.${safeExt}`;
    await writeFile(path.join(PRIVATE_DIR, filename), bytes);
    // Store only the filename; the private dir is resolved server-side.
    return filename;
  }
  async delete(storagePath: string): Promise<void> {
    try {
      await unlink(path.join(PRIVATE_DIR, path.basename(storagePath)));
    } catch {
      // already gone — deletion is idempotent
    }
  }
  async get(storagePath: string): Promise<Buffer> {
    return readFile(path.join(PRIVATE_DIR, path.basename(storagePath)));
  }
}

export function getPrivateStorage(): PrivateStorage {
  switch (process.env.KYC_STORAGE) {
    // case "supabase": return new SupabasePrivateStorage(...);
    default:
      return new LocalPrivateStorage();
  }
}
