"use client";

export type CachedCheckedMeme = { receipt: string; snapshot: string; roast: string };
const database = "checked-meme-cache";
const store = "results";
const key = (userId: string) => `checked:meme:${userId}`;
function valid(value: unknown): value is CachedCheckedMeme {
  const item = value as CachedCheckedMeme | null;
  return !!item && typeof item.receipt === "string" && typeof item.snapshot === "string" && item.snapshot.length > 0 && typeof item.roast === "string";
}
async function access(userId: string, value?: CachedCheckedMeme): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Cache unavailable"));
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(store, value ? "readwrite" : "readonly");
      const request = value ? transaction.objectStore(store).put(value, userId) : transaction.objectStore(store).get(userId);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
export async function readCheckedMeme(userId: string): Promise<CachedCheckedMeme | null> {
  try {
    const value = await access(userId);
    return valid(value) ? value : null;
  } catch {
    try { const value = JSON.parse(window.sessionStorage.getItem(key(userId)) ?? "null"); return valid(value) ? value : null; } catch { return null; }
  }
}
export async function saveCheckedMeme(userId: string, value: CachedCheckedMeme) {
  // IndexedDB accommodates full-resolution results beyond Web Storage's quota.
  try { await access(userId, value); }
  catch { try { window.sessionStorage.setItem(key(userId), JSON.stringify(value)); } catch { /* Keep the live result if browser storage is unavailable. */ } }
}
