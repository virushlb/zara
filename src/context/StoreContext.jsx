import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { products as seedProducts } from "../data/products";
import { supabase, supabaseEnabled } from "../lib/supabase";

// Baggo Store
// - Demo mode: localStorage (works without Supabase)
// - Supabase mode: reads from DB + writes from Admin

const KEY = "BAGGO_STORE_V1";
const StoreContext = createContext(null);

const DEFAULT_SETTINGS = {
  siteName: "Baggo",
  whatsapp: "",
  banner: {
    enabled: true,
    text: "This is Baggo",
    buttonLabel: "",
    buttonHref: "",
  },
  hero: {
    badgeText: "New drop • Minimal, premium pieces",
    title: "Carry better. Shop Baggo.",
    subtitle:
      "A clean storefront built for speed now — and a Pro-ready admin later. Discover products, save favorites, and add to cart in one tap.",
    primaryCtaLabel: "Shop now",
    primaryCtaHref: "/shop",
    secondaryCtaLabel: "Explore bags",
    secondaryCtaHref: "/shop?category=bags",
    mainProductId: null,
    sideProductId: null,
  },
};

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function titleCase(slug) {
  const s = String(slug || "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function deriveCategories(products) {
  const uniq = Array.from(
    new Set((products || []).map((p) => String(p.category || "").trim()).filter(Boolean))
  );
  const preferred = ["bags", "accessories"];
  uniq.sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b);
  });
  return uniq.map((slug, i) => ({
    id: slug,
    slug,
    label: titleCase(slug),
    visible: true,
    sort_order: i,
  }));
}

function buildCloudStore() {
  return {
    settings: DEFAULT_SETTINGS,
    categories: [],
    products: [],
  };
}

function buildDefaultStore() {
  return {
    settings: DEFAULT_SETTINGS,
    categories: deriveCategories(seedProducts),
    products: seedProducts,
  };
}

function normalizeStore(maybe) {
  const base = supabaseEnabled ? buildCloudStore() : buildDefaultStore();
  const s = maybe && typeof maybe === "object" ? maybe : {};

  const settings = {
    ...base.settings,
    ...(s.settings || {}),
    banner: { ...base.settings.banner, ...(s.settings?.banner || {}) },
    hero: { ...base.settings.hero, ...(s.settings?.hero || {}) },
  };

  const categories = Array.isArray(s.categories) && s.categories.length ? s.categories : base.categories;
  const products = Array.isArray(s.products) && s.products.length ? s.products : base.products;

  return { settings, categories, products };
}

function loadLocalStore() {
  if (typeof window === "undefined") return buildDefaultStore();
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return buildDefaultStore();
  return normalizeStore(safeParse(raw, null));
}

