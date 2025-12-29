import { supabase, supabaseEnabled } from "./supabase";

// Simple client-side "unlock" memory.
// - Stores only that a category was unlocked (not the password).
// - Verification is done via Supabase (RPC preferred; fallback to reading the row).

const STORAGE_KEY = "BAGGO_SECRET_ACCESS_V1";

function loadMap() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function saveMap(map) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
  } catch {
    // ignore
  }
}

export function isCategoryUnlocked(slug) {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return false;
  const map = loadMap();
  return Boolean(map?.[s]?.unlockedAt);
}

export function markCategoryUnlocked(slug) {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return;
  const map = loadMap();
  map[s] = { unlockedAt: new Date().toISOString() };
  saveMap(map);
}

export function clearCategoryUnlock(slug) {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return;
  const map = loadMap();
  delete map[s];
  saveMap(map);
}

export async function verifyCategoryPassword({ slug, password }) {
  const s = String(slug || "").trim().toLowerCase();
  const pw = String(password || "");
  if (!s || !pw) return false;
  if (!supabaseEnabled) return false;

  // Preferred: RPC (keeps the password column out of normal reads)
  try {
    const { data, error } = await supabase.rpc("check_category_password", {
      slug_in: s,
      password_in: pw,
    });
    if (!error) return Boolean(data);
  } catch {
    // fall through
  }

  // Fallback (works if you didn't add the RPC yet)
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("category_type,password")
      .eq("slug", s)
      .maybeSingle();
    if (error) return false;
    if (!data) return false;
    if (String(data.category_type || "normal") !== "secret") return false;
    return String(data.password || "") === pw;
  } catch {
    return false;
  }
}

// Back-compat: supports unlockCategoryWithPassword({ slug, password }) AND unlockCategoryWithPassword(slug, password)
export async function unlockCategoryWithPassword(slugOrObj, maybePassword) {
  const slug = typeof slugOrObj === "object" && slugOrObj !== null ? slugOrObj.slug : slugOrObj;
  const password = typeof slugOrObj === "object" && slugOrObj !== null ? slugOrObj.password : maybePassword;
  const ok = await verifyCategoryPassword({ slug, password });
  if (ok) markCategoryUnlocked(slug);
  return ok;
}
