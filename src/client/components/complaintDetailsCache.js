// Simple in-memory caches for complaint details and signed URLs
const complaintDetailsCache = new Map(); // complaintId -> { data, fetchedAt }
const signedUrlCache = new Map(); // key -> { url, expiresAt }

export async function getComplaintDetails(complaintId) {
  const cached = complaintDetailsCache.get(complaintId);
  if (cached) return cached.data;
  const res = await fetch(`/api/complaints/${complaintId}`);
  if (!res.ok) throw new Error('Failed to load complaint');
  const data = await res.json();
  complaintDetailsCache.set(complaintId, { data, fetchedAt: Date.now() });
  return data;
}

export function clearComplaintDetails(complaintId) {
  complaintDetailsCache.delete(complaintId);
}

export function signedUrlKey(complaintId, filePath) {
  return `${complaintId}:${filePath}`;
}

export async function getSignedUrl(complaintId, filePath) {
  const key = signedUrlKey(complaintId, filePath);
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt && cached.expiresAt > Date.now() + 15000) {
    return cached.url;
  }
  const resp = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(filePath)}`);
  if (!resp.ok) throw new Error('Failed to get signed URL');
  const { url, expiresAt } = await resp.json();
  signedUrlCache.set(key, { url, expiresAt });
  return url;
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B','KB','MB','GB'];
  let i = 0; let num = bytes;
  while (num >= 1024 && i < units.length - 1) { num /= 1024; i++; }
  return `${num.toFixed(1)} ${units[i]}`;
}