function saveLocalStore(store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function mapSettingsRow(siteRow, websiteRow) {
  const base = DEFAULT_SETTINGS;
  const r = siteRow || null;
  const w = websiteRow || null;

  const siteName =
    (w && (w.site_name ?? w.siteName ?? w.name ?? w.title)) ??
    (r && (r.site_name ?? r.siteName)) ??
    base.siteName;

  const whatsappRaw =
    (w && (w.whatsapp ?? w.whatsapp_number ?? w.whatsapp_phone ?? w.whatsappPhone)) ??
    (r && (r.whatsapp ?? r.whatsapp_number)) ??
    base.whatsapp ??
    "";

  const whatsapp = String(whatsappRaw || "").trim();

  return {
    siteName,
    whatsapp,
    banner: {
      enabled: r?.banner_enabled ?? base.banner.enabled,
      text: r?.banner_text ?? base.banner.text,
      buttonLabel: r?.banner_button_label ?? base.banner.buttonLabel,
      buttonHref: r?.banner_button_href ?? base.banner.buttonHref,
    },
    hero: {
      badgeText: r?.hero_badge_text ?? base.hero.badgeText,
      title: r?.hero_title ?? base.hero.title,
      subtitle: r?.hero_subtitle ?? base.hero.subtitle,
      primaryCtaLabel: r?.hero_primary_cta_label ?? base.hero.primaryCtaLabel,
      primaryCtaHref: r?.hero_primary_cta_href ?? base.hero.primaryCtaHref,
      secondaryCtaLabel: r?.hero_secondary_cta_label ?? base.hero.secondaryCtaLabel,
      secondaryCtaHref: r?.hero_secondary_cta_href ?? base.hero.secondaryCtaHref,
      mainProductId: r?.hero_main_product_id ?? null,
      sideProductId: r?.hero_side_product_id ?? null,
    },
  };
}

function settingsToRow(settings) {
  const s = settings || DEFAULT_SETTINGS;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const toUuidOrNull = (v) => {
    const str = String(v || "").trim();
    return UUID_RE.test(str) ? str : null;
  };
  return {
    id: 1,
    site_name: s.siteName,
    banner_enabled: Boolean(s.banner?.enabled),
    banner_text: s.banner?.text || "",
    banner_button_label: s.banner?.buttonLabel || "",
    banner_button_href: s.banner?.buttonHref || "",
    hero_badge_text: s.hero?.badgeText || "",
    hero_title: s.hero?.title || "",
    hero_subtitle: s.hero?.subtitle || "",
    hero_primary_cta_label: s.hero?.primaryCtaLabel || "",
    hero_primary_cta_href: s.hero?.primaryCtaHref || "",
    hero_secondary_cta_label: s.hero?.secondaryCtaLabel || "",
    hero_secondary_cta_href: s.hero?.secondaryCtaHref || "",
    hero_main_product_id: toUuidOrNull(s.hero?.mainProductId),
    hero_side_product_id: toUuidOrNull(s.hero?.sideProductId),
  };
}

function websiteSettingsToRow(settings, id) {
  const s = settings || DEFAULT_SETTINGS;
  const raw = String(s.whatsapp || "").trim();
  const phone = raw.replace(/[^0-9]/g, "");
  const row = {
    site_name: s.siteName,
    whatsapp: phone,
  };
  if (id !== undefined && id !== null) row.id = id;
  return row;
}

function mapCategoryRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    visible: row.visible !== false,
    sort_order: row.sort_order ?? 0,
  };
}

function mapProductRow(row) {
  const images = Array.isArray(row.images) ? row.images.filter(Boolean) : [];
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    category: row.category_slug || "",
    price: Number(row.price || 0),
    featured: Boolean(row.featured),
    visible: row.visible !== false,
    images,
    image: images[0] || "",
    sizes: Array.isArray(row.sizes) ? row.sizes.filter(Boolean) : [],
    stock: row.stock && typeof row.stock === "object" ? row.stock : {},
  };
}

