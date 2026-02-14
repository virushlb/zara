import { supabase, supabaseEnabled } from "./supabase";

const LOCAL_KEY = "BAGGO_ORDERS_LOCAL_V1";

// Generate a UUID in the browser so we don't need to `select()` after insert.
// This avoids issues when public/anon users are allowed to INSERT orders but are not allowed to SELECT orders.
function uuidv4() {
  // Modern browsers
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();

  // Very old browsers (or non-browser runtimes)
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  // Fallback (RFC4122-ish)
  // eslint-disable-next-line no-bitwise
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // eslint-disable-next-line no-bitwise
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  // eslint-disable-next-line no-bitwise
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") || [];
  } catch {
    return [];
  }
}

function writeLocal(rows) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows || []));
  } catch {
    // ignore
  }
}

export async function createOrder(payload) {
  const clean = payload && typeof payload === "object" ? payload : {};

  const orderId = uuidv4();

  if (!supabaseEnabled) {
    const id = orderId;
    const next = {
      id,
      status: clean.status || "new",
      customer: clean.customer || {},
      items: Array.isArray(clean.items) ? clean.items : [],
      promo_code: clean.promo_code || null,
      delivery_method: clean.delivery_method || null,
      notes: clean.notes || "",
      subtotal: Number(clean.subtotal || 0),
      discount: Number(clean.discount || 0),
      shipping: Number(clean.shipping || 0),
      total: Number(clean.total || 0),
      created_at: new Date().toISOString(),
    };
    const rows = [next, ...readLocal()];
    writeLocal(rows);
    return { ok: true, id, local: true };
  }

  try {
    const { error } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        status: clean.status || "new",
        customer: clean.customer || {},
        items: Array.isArray(clean.items) ? clean.items : [],
        promo_code: clean.promo_code || null,
        delivery_method: clean.delivery_method || null,
        notes: clean.notes || "",
        subtotal: Number(clean.subtotal || 0),
        discount: Number(clean.discount || 0),
        shipping: Number(clean.shipping || 0),
        total: Number(clean.total || 0),
      });

    if (error) throw error;
    return { ok: true, id: orderId };
  } catch (e) {
    // IMPORTANT: keep returning an error message so the caller can show it.
    // Also log once so it's visible in production logs (Vercel browser logs / Sentry etc).
    // eslint-disable-next-line no-console
    console.error("createOrder failed", e);
    return { ok: false, error: e?.message || "Failed to create order" };
  }
}

export async function fetchOrders() {
  if (!supabaseEnabled) {
    return { ok: true, orders: readLocal(), local: true };
  }

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { ok: true, orders: Array.isArray(data) ? data : [] };
  } catch (e) {
    return { ok: false, error: e?.message || "Failed to load orders", orders: [] };
  }
}

export async function updateOrderStatus(id, status) {
  if (!supabaseEnabled) {
    const rows = readLocal();
    const next = rows.map((o) => (String(o.id) === String(id) ? { ...o, status } : o));
    writeLocal(next);
    return { ok: true, local: true };
  }

  try {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || "Failed to update order" };
  }
}

export async function deleteOrder(id) {
  if (!supabaseEnabled) {
    const rows = readLocal().filter((o) => String(o.id) !== String(id));
    writeLocal(rows);
    return { ok: true, local: true };
  }
  try {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || "Failed to delete order" };
  }
}
