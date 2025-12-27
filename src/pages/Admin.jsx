import { useEffect, useMemo, useState } from "react";
import Container from "../layout/Container";
import { useStore } from "../context/StoreContext";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { fetchOrders, updateOrderStatus, deleteOrder } from "../lib/orders";
import { fetchShippingSettings, saveShippingSettings } from "../lib/shipping";
import Modal from "../components/Modal";
import SafeImage from "../components/SafeImage";
import { listStockEntries, isPerImageStock } from "../lib/stock";

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm border transition ${
        active
          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
          : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <div className="flex items-end justify-between gap-4">
        <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
        {hint ? <span className="text-xs text-[var(--color-text-muted)]">{hint}</span> : null}
      </div>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
        props.className || ""
      }`}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
        props.className || ""
      }`}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
        props.className || ""
      }`}
    />
  );
}

export default function Admin() {
  const {
    settings,
    banner,
    hero,
    categories,
    products,
    setSettings,
    setBanner,
    setHero,
    saveSettingsNow,
    upsertCategory,
    deleteCategory,
    upsertProduct,
    deleteProduct,
    resetStore,
    supabaseEnabled: storeSupabaseEnabled,
  } = useStore();

  const cloudMode = supabaseEnabled && storeSupabaseEnabled;
  const storageBucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || "products";

  const MAX_IMAGES = 10;

  const [tab, setTab] = useState("products");
  const [catDraft, setCatDraft] = useState({ label: "", slug: "" });

  // Image helper (adds a single image URL line to the textarea)
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [imageFilesDraft, setImageFilesDraft] = useState([]);
  const [imageBusy, setImageBusy] = useState(false);

  // Promo codes (optional table)
  const [promoDraft, setPromoDraft] = useState({ code: "", type: "percent", value: 10, active: true });
  const [promoCodes, setPromoCodes] = useState([]);
  const [promoError, setPromoError] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);

  // Orders
  const [orders, setOrders] = useState([]);
  const [ordersBusy, setOrdersBusy] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  // Advanced orders UI
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderTimeFilter, setOrderTimeFilter] = useState("all"); // all | today | week | month
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: "", message: "", onConfirm: null });

  // Inventory (low stock)
  const [stockThreshold, setStockThreshold] = useState(3);

  // Delivery / shipping settings
  const [shipDraft, setShipDraft] = useState({ methods: [], free_threshold: "" });
  const [shipBusy, setShipBusy] = useState(false);
  const [shipMsg, setShipMsg] = useState("");

  // Website save button status
  const [websiteSaveMsg, setWebsiteSaveMsg] = useState("");
  const [websiteSaving, setWebsiteSaving] = useState(false);

  const ordersStatusCounts = useMemo(() => {
    const counts = { all: 0, new: 0, preparing: 0, delivered: 0, canceled: 0 };
    (orders || []).forEach((o) => {
      counts.all += 1;
      const s = String(o.status || "new");
      if (counts[s] !== undefined) counts[s] += 1;
    });
    return counts;
  }, [orders]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return (orders || []).find((o) => String(o.id) === String(selectedOrderId)) || null;
  }, [orders, selectedOrderId]);

  const filteredOrders = useMemo(() => {
    const q = String(orderQuery || "").trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return (orders || []).filter((o) => {
      if (orderStatusFilter !== "all" && String(o.status || "new") !== orderStatusFilter) return false;

      if (orderTimeFilter !== "all") {
        const t = o.created_at ? new Date(o.created_at).getTime() : 0;
        if (orderTimeFilter === "today" && t < startOfToday) return false;
        if (orderTimeFilter === "week" && t < startOfWeek) return false;
        if (orderTimeFilter === "month" && t < startOfMonth) return false;
      }

      if (!q) return true;
      const customer = o.customer || {};
      const hay = [
        o.id,
        o.status,
        o.promo_code,
        o.delivery_method,
        customer?.name,
        customer?.phone,
        customer?.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, orderQuery, orderStatusFilter, orderTimeFilter]);

  const lowStockRows = useMemo(() => {
    const thr = Number(stockThreshold || 0);
    const rows = [];
    (products || []).forEach((p) => {
      const entries = listStockEntries(p);
      entries.forEach((e) => {
        if (e.qty <= thr) {
          rows.push({
            productId: p.id,
            productName: p.name,
            category: p.category,
            image: e.image,
            variantIndex: e.variantIndex,
            variantName: e.variantName,
            size: e.size,
            qty: e.qty,
          });
        }
      });
    });
    // lowest first
    rows.sort((a, b) => a.qty - b.qty);
    return rows;
  }, [products, stockThreshold]);

  function statusPill(status) {
    const s = String(status || "new");
    if (s === "delivered") return "bg-green-100 text-green-700 border-green-200";
    if (s === "preparing") return "bg-yellow-100 text-yellow-700 border-yellow-200";
    if (s === "canceled") return "bg-red-100 text-red-700 border-red-200";
    return "bg-blue-100 text-blue-700 border-blue-200";
  }

  function downloadCSV(rows, filename = "orders.csv") {
    const esc = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      const needs = /[",\n]/.test(s);
      const clean = s.replace(/"/g, '""');
      return needs ? `"${clean}"` : clean;
    };

    const header = [
      "id",
      "status",
      "created_at",
      "customer_name",
      "customer_phone",
      "delivery_method",
      "promo_code",
      "subtotal",
      "discount",
      "shipping",
      "total",
      "items_count",
    ];

    const lines = [header.join(",")];
    rows.forEach((o) => {
      const customer = o.customer || {};
      const items = Array.isArray(o.items) ? o.items : [];
      lines.push(
        [
          esc(o.id),
          esc(o.status),
          esc(o.created_at),
          esc(customer?.name),
          esc(customer?.phone),
          esc(o.delivery_method),
          esc(o.promo_code),
          esc(o.subtotal),
          esc(o.discount),
          esc(o.shipping),
          esc(o.total),
          esc(items.length),
        ].join(",")
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const [editingId, setEditingId] = useState(null);
  const editing = useMemo(() => {
    if (editingId === null) return null;
    return products.find((p) => String(p.id) === String(editingId)) || null;
  }, [editingId, products]);

  const [draft, setDraft] = useState(null);

  // whenever we start editing, hydrate draft
  useEffect(() => {
    if (!editing) return;
    const st = editing.stock && typeof editing.stock === "object" ? editing.stock : {};
    const discountPrice = st.__discount_price === null || st.__discount_price === undefined || st.__discount_price === "" ? "" : String(st.__discount_price);
    setDraft({
      id: editing.id,
      name: editing.name || "",
      category: editing.category || (categories[0]?.slug || "bags"),
      price: editing.price ?? 0,
      discount_price: discountPrice,
      featured: Boolean(editing.featured),
      description: editing.description || "",
      sizes: Array.isArray(editing.sizes) ? editing.sizes.join(", ") : "",
      images: Array.isArray(editing.images) ? editing.images.join("\n") : "",
      stock: editing.stock || {},
    });
  }, [editing]);

  
const sizeList = useMemo(() => {
  const raw = draft?.sizes || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}, [draft?.sizes]);

const draftImageLines = useMemo(() => {
  const raw = String(draft?.images || "");
  return raw
    .split("\n")
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}, [draft?.images]);


  
  const stockPerImageMode = useMemo(() => isPerImageStock(draft?.stock), [draft?.stock]);

  const parseImageLines = (val) =>
    String(val || "")
      .split("\n")
      .map((x) => String(x || "").trim())
      .filter(Boolean);

  function syncImageMetaToLength(stock, length) {
    const st = stock && typeof stock === "object" ? { ...stock } : {};

    if (isPerImageStock(st)) {
      const variants = Array.isArray(st.variants) ? [...st.variants] : [];
      while (variants.length < length) {
        variants.push({ name: "", description: "", stock: {} });
      }
      if (variants.length > length) variants.length = length;
      st.variants = variants;
      return st;
    }

    const meta = Array.isArray(st.__image_meta) ? [...st.__image_meta] : [];
    while (meta.length < length) {
      meta.push({ name: "", description: "" });
    }
    if (meta.length > length) meta.length = length;
    st.__image_meta = meta;
    return st;
  }

  function setImageMetaAt(index, patch) {
    setDraft((d) => {
      if (!d) return d;
      const lines = parseImageLines(d.images);
      let st = syncImageMetaToLength(d.stock, lines.length);

      if (isPerImageStock(st)) {
        const variants = Array.isArray(st.variants) ? [...st.variants] : [];
        variants[index] = { ...(variants[index] || {}), ...patch };
        st.variants = variants;
      } else {
        const meta = Array.isArray(st.__image_meta) ? [...st.__image_meta] : [];
        meta[index] = { ...(meta[index] || {}), ...patch };
        st.__image_meta = meta;
      }

      return { ...d, stock: st };
    });
  }
const categoryCounts = useMemo(() => {
    const counts = {};
    (products || []).forEach((p) => {
      const s = String(p.category || "");
      if (!s) return;
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [products]);

  async function loadPromoCodes() {
    if (!cloudMode) return;
    setPromoError("");
    setPromoBusy(true);
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPromoCodes(Array.isArray(data) ? data : []);
    } catch (e) {
      setPromoCodes([]);
      setPromoError(
        e?.message ||
          "Promo codes table isn't available yet. If you already created it, double-check RLS/policies."
      );
    } finally {
      setPromoBusy(false);
    }
  }

  useEffect(() => {
    if (tab !== "promos") return;
    if (!cloudMode) return;
    loadPromoCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cloudMode]);

  async function loadOrders() {
    if (!cloudMode) return;
    setOrdersError("");
    setOrdersBusy(true);
    try {
      const res = await fetchOrders();
      if (!res?.ok) throw new Error(res?.error || "Failed to load orders");
      setOrders(Array.isArray(res.orders) ? res.orders : []);
    } catch (e) {
      setOrders([]);
      setOrdersError(e?.message || "Failed to load orders");
    } finally {
      setOrdersBusy(false);
    }
  }

  useEffect(() => {
    if (tab !== "orders") return;
    if (!cloudMode) return;
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cloudMode]);

  async function loadShipping() {
    if (!cloudMode) return;
    setShipMsg("");
    setShipBusy(true);
    try {
      const res = await fetchShippingSettings();
      if (!res?.ok) throw new Error(res?.error || "Failed to load shipping settings");
      setShipDraft({
        methods: Array.isArray(res.settings?.methods) ? res.settings.methods : [],
        free_threshold: res.settings?.free_threshold ?? "",
      });
    } catch (e) {
      setShipDraft({ methods: [], free_threshold: "" });
      setShipMsg(e?.message || "Failed to load shipping settings");
    } finally {
      setShipBusy(false);
    }
  }

  useEffect(() => {
    if (tab !== "delivery") return;
    if (!cloudMode) return;
    loadShipping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, cloudMode]);

  async function saveShippingNow() {
    if (!cloudMode) return;
    setShipMsg("");
    setShipBusy(true);
    try {
      const res = await saveShippingSettings(shipDraft);
      if (!res?.ok) throw new Error(res?.error || "Failed to save shipping settings");
      setShipMsg("Saved ✓");
      window.setTimeout(() => setShipMsg(""), 1400);
    } catch (e) {
      setShipMsg(e?.message || "Failed to save shipping settings");
    } finally {
      setShipBusy(false);
    }
  }

  function startNewProduct() {
    setEditingId("new");
    setDraft({
      id: "",
      name: "",
      category: categories[0]?.slug || "bags",
      price: 0,
      discount_price: "",
      featured: false,
      description: "",
      sizes: "S, M, L",
      images: "",
      stock: {},
    });

    // On mobile the editor is shown above the list; make sure it's visible.
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  }

  function startEditProduct(id) {
    setEditingId(id);

    // Keep the editor in view on smaller screens.
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveProduct() {
    if (!draft) return;
    const sizesArr = sizeList;
    // If you're using the advanced per-image stock format, don't normalize it here.
    const rawStock = draft.stock || {};
    let stock =
      rawStock && typeof rawStock === "object" && rawStock.__mode === "per_image"
        ? rawStock
        : (() => {
            const sObj = { ...(rawStock || {}) };
            sizesArr.forEach((s) => {
              const v = Number(sObj[s] ?? 0);
              sObj[s] = Number.isFinite(v) ? v : 0;
            });
            return sObj;
          })();

    // Discount price is stored schema-safely inside stock jsonb.
    // Only keep it when valid; otherwise remove.
    const dpRaw = String(draft.discount_price ?? "").trim();
    const dp = dpRaw === "" ? null : Number(dpRaw);
    const basePrice = Number(draft.price || 0);
    if (dp !== null && Number.isFinite(dp) && dp > 0 && dp < basePrice) {
      stock = { ...(stock || {}), __discount_price: dp };
    } else {
      // remove if exists
      if (stock && typeof stock === "object" && "__discount_price" in stock) {
        const { __discount_price, ...rest } = stock;
        stock = rest;
      }
    }

    const res = await upsertProduct({
      ...draft,
      id: (String(editingId)==="new" || draft.id==="" || draft.id===null || draft.id===undefined) ? undefined : draft.id,
      sizes: sizesArr,
      stock,
      // do not pass discount_price to DB (schema-safe storage is inside stock)
      discount_price: undefined,
      images: (draft.images || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });

    // If cloud save failed (ex: missing RLS update policy), keep the editor open and show the error.
    if (!res?.ok) {
      window.alert(res?.error || "Failed to save product");
      return;
    }

    cancelEdit();
  }
  async function addImageToDraft(opts = {}) {
  if (!draft) return;
  if (imageBusy) return;

  const clearInputs = opts.clearInputs !== undefined ? Boolean(opts.clearInputs) : true;

  const getLines = (val) =>
    String(val || "")
      .split("\n")
      .map((x) => String(x || "").trim())
      .filter(Boolean);

  const mergeWithLimit = (existing, additions, limit) => {
    const out = [...existing];
    const seen = new Set(existing);
    let dropped = 0;
    for (const raw of additions || []) {
      const u = String(raw || "").trim();
      if (!u) continue;
      if (seen.has(u)) continue;
      if (out.length >= limit) {
        dropped += 1;
        continue;
      }
      out.push(u);
      seen.add(u);
    }
    return { out, dropped };
  };

  const existing = getLines(draft.images);

  const urlText = opts.urlText !== undefined ? String(opts.urlText || "") : String(imageUrlDraft || "");
  // allow multiple links: one per line OR comma-separated
  const urlInputs = Array.isArray(opts.urlInputs)
    ? opts.urlInputs
    : urlText
        .split("\n")
        .flatMap((line) => line.split(","))
        .map((x) => String(x || "").trim())
        .filter(Boolean);

  const fileInputsRaw = opts.files !== undefined ? opts.files : imageFilesDraft;
  const files = Array.isArray(fileInputsRaw)
    ? fileInputsRaw
    : Array.from(fileInputsRaw || []);

  if (!urlInputs.length && (!files || files.length === 0)) {
    window.alert(
      "Choose an image file (or paste image link(s))."
    );
    return;
  }

  if (existing.length >= MAX_IMAGES) {
    window.alert(`This product already has ${MAX_IMAGES} images. Remove one first.`);
    return;
  }

  setImageBusy(true);
  try {
    // 1) Merge URL inputs first (doesn't waste uploads)
    const afterUrls = mergeWithLimit(existing, urlInputs, MAX_IMAGES);
    const remainingSlots = MAX_IMAGES - afterUrls.out.length;

    // 2) Upload only what can fit
    const filesToUpload = remainingSlots > 0 ? (files || []).slice(0, remainingSlots) : [];

    const uploadedUrls = [];
    if (filesToUpload.length) {
      for (const file of filesToUpload) {
        if (!file) continue;

        if (cloudMode) {
          const bucket = storageBucket;
          const safeName = String(file.name || "image").replace(/[^a-zA-Z0-9._-]/g, "-");
          const path = `products/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;

          const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });
          if (upErr) throw upErr;

          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          const u = data?.publicUrl || "";
          if (!u) throw new Error("Upload succeeded but could not get a public URL. Is the bucket public?");
          uploadedUrls.push(u);
        } else {
          // Demo mode: temporary blob URL (won't persist after refresh)
          uploadedUrls.push(URL.createObjectURL(file));
        }
      }
    }

    // 3) Final merge (preserve order + enforce max)
    const finalMerge = mergeWithLimit(afterUrls.out, uploadedUrls, MAX_IMAGES);

    const droppedTotal = afterUrls.dropped + finalMerge.dropped;
    const skippedFiles = (files || []).length - filesToUpload.length;

    const finalList = finalMerge.out;

    if (!finalList.length) throw new Error("Invalid image URL(s)");

    setDraft((d) => {
      if (!d) return d;
      const st = syncImageMetaToLength(d.stock, finalList.length);
      return { ...d, images: finalList.join("\n"), stock: st };
    });

    // Clear inputs (when using the manual add flow)
    if (clearInputs) {
      setImageUrlDraft("");
      setImageFilesDraft([]);
    }

    if (droppedTotal > 0 || skippedFiles > 0) {
      window.alert(
        `Max ${MAX_IMAGES} images per product. Some items were not added.\nDropped: ${droppedTotal}. Skipped files: ${skippedFiles}.`
      );
    }
  } catch (e) {
    console.error(e);
    const msg = String(e?.message || "Failed to add image");
    const lower = msg.toLowerCase();
    if (lower.includes("bucket") && lower.includes("not found")) {
      window.alert(`Upload failed: bucket "${storageBucket}" not found.

Fix: In Supabase → Storage, create a bucket named "${storageBucket}" (public), OR set VITE_SUPABASE_STORAGE_BUCKET to your existing bucket name and redeploy.`);
    } else {
      window.alert(msg);
    }
  } finally {
    setImageBusy(false);
  }
}