export function StoreProvider({ children }) {
  const [store, setStore] = useState(() => (supabaseEnabled ? buildCloudStore() : loadLocalStore()));
  // Prevent “flash” of default settings in cloud mode (banner/hero briefly show defaults)
  const [isReady, setIsReady] = useState(() => !supabaseEnabled);
  const persistTimerRef = useRef(null);
  const websiteSettingsIdRef = useRef(null);

  const refreshFromSupabase = useCallback(async () => {
    if (!supabaseEnabled) return;

    const [{ data: sRow }, { data: wRow }, { data: catRows }, { data: prodRows }] = await Promise.all([
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("website_settings").select("*").limit(1).maybeSingle(),
      supabase.from("categories").select("id,slug,label,visible,sort_order").order("sort_order", { ascending: true }),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
    ]);

    if (wRow?.id !== undefined && wRow?.id !== null) websiteSettingsIdRef.current = wRow.id;

    setStore({
      settings: mapSettingsRow(sRow, wRow),
      categories: Array.isArray(catRows) ? catRows.map(mapCategoryRow) : [],
      products: Array.isArray(prodRows) ? prodRows.map(mapProductRow) : [],
    });
  }, []);

  // Initial load
  useEffect(() => {
    if (!supabaseEnabled) return;
    (async () => {
      try {
        await refreshFromSupabase();
      } catch (e) {
        console.error("Supabase refresh failed", e);
        setStore(buildCloudStore());
      } finally {
        // Defer ready flag one tick so store commits first (prevents default flash).
        setTimeout(() => setIsReady(true), 0);
      }
    })();
  }, [refreshFromSupabase]);

  // Demo mode: persist to localStorage
  useEffect(() => {
    if (supabaseEnabled) return;
    saveLocalStore(store);
  }, [store]);

  // Demo mode: cross-tab sync
  useEffect(() => {
    if (supabaseEnabled) return;
    const onStorage = (e) => {
      if (e.key !== KEY) return;
      setStore(normalizeStore(safeParse(e.newValue, null)));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const scheduleSettingsPersist = useCallback((nextSettings) => {
    if (!supabaseEnabled) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase.from("site_settings").upsert(settingsToRow(nextSettings), { onConflict: "id" });
        if (error) throw error;

        // Keep business settings (site name + WhatsApp number) in website_settings as well.
        const wsId = websiteSettingsIdRef.current;
        const wsPayload = websiteSettingsToRow(nextSettings, wsId ?? 1);
        const { error: wsError } = await supabase.from("website_settings").upsert(wsPayload, { onConflict: "id" });

        if (!wsError && wsPayload?.id !== undefined && wsPayload?.id !== null) {
          websiteSettingsIdRef.current = wsPayload.id;
        }

        // If website_settings is empty or doesn't use id=1, try a plain insert once.
        if (wsError && (wsId === undefined || wsId === null)) {
            const { data: created, error: createErr } = await supabase
              .from("website_settings")
              .insert(websiteSettingsToRow(nextSettings, null))
              .select("*")
              .maybeSingle();

          if (!createErr && created?.id !== undefined && created?.id !== null) {
            websiteSettingsIdRef.current = created.id;
          }
        }
      } catch (e) {
        console.error("Failed to save site_settings", e);
      }
    }, 350);
  }, []);

  const api = useMemo(() => {
    const settings = store.settings;

    async function saveSettingsNow() {
      if (!supabaseEnabled) return { ok: false, error: "Supabase not configured" };
      try {
        const { error } = await supabase.from("site_settings").upsert(settingsToRow(store.settings), { onConflict: "id" });
        if (error) throw error;

        try {
          const wsId = websiteSettingsIdRef.current;
          const wsPayload = websiteSettingsToRow(store.settings, wsId ?? 1);
          const { error: wsError } = await supabase.from("website_settings").upsert(wsPayload, { onConflict: "id" });
          if (!wsError && wsPayload?.id !== undefined && wsPayload?.id !== null) {
            websiteSettingsIdRef.current = wsPayload.id;
          }
          if (wsError && (wsId === undefined || wsId === null)) {
            const { data: created, error: createErr } = await supabase
              .from("site_settings")
              .insert(websiteSettingsToRow(store.settings, null))
              .select("*")
              .maybeSingle();
            if (!createErr && created?.id !== undefined && created?.id !== null) {
              websiteSettingsIdRef.current = created.id;
            }
          }
        } catch (e) {
          console.warn("Failed to save website_settings", e);
        }
        return { ok: true };
      } catch (e) {
        console.error("saveSettingsNow failed", e);
        return { ok: false, error: e?.message || "Failed to save" };
      }
    }

    function setSettings(partial) {
      setStore((prev) => {
        const next = normalizeStore({ settings: { ...prev.settings, ...(partial || {}) } });
        if (supabaseEnabled) scheduleSettingsPersist(next.settings);
        return next;
      });
    }

    function setBanner(partial) {
      setStore((prev) => {
        const nextSettings = {
          ...prev.settings,
          banner: { ...prev.settings.banner, ...(partial || {}) },
        };
        const next = { ...prev, settings: normalizeStore({ settings: nextSettings }).settings };
        if (supabaseEnabled) scheduleSettingsPersist(next.settings);
        return next;
      });
    }

    function setHero(partial) {
      setStore((prev) => {
        const nextSettings = {
          ...prev.settings,
          hero: { ...prev.settings.hero, ...(partial || {}) },
        };
        const next = { ...prev, settings: normalizeStore({ settings: nextSettings }).settings };
        if (supabaseEnabled) scheduleSettingsPersist(next.settings);
        return next;
      });
    }

    function upsertCategory(cat) {
      const next = { ...(cat || {}) };
      next.slug = String(next.slug || "").trim().toLowerCase();
      next.label = String(next.label || "").trim();
      if (!next.slug || !next.label) return;

      if (!supabaseEnabled) {
        setStore((prev) => {
          const exists = prev.categories.some((c) => c.slug === next.slug);
          const categories = exists
            ? prev.categories.map((c) => (c.slug === next.slug ? { ...c, ...next, id: next.slug } : c))
            : [...prev.categories, { id: next.slug, visible: true, ...next }];
          return { ...prev, categories };
        });
        return;
      }

      (async () => {
        try {
          await supabase
            .from("categories")
            .upsert(
              {
                slug: next.slug,
                label: next.label,
                visible: next.visible !== false,
                sort_order: Number(next.sort_order ?? 0),
              },
              { onConflict: "slug" }
            );
          await refreshFromSupabase();
        } catch (e) {
          console.error("upsertCategory failed", e);
        }
      })();
    }

    function deleteCategory(slug) {
      const s = String(slug || "").trim().toLowerCase();
      if (!s) return;

      if (!supabaseEnabled) {
        setStore((prev) => {
          // Local/demo mode: delete the category AND any products in it.
          const products = prev.products.filter((p) => String(p.category) !== s);
          const categories = prev.categories.filter((c) => c.slug !== s);
          return { ...prev, products, categories };
        });
        return;
      }

      (async () => {
        try {
          // Cloud mode: delete products in this category first, then delete the category.
          // (DB FK is ON DELETE SET NULL, but Baggo wants a cascade delete here.)
          { const { error } = await supabase.from("products").delete().eq("category_slug", s); if (error) throw error; }
          { const { error } = await supabase.from("categories").delete().eq("slug", s); if (error) throw error; }
          await refreshFromSupabase();
        } catch (e) {
          console.error("deleteCategory failed", e);
        }
      })();
    }

    async function upsertProduct(p) {
      const next = { ...(p || {}) };
      next.name = String(next.name || "").trim();
      next.category = String(next.category || "").trim().toLowerCase();
      next.price = Number(next.price || 0);
      next.featured = Boolean(next.featured);

      const images = Array.isArray(next.images)
        ? next.images
        : String(next.images || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
      next.images = images;
      next.image = images[0] || next.image || "";

      const sizes = Array.isArray(next.sizes)
        ? next.sizes
        : String(next.sizes || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      next.sizes = sizes;

      // Keep advanced per-image stock format intact if present.
      const rawStock = next.stock && typeof next.stock === "object" ? next.stock : {};
      if (rawStock && rawStock.__mode === "per_image") {
        next.stock = rawStock;
      } else {
        const stock = { ...(rawStock || {}) };
        sizes.forEach((s) => {
          const v = Number(stock[s] ?? 0);
          stock[s] = Number.isFinite(v) ? v : 0;
        });
        next.stock = stock;
      }

      if (!supabaseEnabled) {
        setStore((prev) => {
          const products = [...prev.products];
          const idStr = next.id !== undefined && next.id !== null ? String(next.id) : "";
          const idx = idStr ? products.findIndex((x) => String(x.id) === idStr) : -1;
          if (idx >= 0) {
            products[idx] = { ...products[idx], ...next };
            return { ...prev, products };
          }
          const newId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          products.push({ ...next, id: newId });
          return { ...prev, products };
        });
        return { ok: true };
      }

      try {
        const payload = {
          name: next.name,
          description: next.description || "",
          category_slug: next.category || null,
          price: next.price,
          featured: next.featured,
          visible: next.visible !== false,
          images: next.images || [],
          sizes: next.sizes || [],
          stock: next.stock || {},
        };

        if (next.id) {
          const { error } = await supabase.from("products").update(payload).eq("id", next.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("products").insert(payload);
          if (error) throw error;
        }

        await refreshFromSupabase();
        return { ok: true };
      } catch (e) {
        console.error("upsertProduct failed", e);
        return { ok: false, error: e?.message || "Failed to save product" };
      }
    }

    function deleteProduct(id) {
      const idStr = String(id || "");
      if (!idStr) return;

      if (!supabaseEnabled) {
        setStore((prev) => ({
          ...prev,
          products: prev.products.filter((p) => String(p.id) !== idStr),
        }));
        return;
      }

      (async () => {
        try {
          const { error } = await supabase.from("products").delete().eq("id", idStr);
          if (error) throw error;
          await refreshFromSupabase();
        } catch (e) {
          console.error("deleteProduct failed", e);
        }
      })();
    }

    function resetStore() {
      if (supabaseEnabled) {
        refreshFromSupabase().catch(() => {});
        return;
      }
      setStore(buildDefaultStore());
    }

    return {
      store,
      isReady,
      settings,
      banner: settings.banner,
      hero: settings.hero,
      categories: store.categories,
      products: store.products,
      setSettings,
      setBanner,
      setHero,
      saveSettingsNow,
      upsertCategory,
      deleteCategory,
      upsertProduct,
      deleteProduct,
      resetStore,
      // Helpful flag for UI
      supabaseEnabled,
      isReady,
    };
  }, [store, isReady, refreshFromSupabase, scheduleSettingsPersist]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
