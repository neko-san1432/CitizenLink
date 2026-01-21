/**
 * Verify if session is persisted on server
 * @returns {Promise<boolean>}
 */
export async function verifySessionPersistence() {
  for (let i = 0; i < 2; i++) {
    try {
      const { ok: checkOk } = await fetch("/api/user/role", {
        method: "GET",
      });
      if (checkOk) return true;
    } catch (e) {
      console.error(`[SUCCESS] Role check attempt ${i + 1} failed:`, e);
    }
    if (i === 0)
      await new Promise((r) => {
        setTimeout(r, 300);
      });
  }
  return false;
}

/**
 * Cleanup server session
 */
export async function clearServerSession() {
  console.log(
    "[SUCCESS] Clearing server session cookie (keeping Supabase session)"
  );
  try {
    await fetch("/auth/session", { method: "DELETE" });
  } catch (err) {
    console.warn("[SUCCESS] Error clearing server session:", err);
  }
}
