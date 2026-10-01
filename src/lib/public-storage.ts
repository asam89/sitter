// Swappable storage for PUBLIC assets (e.g. sitter profile photos).
//
// Unlike the private KYC storage, these objects are meant to be served to
// visitors — but they are still not written into the Next.js `public/` web
// root (which is baked into the image at build time and would not persist
// runtime uploads across container rebuilds). Instead they live in a
// configurable directory (PUBLIC_UPLOAD_DIR) that a deployment points at a
// persistent volume, and are streamed out through an app route with public
// cache headers. A real object store (S3/Supabase public bucket) can replace
// this without touching call sites.

import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

export interface PublicStorage {
  readonly name: string;
  // Stores bytes and returns an opaque storage path (a filename, not a URL).
  put(bytes: Buffer, ext: string): Promise<string>;
  // Deletes the object. Safe to call on an already-deleted path.
  delete(storagePath: string): Promise<void>;
  // Reads bytes back so an app route can stream them with cache headers.
  get(storagePath: string): Promise<Buffer>;
}

// Defaults to a path outside `public/`. Configurable via PUBLIC_UPLOAD_DIR so a
// deployment can point it at a mounted, persistent volume.
const PUBLIC_DIR =
  process.env.PUBLIC_UPLOAD_DIR || path.join(process.cwd(), ".uploads", "public");

class LocalPublicStorage implements PublicStorage {
  readonly name = "local";
  async put(bytes: Buffer, ext: string): Promise<string> {
    await mkdir(PUBLIC_DIR, { recursive: true });
    const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
    const filename = `${randomUUID()}.${safeExt}`;
    await writeFile(path.join(PUBLIC_DIR, filename), bytes);
    return filename;
  }
  async delete(storagePath: string): Promise<void> {
    try {
      await unlink(path.join(PUBLIC_DIR, path.basename(storagePath)));
    } catch {
      // already gone — deletion is idempotent
    }
  }
  async get(storagePath: string): Promise<Buffer> {
    return readFile(path.join(PUBLIC_DIR, path.basename(storagePath)));
  }
}

export function getPublicStorage(): PublicStorage {
  switch (process.env.PUBLIC_STORAGE) {
    // case "supabase": return new SupabasePublicStorage(...);
    default:
      return new LocalPublicStorage();
  }
}
