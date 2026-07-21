import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const playlistCoverBucket = "playlist-covers";
export const maxPlaylistCoverBytes = 1_500_000;

const supportedCoverTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function requireAdmin() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin is not configured.");
  return admin;
}

async function ensurePlaylistCoverBucket() {
  const admin = requireAdmin();
  const { data: bucket } = await admin.storage.getBucket(playlistCoverBucket);

  if (!bucket) {
    const { error } = await admin.storage.createBucket(playlistCoverBucket, {
      public: true,
      fileSizeLimit: maxPlaylistCoverBytes,
      allowedMimeTypes: [...supportedCoverTypes],
    });
    if (error && !error.message.toLowerCase().includes("already exists")) throw error;
    return;
  }

  if (!bucket.public) {
    const { error } = await admin.storage.updateBucket(playlistCoverBucket, {
      public: true,
      fileSizeLimit: maxPlaylistCoverBytes,
      allowedMimeTypes: [...supportedCoverTypes],
    });
    if (error) throw error;
  }
}

function hasValidSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  return (
    contentType === "image/webp" &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

function extensionFor(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function parseStoredPlaylistCover(value: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const candidate = new URL(value);
    const base = new URL(supabaseUrl);
    const marker = `/storage/v1/object/public/${playlistCoverBucket}/`;
    if (candidate.origin !== base.origin || !candidate.pathname.startsWith(marker)) return null;
    return decodeURIComponent(candidate.pathname.slice(marker.length));
  } catch {
    return null;
  }
}

export function isStoredPlaylistCoverUrl(
  value: string,
  owner?: { playlistId: string; userId: string },
) {
  const path = parseStoredPlaylistCover(value);
  if (!path) return false;
  return owner ? path.startsWith(`${owner.userId}/${owner.playlistId}/`) : true;
}

function storedCoverPath(
  value: string | null | undefined,
  owner: { playlistId: string; userId: string },
) {
  if (!value || !isStoredPlaylistCoverUrl(value, owner)) return null;
  return parseStoredPlaylistCover(value);
}

export async function uploadPlaylistCover(
  userId: string,
  playlistId: string,
  file: File,
) {
  if (!supportedCoverTypes.has(file.type)) {
    throw new Error("Cover must be a JPG, PNG, or WebP image.");
  }
  if (file.size <= 0 || file.size > maxPlaylistCoverBytes) {
    throw new Error("Cover must be smaller than 1.5 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidSignature(bytes, file.type)) {
    throw new Error("The uploaded cover is not a valid image.");
  }

  await ensurePlaylistCoverBucket();
  const admin = requireAdmin();
  const path = `${userId}/${playlistId}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const { error } = await admin.storage.from(playlistCoverBucket).upload(path, bytes, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = admin.storage.from(playlistCoverBucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function removeStoredPlaylistCover(
  value: string | null | undefined,
  owner: { playlistId: string; userId: string },
) {
  const path = storedCoverPath(value, owner);
  if (!path) return;
  const admin = requireAdmin();
  const { error } = await admin.storage.from(playlistCoverBucket).remove([path]);
  if (error) throw error;
}