async function saveWebsiteNow() {
    if (!cloudMode) return;
    setWebsiteSaveMsg("");
    setWebsiteSaving(true);
    try {
      const res = await saveSettingsNow();
      if (!res?.ok) throw new Error(res?.error || "Failed to save");
      setWebsiteSaveMsg("Saved ✓");
      window.setTimeout(() => setWebsiteSaveMsg(""), 1400);
    } catch (e) {
      setWebsiteSaveMsg(e?.message || "Failed to save");
    } finally {
      setWebsiteSaving(false);
    }
  }

  async function savePromoCode() {
    if (!cloudMode) return;
    const code = String(promoDraft.code || "").trim().toUpperCase();
    const type = promoDraft.type === "fixed" ? "fixed" : "percent";
    const value = Number(promoDraft.value || 0);
    if (!code) {
      window.alert("Promo code is required");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      window.alert("Promo value must be a positive number");
      return;
    }

    setPromoBusy(true);
    setPromoError("");
    try {
      const payload = {
        code,
        type,
        value,
        active: promoDraft.active !== false,
      };

      const { error } = await supabase.from("promo_codes").upsert(payload, { onConflict: "code" });
      if (error) throw error;

      setPromoDraft({ code: "", type: "percent", value: 10, active: true });
      await loadPromoCodes();
    } catch (e) {
      console.error(e);
      setPromoError(e?.message || "Failed to save promo code");
    } finally {
      setPromoBusy(false);
    }
  }

  return (
    <Container>
      <div className="py-12">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--color-text)]">Admin</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Normal Admin (free) — products, categories, banner, hero, and website name.
            </p>
          </div>

          <button
            type="button"
            onClick={resetStore}
            className="rounded-full px-4 py-2 text-sm border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition"
            title={cloudMode ? "Reload data from Supabase" : "Reset store to demo defaults"}
          >
            {cloudMode ? "Reload" : "Reset demo"}
          </button>

          {cloudMode && (
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/admin-login";
              }}
              className="rounded-full px-4 py-2 text-sm border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition"
              title="Sign out"
            >
              Sign out
            </button>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <TabButton active={tab === "products"} onClick={() => setTab("products")}>
            Products
          </TabButton>
          <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
            Categories
          </TabButton>
          <TabButton active={tab === "website"} onClick={() => setTab("website")}>
            Website
          </TabButton>
          {cloudMode ? (
            <TabButton active={tab === "promos"} onClick={() => setTab("promos")}>
              Promo codes
            </TabButton>
          ) : null}
          {cloudMode ? (
            <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
              Orders
              {ordersStatusCounts.new ? (
                <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-[var(--color-border)] bg-[var(--color-bg)]">
                  {ordersStatusCounts.new} new
                </span>
              ) : null}
            </TabButton>
          ) : null}
          {cloudMode ? (
            <TabButton active={tab === "delivery"} onClick={() => setTab("delivery")}>
              Delivery
            </TabButton>
          ) : null}

          <TabButton active={tab === "inventory"} onClick={() => setTab("inventory")}>
            Inventory
            {lowStockRows.length ? (
              <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-[var(--color-border)] bg-[var(--color-bg)]">
                {lowStockRows.length} low
              </span>
            ) : null}
          </TabButton>
        </div>

        {/* PRODUCTS */}
        {tab === "products" && (
          <div className="mt-8 flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_420px]">
            <div className="order-2 lg:order-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <p className="text-sm text-[var(--color-text-muted)]">{products.length} products</p>
                <button
                  type="button"
                  onClick={startNewProduct}
                  className="rounded-full px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-95 transition"
                >
                  + New product
                </button>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {products
                  .slice()
                  .sort((a, b) => Number(b.featured) - Number(a.featured))
                  .map((p) => (
                    <div key={p.id} className="p-4 flex items-center gap-4">
                      <div className="h-14 w-14 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] shrink-0">
                        {p.image ? (
                          <SafeImage src={p.image} alt={p.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[var(--color-text)] truncate">
                          {p.name}
                          {p.featured ? <span className="ml-2 text-xs text-[var(--color-text-muted)]">• Featured</span> : null}
                        </p>
                        <p className="text-sm text-[var(--color-text-muted)] truncate">
                          {p.category} • {"$"}{Number(p.price || 0)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditProduct(p.id)}
                          className="rounded-full px-3 py-1.5 text-sm border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-surface-2)] transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProduct(p.id)}
                          className="rounded-full px-3 py-1.5 text-sm border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-red-50 hover:border-red-200 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Editor */}
            <div className="order-1 lg:order-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              {!draft ? (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Select a product to edit, or create a new one.
                  </p>
                  <button
                    type="button"
                    onClick={startNewProduct}
                    className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-95 transition"
                  >
                    + New product
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                      {String(editingId) === "new" ? "New product" : "Edit product"}
                    </h2>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      Cancel
                    </button>
                  </div>

                  <Field label="Name">
                    <TextInput
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="Product name"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Category">
                      <Select
                        value={draft.category}
                        onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                      >
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.label} ({c.slug})
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Price">
                      <TextInput
                        type="number"
                        value={draft.price}
                        onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                        min="0"
                      />
                    </Field>
                  </div>

                  <Field label="Discount price" hint="Optional (must be lower than price)">
                    <TextInput
                      type="number"
                      value={draft.discount_price}
                      onChange={(e) => setDraft((d) => ({ ...d, discount_price: e.target.value }))}
                      min="0"
                      placeholder="e.g. 49.99"
                    />
                  </Field>

                  <Field label="Featured">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.featured}
                        onChange={(e) => setDraft((d) => ({ ...d, featured: e.target.checked }))}
                      />
                      Show in featured sections
                    </label>
                  </Field>

                  <Field label="Description" hint="Optional">
                    <TextArea
                      rows={3}
                      value={draft.description}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      placeholder="Short description"
                    />
                  </Field>

                  <Field label="Sizes" hint="Comma separated">
                    <TextInput
                      value={draft.sizes}
                      onChange={(e) => setDraft((d) => ({ ...d, sizes: e.target.value }))}
                      placeholder="S, M, L or One Size"
                    />
                  </Field>

                  {sizeList.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)] mb-2">Stock per size</p>
                      <div className="grid grid-cols-2 gap-3">
                        {sizeList.map((s) => (
                          <label key={s} className="text-sm">
                            <span className="text-[var(--color-text-muted)]">{s}</span>
                            <input
                              type="number"
                              min="0"
                              value={draft.stock?.[s] ?? 0}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  stock: { ...(d.stock || {}), [s]: Number(e.target.value) },
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <Field
                    label="Images"
                    hint="One per line (local like /products/p001_1.jpg or URL) • Max 10"
                  >
                    <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                      <p className="text-sm font-medium text-[var(--color-text)]">Add image</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        Choose a file — it will be added instantly. {cloudMode ? `Uploads to storage bucket: ${storageBucket}` : "Demo mode (temporary preview URL)"}. Max {MAX_IMAGES}.
                      </p>

                      <label className="mt-3 block text-sm">
                        <span className="text-[var(--color-text-muted)]">Choose file</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={imageBusy || (draftImageLines?.length || 0) >= MAX_IMAGES}
                          onChange={async (e) => {
                            const input = e.target;
                            const file = input.files && input.files[0] ? input.files[0] : null;
                            // reset right away so picking the same file again still triggers onChange
                            input.value = "";
                            if (!file) return;

                            const remaining = Math.max(0, MAX_IMAGES - (draftImageLines?.length || 0));
                            if (remaining <= 0) {
                              window.alert(`You reached the max (${MAX_IMAGES}) images for this product. Remove one first.`);
                              return;
                            }

                            await addImageToDraft({ files: [file], urlText: "", clearInputs: false });
                          }}
                          className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        />
                      </label>

                      {(draftImageLines?.length || 0) >= MAX_IMAGES ? (
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          Max {MAX_IMAGES} images reached. Remove an image below to add a new one.
                        </p>
                      ) : null}
                    </div>


{draftImageLines && draftImageLines.length ? (
  <div className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-medium text-[var(--color-text)]">
        Current images ({draftImageLines.length}/{MAX_IMAGES})
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">
        Tip: click “Cover” to make an image the main one.
      </p>
    </div>

    <div className="mt-3 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {draftImageLines.map((img, idx) => {
        const st = draft?.stock && typeof draft.stock === "object" ? draft.stock : {};
        const per = isPerImageStock(st);
        const rawName = per ? String(st?.variants?.[idx]?.name || "") : String(st?.__image_meta?.[idx]?.name || "");
        const rawDesc = per ? String(st?.variants?.[idx]?.description || "") : String(st?.__image_meta?.[idx]?.description || "");

        return (
          <div
            key={img + "-" + idx}
            className="relative group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
          >
            <div className="relative">
              <SafeImage
                src={img}
                alt={"Image " + (idx + 1)}
                className="h-20 w-full rounded-lg object-cover border border-[var(--color-border)]"
              />

              <button
                type="button"
                title="Remove"
                onClick={() => {
                  setDraft((d) => {
                    if (!d) return d;
                    const lines = parseImageLines(d.images);
                    const nextLines = lines.filter((_, i) => i !== idx);

                    let st2 = d.stock && typeof d.stock === "object" ? { ...d.stock } : {};
                    if (isPerImageStock(st2)) {
                      const vars = Array.isArray(st2.variants) ? [...st2.variants] : [];
                      vars.splice(idx, 1);
                      st2.variants = vars;
                    } else {
                      const meta = Array.isArray(st2.__image_meta) ? [...st2.__image_meta] : [];
                      meta.splice(idx, 1);
                      st2.__image_meta = meta;
                    }
                    st2 = syncImageMetaToLength(st2, nextLines.length);

                    return { ...d, images: nextLines.join("\n"), stock: st2 };
                  });
                }}
                className="absolute top-1 right-1 rounded-full px-2 py-1 text-xs bg-black/70 text-white opacity-0 group-hover:opacity-100 transition"
              >
                ✕
              </button>

              {idx === 0 ? (
                <span className="absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[10px] bg-black/70 text-white">
                  Cover
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraft((d) => {
                      if (!d) return d;
                      const lines = parseImageLines(d.images);
                      const selected = lines[idx];
                      const nextLines = [selected, ...lines.filter((_, i) => i !== idx)];

                      let st2 = d.stock && typeof d.stock === "object" ? { ...d.stock } : {};
                      if (isPerImageStock(st2)) {
                        const vars = Array.isArray(st2.variants) ? [...st2.variants] : [];
                        const vSel = vars[idx];
                        const nextVars = [vSel, ...vars.filter((_, i) => i !== idx)];
                        st2.variants = nextVars;
                      } else {
                        const meta = Array.isArray(st2.__image_meta) ? [...st2.__image_meta] : [];
                        const mSel = meta[idx];
                        const nextMeta = [mSel, ...meta.filter((_, i) => i !== idx)];
                        st2.__image_meta = nextMeta;
                      }
                      st2 = syncImageMetaToLength(st2, nextLines.length);

                      return { ...d, images: nextLines.join("\n"), stock: st2 };
                    });
                  }}
                  className="absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[10px] bg-black/70 text-white opacity-0 group-hover:opacity-100 transition"
                >
                  Cover
                </button>
              )}
            </div>

            <div className="mt-2 space-y-1">
              <input
                type="text"
                value={rawName}
                onChange={(e) => setImageMetaAt(idx, { name: e.target.value })}
                placeholder={idx === 0 ? "Name (optional)" : "Name (optional — defaults to image 1)"}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
              />
              <textarea
                rows={3}
                value={rawDesc}
                onChange={(e) => setImageMetaAt(idx, { description: e.target.value })}
                placeholder={idx === 0 ? "Description (optional)" : "Description (optional — defaults to image 1)"}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 min-h-[72px] resize-y"
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
) : null}

<TextArea
  rows={6}
                      value={draft.images}
                      onChange={(e) => setDraft((d) => ({ ...d, images: e.target.value }))}
                      placeholder="/products/p001_1.jpg\n/products/p001_2.jpg"
                      className="min-h-[160px] md:min-h-[220px] resize-y"
                    />
                  </Field>

                  <button
                    type="button"
                    onClick={saveProduct}
                    className="w-full rounded-xl py-3 font-semibold bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-95 transition"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CATEGORIES */}
        {tab === "categories" && (
          <div className="mt-8 grid lg:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Add category</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Slug is what appears in URLs (lowercase, no spaces).
              </p>

              <div className="mt-5 space-y-4">
                <Field label="Label">
                  <TextInput
                    value={catDraft.label}
                    onChange={(e) => setCatDraft((d) => ({ ...d, label: e.target.value }))}
                    placeholder="Bags"
                  />
                </Field>

                <Field label="Slug" hint="ex: bags">
                  <TextInput
                    value={catDraft.slug}
                    onChange={(e) => setCatDraft((d) => ({ ...d, slug: e.target.value }))}
                    placeholder="bags"
                  />
                </Field>

                <button
                  type="button"
                  onClick={() => {
                    upsertCategory(catDraft);
                    setCatDraft({ label: "", slug: "" });
                  }}
                  className="rounded-xl px-4 py-3 text-sm font-semibold bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-95 transition"
                >
                  Save category
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <div className="p-6 border-b border-[var(--color-border)]">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Categories</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Deleting a category will also delete all products inside it.
                </p>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {categories.map((c) => {
                  const count = categoryCounts[String(c.slug)] || 0;
                  const used = count > 0;
                  return (
                    <div key={c.slug} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-[var(--color-text)]">{c.label}</p>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {c.slug}
                          {used ? <span className="ml-2">• {count} product{count === 1 ? "" : "s"}</span> : null}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const msg = used
                            ? `Delete "${c.label}"?\n\n⚠️ This will also delete ${count} product${count === 1 ? "" : "s"} in this category.\n\nThis can’t be undone.`
                            : `Delete "${c.label}"?\n\nThis can’t be undone.`;
                          if (!window.confirm(msg)) return;
                          deleteCategory(c.slug);
                        }}
                        className={`rounded-full px-3 py-1.5 text-sm border transition ${
                          used
                            ? "border-red-200 bg-red-50 hover:bg-red-100"
                            : "border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-red-50 hover:border-red-200"
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* WEBSITE */}
        {tab === "website" && (
          <div className="mt-8 space-y-4">
            <div className="grid lg:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-6">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">General</h2>

              <Field label="Website name">
                <TextInput
                  value={settings.siteName || ""}
                  onChange={(e) => setSettings({ siteName: e.target.value })}
                  placeholder="Baggo"
                />
              </Field>

              <Field label="WhatsApp number" hint="International format, numbers only (ex: 96171234567)">
                <TextInput
                  value={settings.whatsapp || ""}
                  onChange={(e) => setSettings({ whatsapp: e.target.value })}
                  placeholder="96171234567"
                />
              </Field>

              <div className="h-px bg-[var(--color-border)]" />

              <h2 className="text-lg font-semibold text-[var(--color-text)]">Banner</h2>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(banner.enabled)}
                  onChange={(e) => setBanner({ enabled: e.target.checked })}
                />
                Enable banner
              </label>

              <Field label="Banner text">
                <TextInput
                  value={banner.text || ""}
                  onChange={(e) => setBanner({ text: e.target.value })}
                  placeholder="This is Baggo"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Button label" hint="Optional">
                  <TextInput
                    value={banner.buttonLabel || ""}
                    onChange={(e) => setBanner({ buttonLabel: e.target.value })}
                    placeholder="Shop"
                  />
                </Field>
                <Field label="Button link" hint="Optional">
                  <TextInput
                    value={banner.buttonHref || ""}
                    onChange={(e) => setBanner({ buttonHref: e.target.value })}
                    placeholder="/shop"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-6">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Hero</h2>

              <Field label="Badge text">
                <TextInput
                  value={hero.badgeText || ""}
                  onChange={(e) => setHero({ badgeText: e.target.value })}
                />
              </Field>

              <Field label="Title">
                <TextArea
                  rows={2}
                  value={hero.title || ""}
                  onChange={(e) => setHero({ title: e.target.value })}
                />
              </Field>

              <Field label="Subtitle">
                <TextArea
                  rows={3}
                  value={hero.subtitle || ""}
                  onChange={(e) => setHero({ subtitle: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Primary CTA label">
                  <TextInput
                    value={hero.primaryCtaLabel || ""}
                    onChange={(e) => setHero({ primaryCtaLabel: e.target.value })}
                  />
                </Field>
                <Field label="Primary CTA link">
                  <TextInput
                    value={hero.primaryCtaHref || ""}
                    onChange={(e) => setHero({ primaryCtaHref: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Secondary CTA label">
                  <TextInput
                    value={hero.secondaryCtaLabel || ""}
                    onChange={(e) => setHero({ secondaryCtaLabel: e.target.value })}
                  />
                </Field>
                <Field label="Secondary CTA link">
                  <TextInput
                    value={hero.secondaryCtaHref || ""}
                    onChange={(e) => setHero({ secondaryCtaHref: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Main hero product">
                  <Select
                    value={hero.mainProductId ?? ""}
                    onChange={(e) => setHero({ mainProductId: e.target.value ? String(e.target.value) : null })}
                  >
                    <option value="">Auto</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Side hero product">
                  <Select
                    value={hero.sideProductId ?? ""}
                    onChange={(e) => setHero({ sideProductId: e.target.value ? String(e.target.value) : null })}
                  >
                    <option value="">Auto</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                {cloudMode ? "Click Save to force-sync settings to Supabase." : "Demo mode: settings save locally."}
              </p>

              <div className="flex items-center gap-3">
                {websiteSaveMsg ? <span className="text-sm text-[var(--color-text)]">{websiteSaveMsg}</span> : null}
                <button
                  type="button"
                  onClick={saveWebsiteNow}
                  disabled={!cloudMode || websiteSaving}
                  className="rounded-full px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)] disabled:opacity-50"
                >
                  {websiteSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PROMO CODES */}
        {tab === "promos" && cloudMode && (
          <div className="mt-8 grid lg:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Add promo code</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Optional. Used at checkout.</p>

              <div className="mt-5 space-y-4">
                <Field label="Code" hint="Example: BAGGO10">
                  <TextInput
                    value={promoDraft.code}
                    onChange={(e) => setPromoDraft((d) => ({ ...d, code: e.target.value }))}
                    placeholder="BAGGO10"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Type">
                    <Select value={promoDraft.type} onChange={(e) => setPromoDraft((d) => ({ ...d, type: e.target.value }))}>
                      <option value="percent">Percent (%)</option>
                      <option value="fixed">Fixed ($)</option>
                    </Select>
                  </Field>
                  <Field label="Value">
                    <TextInput
                      type="number"
                      min="0"
                      value={promoDraft.value}
                      onChange={(e) => setPromoDraft((d) => ({ ...d, value: e.target.value }))}
                    />
                  </Field>
                </div>

                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={promoDraft.active !== false}
                    onChange={(e) => setPromoDraft((d) => ({ ...d, active: e.target.checked }))}
                  />
                  Active
                </label>

                <button
                  type="button"
                  onClick={savePromoCode}
                  disabled={promoBusy}
                  className="rounded-xl px-4 py-3 text-sm font-semibold bg-[var(--color-primary)] text-[var(--color-on-primary)] disabled:opacity-50"
                >
                  {promoBusy ? "Saving..." : "Save promo"}
                </button>

                {promoError ? <p className="text-sm text-red-600">{promoError}</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <div className="p-6 border-b border-[var(--color-border)]">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Promo codes</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Click a code to edit it.</p>
              </div>

              {promoBusy ? (
                <div className="p-6 text-sm text-[var(--color-text-muted)]">Loading...</div>
              ) : promoCodes.length === 0 ? (
                <div className="p-6 text-sm text-[var(--color-text-muted)]">No promo codes yet.</div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {promoCodes.map((row) => (
                    <button
                      key={row.code || row.id}
                      type="button"
                      onClick={() =>
                        setPromoDraft({
                          code: row.code || "",
                          type: row.type || "percent",
                          value: row.value ?? 10,
                          active: row.active !== false,
                        })
                      }
                      className="w-full text-left p-4 hover:bg-[var(--color-surface-2)] transition"
                    >
                      <p className="font-medium text-[var(--color-text)]">{row.code}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {String(row.type || "percent") === "fixed" ? "$" : ""}
                        {row.value}
                        {String(row.type || "percent") === "percent" ? "%" : ""}
                        {row.active === false ? " • Inactive" : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ORDERS */}
        {tab === "orders" && cloudMode && (
          <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Orders</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Newest orders first.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadCSV(filteredOrders, `orders-${new Date().toISOString().slice(0, 10)}.csv`)}
                  disabled={ordersBusy || filteredOrders.length === 0}
                  className="rounded-full px-4 py-2 text-sm border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] disabled:opacity-50"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={loadOrders}
                  disabled={ordersBusy}
                  className="rounded-full px-4 py-2 text-sm border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] disabled:opacity-50"
                >
                  {ordersBusy ? "Loading..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <TextInput
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  placeholder="Search: order id, name, phone, status..."
                />
                <Select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                  <option value="all">All statuses ({ordersStatusCounts.all})</option>
                  <option value="new">New ({ordersStatusCounts.new})</option>
                  <option value="preparing">Preparing ({ordersStatusCounts.preparing})</option>
                  <option value="delivered">Delivered ({ordersStatusCounts.delivered})</option>
                  <option value="canceled">Canceled ({ordersStatusCounts.canceled})</option>
                </Select>
                <Select value={orderTimeFilter} onChange={(e) => setOrderTimeFilter(e.target.value)}>
                  <option value="all">Any time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                </Select>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">Showing</span>
                  <span className="font-semibold text-[var(--color-text)]">{filteredOrders.length}</span>
                </div>
              </div>
            </div>

            {ordersError ? <div className="p-6 text-sm text-red-600">{ordersError}</div> : null}

            {ordersBusy ? (
              <div className="p-6 text-sm text-[var(--color-text-muted)]">Loading...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-6 text-sm text-[var(--color-text-muted)]">No orders yet.</div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {filteredOrders.map((o) => {
                  const when = o.created_at ? new Date(o.created_at).toLocaleString() : "";
                  const customer = o.customer || {};
                  const items = Array.isArray(o.items) ? o.items : [];
                  const phone = String(customer?.phone || "").replace(/\D/g, "");
                  return (
                    <div key={o.id} className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm text-[var(--color-text-muted)]">{when}</p>
                          <p className="mt-1 font-semibold text-[var(--color-text)] break-all">{o.id}</p>
                          <p className="mt-2 text-sm text-[var(--color-text)]">
                            Total: <span className="font-semibold">{"$"}{Number(o.total || 0)}</span> • Items: {items.length}
                          </p>

                          <div className="mt-3">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPill(o.status)}`}>
                              {String(o.status || "new").toUpperCase()}
                            </span>
                          </div>

                          <div className="mt-3 text-sm text-[var(--color-text-muted)] space-y-1">
                            {customer?.name ? <p>Name: <span className="text-[var(--color-text)]">{customer.name}</span></p> : null}
                            {customer?.phone ? <p>Phone: <span className="text-[var(--color-text)]">{customer.phone}</span></p> : null}
                            {customer?.address ? <p>Address: <span className="text-[var(--color-text)]">{customer.address}</span></p> : null}
                            {o.delivery_method ? <p>Delivery: <span className="text-[var(--color-text)]">{o.delivery_method}</span></p> : null}
                            {o.promo_code ? <p>Promo: <span className="text-[var(--color-text)]">{o.promo_code}</span></p> : null}
                          </div>
                        </div>

                        <div className="w-full md:w-64 space-y-3">
                          <div>
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Status</p>
                            <Select
                              value={o.status || "new"}
                              onChange={async (e) => {
                                const next = e.target.value;
                                setOrders((prev) => prev.map((x) => (String(x.id) === String(o.id) ? { ...x, status: next } : x)));
                                const res = await updateOrderStatus(o.id, next);
                                if (!res?.ok) {
                                  window.alert(res?.error || "Failed to update status");
                                  loadOrders();
                                }
                              }}
                            >
                              <option value="new">New</option>
                              <option value="preparing">Preparing</option>
                              <option value="delivered">Delivered</option>
                              <option value="canceled">Canceled</option>
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderId(o.id)}
                              className="rounded-xl px-4 py-3 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              disabled={!phone}
                              onClick={() => {
                                if (!phone) return;
                                const storeName = String(settings?.siteName || "Baggo");
                                const msg = `Hi${customer?.name ? ` ${customer.name}` : ""}! About your ${storeName} order ${o.id}: status is ${o.status || "new"}.`;
                                const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                                window.open(url, "_blank");
                              }}
                              className="rounded-xl px-4 py-3 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                            >
                              WhatsApp
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              setConfirm({
                                open: true,
                                title: "Delete order",
                                message: "Delete this order? This can't be undone.",
                                onConfirm: async () => {
                                  const res = await deleteOrder(o.id);
                                  if (!res?.ok) {
                                    window.alert(res?.error || "Failed to delete order");
                                    return;
                                  }
                                  setOrders((prev) => prev.filter((x) => String(x.id) !== String(o.id)));
                                },
                              });
                            }}
                            className="rounded-xl px-4 py-3 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* DELIVERY / SHIPPING */}
        {tab === "delivery" && cloudMode && (
          <div className="mt-8 grid lg:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Delivery settings</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">These options show up in checkout.</p>

              <div className="mt-6 space-y-4">
                <Field label="Free delivery threshold" hint="If set, shipping fee becomes $0 when total (after promo) is >= threshold.">
                  <TextInput
                    type="number"
                    min="0"
                    value={shipDraft.free_threshold}
                    onChange={(e) => setShipDraft((d) => ({ ...d, free_threshold: e.target.value }))}
                    placeholder="Leave empty to disable"
                  />
                </Field>

                <div>
                  <p className="text-sm font-medium text-[var(--color-text)] mb-2">Methods</p>
                  <div className="space-y-3">
                    {(shipDraft.methods || []).map((m, idx) => (
                      <div
                        key={`ship-${idx}`}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Code</p>
                            <TextInput
                              value={m.code}
                              onChange={(e) => {
                                const v = e.target.value;
                                setShipDraft((d) => {
                                  const next = [...(d.methods || [])];
                                  next[idx] = { ...next[idx], code: v };
                                  return { ...d, methods: next };
                                });
                              }}
                              placeholder="delivery"
                            />
                          </div>

                          <div>
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Label</p>
                            <TextInput
                              value={m.label}
                              onChange={(e) => {
                                const v = e.target.value;
                                setShipDraft((d) => {
                                  const next = [...(d.methods || [])];
                                  next[idx] = { ...next[idx], label: v };
                                  return { ...d, methods: next };
                                });
                              }}
                              placeholder="Delivery"
                            />
                          </div>

                          <div>
                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Fee ($)</p>
                            <TextInput
                              type="number"
                              min="0"
                              value={m.fee}
                              onChange={(e) => {
                                const v = e.target.value;
                                setShipDraft((d) => {
                                  const next = [...(d.methods || [])];
                                  next[idx] = { ...next[idx], fee: v };
                                  return { ...d, methods: next };
                                });
                              }}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={m.active !== false}
                              onChange={(e) => {
                                const v = e.target.checked;
                                setShipDraft((d) => {
                                  const next = [...(d.methods || [])];
                                  next[idx] = { ...next[idx], active: v };
                                  return { ...d, methods: next };
                                });
                              }}
                            />
                            Active
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              setShipDraft((d) => ({
                                ...d,
                                methods: (d.methods || []).filter((_, i) => i !== idx),
                              }));
                            }}
                            className="text-sm text-[var(--color-danger)] hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setShipDraft((d) => ({
                          ...d,
                          methods: [
                            ...(d.methods || []),
                            { code: `method_${(d.methods || []).length + 1}`, label: "New method", fee: 0, active: true },
                          ],
                        }));
                      }}
                      className="rounded-xl px-4 py-3 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                    >
                      + Add method
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  {shipMsg ? <p className="text-sm text-[var(--color-text-muted)]">{shipMsg}</p> : <span />}
                  <button
                    type="button"
                    onClick={saveShippingNow}
                    disabled={shipBusy}
                    className="rounded-xl px-4 py-3 text-sm font-semibold bg-[var(--color-primary)] text-[var(--color-on-primary)] disabled:opacity-50"
                  >
                    {shipBusy ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">Preview</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">What customers will see in checkout.</p>

              <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-2">
                {(shipDraft.methods || []).filter((m) => m.active !== false).map((m) => (
                  <div key={m.code} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text)]">{m.label}</span>
                    <span className="text-[var(--color-text-muted)]">+{"$"}{Number(m.fee || 0)}</span>
                  </div>
                ))}
                {shipDraft.free_threshold !== "" && shipDraft.free_threshold !== null && shipDraft.free_threshold !== undefined ? (
                  <p className="pt-2 text-xs text-[var(--color-text-muted)]">
                    Free delivery for totals &gt;= {"$"}{Number(shipDraft.free_threshold || 0)}
                  </p>
                ) : null}
              </div>

              <div className="mt-6 text-sm text-[var(--color-text-muted)]">
                <p>
                  Tip: Use simple codes (delivery, express) and clear labels.
                </p>
                <p className="mt-2">
                  If checkout isn't showing these, make sure you ran the SQL to create the <span className="text-[var(--color-text)]">shipping_settings</span> table.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* INVENTORY (LOW STOCK) */}
        {tab === "inventory" && (
          <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Inventory</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Low stock overview across sizes & variants.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--color-text-muted)]">Threshold</span>
                  <TextInput
                    type="number"
                    min="0"
                    value={stockThreshold}
                    onChange={(e) => setStockThreshold(e.target.value)}
                    className="w-24"
                  />
                </div>
              </div>
            </div>

            {lowStockRows.length === 0 ? (
              <div className="p-6 text-sm text-[var(--color-text-muted)]">No low-stock items (under or equal to threshold).</div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {lowStockRows.slice(0, 200).map((row, idx) => (
                  <div key={`${row.productId}-${row.variantIndex ?? "v"}-${row.size}-${idx}`} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-14 w-14 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] shrink-0">
                        {row.image ? <SafeImage src={row.image} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--color-text)] truncate">{row.productName}</p>
                        <p className="text-sm text-[var(--color-text-muted)] truncate">
                          {row.category}
                          {row.variantName ? ` • ${row.variantName}` : ""}
                          {row.variantIndex !== null && row.variantIndex !== undefined ? ` • v${Number(row.variantIndex) + 1}` : ""}
                          {row.size ? ` • Size: ${row.size}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${row.qty === 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-yellow-100 text-yellow-800 border-yellow-200"}`}>
                        {row.qty === 0 ? "Out of stock" : `Only ${row.qty} left`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTab("products");
                          startEditProduct(row.productId);
                        }}
                        className="rounded-xl px-4 py-3 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
                {lowStockRows.length > 200 ? (
                  <div className="p-6 text-sm text-[var(--color-text-muted)]">Showing first 200 results. Increase threshold or search via Products tab.</div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* ORDER DETAILS MODAL */}
        <Modal
          open={Boolean(selectedOrder)}
          title={selectedOrder ? `Order ${String(selectedOrder.id).slice(0, 8)}…` : "Order"}
          onClose={() => setSelectedOrderId(null)}
          widthClass="max-w-4xl"
          footer={
            selectedOrder ? (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {["new", "preparing", "delivered", "canceled"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={async () => {
                        const res = await updateOrderStatus(selectedOrder.id, s);
                        if (!res?.ok) {
                          window.alert(res?.error || "Failed to update status");
                          return;
                        }
                        setOrders((prev) => prev.map((x) => (String(x.id) === String(selectedOrder.id) ? { ...x, status: s } : x)));
                      }}
                      className={`rounded-full px-4 py-2 text-sm border ${String(selectedOrder.status || "new") === s ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]" : "border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"}`}
                    >
                      Mark {s}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirm({
                      open: true,
                      title: "Delete order",
                      message: "Delete this order? This can't be undone.",
                      onConfirm: async () => {
                        const res = await deleteOrder(selectedOrder.id);
                        if (!res?.ok) {
                          window.alert(res?.error || "Failed to delete order");
                          return;
                        }
                        setOrders((prev) => prev.filter((x) => String(x.id) !== String(selectedOrder.id)));
                        setSelectedOrderId(null);
                      },
                    });
                  }}
                  className="rounded-full px-4 py-2 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                >
                  Delete
                </button>
              </div>
            ) : null
          }
        >
          {selectedOrder ? (
            (() => {
              const o = selectedOrder;
              const when = o.created_at ? new Date(o.created_at).toLocaleString() : "";
              const customer = o.customer || {};
              const items = Array.isArray(o.items) ? o.items : [];
              const phone = String(customer?.phone || "").replace(/\D/g, "");
              return (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <p className="text-sm text-[var(--color-text-muted)]">Created</p>
                      <p className="text-[var(--color-text)] font-semibold">{when}</p>
                      <div className="mt-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPill(o.status)}`}>
                          {String(o.status || "new").toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={!phone}
                        onClick={() => {
                          if (!phone) return;
                          const storeName = String(settings?.siteName || "Baggo");
                          const msg = `Hi${customer?.name ? ` ${customer.name}` : ""}! About your ${storeName} order ${o.id}.`;
                          const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                          window.open(url, "_blank");
                        }}
                        className="rounded-full px-4 py-2 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                      >
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(String(o.id));
                        }}
                        className="rounded-full px-4 py-2 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                      >
                        Copy ID
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                      <p className="text-xs text-[var(--color-text-muted)]">Customer</p>
                      <div className="mt-2 text-sm space-y-1">
                        <p className="text-[var(--color-text)]">Name: <span className="font-semibold">{customer?.name || "—"}</span></p>
                        <p className="text-[var(--color-text)]">Phone: <span className="font-semibold">{customer?.phone || "—"}</span></p>
                        <p className="text-[var(--color-text)]">Address: <span className="font-semibold">{customer?.address || "—"}</span></p>
                        {o.notes ? <p className="text-[var(--color-text)]">Notes: <span className="font-semibold">{o.notes}</span></p> : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                      <p className="text-xs text-[var(--color-text-muted)]">Summary</p>
                      <div className="mt-2 text-sm space-y-1">
                        <p className="text-[var(--color-text)]">Delivery: <span className="font-semibold">{o.delivery_method || "—"}</span></p>
                        <p className="text-[var(--color-text)]">Promo: <span className="font-semibold">{o.promo_code || "—"}</span></p>
                        <p className="text-[var(--color-text)]">Subtotal: <span className="font-semibold">${Number(o.subtotal || 0)}</span></p>
                        <p className="text-[var(--color-text)]">Discount: <span className="font-semibold">-${Number(o.discount || 0)}</span></p>
                        <p className="text-[var(--color-text)]">Shipping: <span className="font-semibold">${Number(o.shipping || 0)}</span></p>
                        <p className="text-[var(--color-text)]">Total: <span className="font-semibold">${Number(o.total || 0)}</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                    <p className="text-xs text-[var(--color-text-muted)]">Items ({items.length})</p>
                    <div className="mt-3 divide-y divide-[var(--color-border)]">
                      {items.map((it, idx) => (
                        <div key={`${o.id}-modal-it-${idx}`} className="py-3 flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] shrink-0">
                            {it.image ? <SafeImage src={it.image} alt="" className="h-full w-full object-cover" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[var(--color-text)] font-medium truncate">{it.name}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {it.size ? `Size: ${it.size}` : ""}
                              {it.variantIndex !== null && it.variantIndex !== undefined ? ` • v${Number(it.variantIndex) + 1}` : ""}
                            </p>
                          </div>
                          <div className="text-sm text-[var(--color-text)] whitespace-nowrap">
                            x{it.quantity} • ${Number(it.price || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : null}
        </Modal>

        {/* CONFIRM DIALOG */}
        <Modal
          open={Boolean(confirm?.open)}
          title={confirm?.title || "Confirm"}
          onClose={() => setConfirm({ open: false, title: "", message: "", onConfirm: null })}
          widthClass="max-w-lg"
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm({ open: false, title: "", message: "", onConfirm: null })}
                className="rounded-full px-4 py-2 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirm?.onConfirm;
                  setConfirm({ open: false, title: "", message: "", onConfirm: null });
                  await fn?.();
                }}
                className="rounded-full px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)]"
              >
                Confirm
              </button>
            </div>
          }
        >
          <p className="text-sm text-[var(--color-text)]">{confirm?.message || "Are you sure?"}</p>
        </Modal>
      </div>
    </Container>
  );
}
