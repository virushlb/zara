import { Link } from "react-router-dom";
import { useMemo, useRef } from "react";
import ProductCard from "../components/ProductCard";
import SafeImage from "../components/SafeImage";
import { useStore } from "../context/StoreContext";
import { getUnitPrice } from "../lib/pricing";
import { isCategoryUnlocked } from "../lib/secretAccess";

function SectionTitle({ title, actionLabel, actionHref }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="flex items-center gap-4">
        <div className="hidden sm:block h-px w-8 bg-[var(--color-border)]" />
        <h2 className="font-display text-2xl md:text-3xl tracking-tight text-[var(--color-text)]">{title}</h2>
      </div>

      {actionLabel && actionHref ? (
        <Link
          to={actionHref}
          className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function Collage({ images, fallback, alt }) {
  const imgs = (images || []).filter(Boolean).slice(0, 4);

  // Only build a 2×2 collage when we actually have 4 slots.
  if (imgs.length >= 4) {
    return (
      <div className="grid grid-cols-2 gap-1.5 h-full w-full">
        {imgs.slice(0, 4).map((src, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-[var(--color-surface-2)]">
            <SafeImage src={src} alt={alt || ""} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  if (imgs.length === 3) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-1.5 h-full w-full">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-[var(--color-surface-2)]">
            {i < 3 ? (
              <SafeImage src={imgs[i]} alt={alt || ""} className="h-full w-full object-cover" />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (imgs.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1.5 h-full w-full">
        {imgs.map((src, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-[var(--color-surface-2)]">
            <SafeImage src={src} alt={alt || ""} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  return <SafeImage src={imgs[0] || fallback} alt={alt || ""} className="h-full w-full object-cover" />;
}

function LuxuryQuad({ href, title, subtitle, images, fallbackImage, delayMs = 0 }) {
  return (
    <Link
      to={href}
      style={{ animationDelay: `${delayMs}ms` }}
      className="group relative overflow-hidden rounded-[2rem] border border-[rgba(17,24,39,0.10)] bg-[var(--color-surface-2)] shadow-[0_20px_60px_rgba(0,0,0,0.07)] transition-transform duration-500 hover:-translate-y-1 active:translate-y-0 lux-reveal"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(900px_260px_at_20%_0%,rgba(255,255,255,0.50),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[linear-gradient(110deg,rgba(255,255,255,0)_35%,rgba(255,255,255,0.22)_50%,rgba(255,255,255,0)_65%)] translate-x-[-40%] group-hover:translate-x-[40%] transform duration-1000" />
      </div>

      <div className="aspect-[4/5] md:aspect-[3/4] overflow-hidden">
        <div className="h-full w-full transition-transform duration-700 group-hover:scale-[1.04]">
          <Collage images={images} fallback={fallbackImage} alt={title} />
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/0 pointer-events-none" />

      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            {subtitle ? (
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/75">{subtitle}</div>
            ) : null}
            <div className="mt-1 font-display text-lg sm:text-xl leading-tight text-white">{title}</div>
          </div>

          <div className="h-10 w-10 shrink-0 rounded-full border border-white/20 bg-black/20 backdrop-blur flex items-center justify-center text-white/85 transition group-hover:bg-white/10">
            <span className="text-lg leading-none">↗</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function LegacyCollections({ products, categories, hero }) {
  const collectionsRef = useRef(null);

  const scrollCollections = (dir) => {
    const el = collectionsRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.85);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  const byId = (id) => products.find((p) => String(p.id) === String(id));
  const heroMain = hero?.mainProductId ? byId(hero.mainProductId) : products[0];
  const heroSide = hero?.sideProductId ? byId(hero.sideProductId) : products[1] || products[0];

  const visibleCats = (categories || []).filter((c) => c.visible !== false);
  const firstTwo = visibleCats.slice(0, 2);

  const quads = [
    ...firstTwo.map((c) => ({
      title: c.label,
      subtitle: "Category",
      href: `/shop?category=${c.slug}`,
      image: products.find((p) => p.category === c.slug)?.image || heroMain?.image,
    })),
    {
      title: "Shop All",
      subtitle: "Explore",
      href: "/shop",
      image: heroSide?.image || heroMain?.image,
    },
    {
      title: "Favorites",
      subtitle: "Saved",
      href: "/favorites",
      image: heroMain?.image,
    },
  ];

  return (
    <>
      {/* Legacy hero (kept for demo / older DBs) */}
      <section className="rounded-[2.75rem] border border-[rgba(17,24,39,0.10)] overflow-hidden bg-[linear-gradient(135deg,var(--color-surface),var(--color-surface-2))] shadow-[0_28px_70px_rgba(0,0,0,0.06)]">
        <div className="grid gap-10 md:grid-cols-2 items-center p-8 md:p-12">
          <div className="lux-reveal">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
              {hero?.badgeText || "New drop"}
            </div>

            <h1 className="mt-6 font-display text-4xl md:text-6xl tracking-tight text-[var(--color-text)] leading-[1.02] whitespace-pre-line">
              {hero?.title || "Discover the new season."}
            </h1>

            <p className="mt-4 text-[var(--color-text-muted)] leading-7 max-w-xl">{hero?.subtitle || ""}</p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={hero?.primaryCtaHref || "/shop"}
                className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-95 transition"
              >
                {hero?.primaryCtaLabel || "Shop now"}
              </Link>
              <Link
                to={hero?.secondaryCtaHref || "/shop"}
                className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:bg-[var(--color-surface)] transition"
              >
                {hero?.secondaryCtaLabel || "Explore"}
              </Link>
            </div>
          </div>

          <div className="relative lux-reveal" style={{ animationDelay: "120ms" }}>
            <div className="relative rounded-[2.5rem] overflow-hidden border border-[rgba(17,24,39,0.10)] bg-[var(--color-surface-2)] shadow-[0_26px_80px_rgba(0,0,0,0.08)]">
              <div className="aspect-[4/5] md:aspect-square">
                <SafeImage src={heroMain?.image} alt={heroMain?.name || "Hero"} className="h-full w-full object-cover" />
              </div>

              <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-3 py-1 text-xs text-white/85">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                Featured
              </div>
            </div>

            <div className="hidden md:block absolute -bottom-10 -left-10 w-44 rounded-[2rem] overflow-hidden border border-[rgba(17,24,39,0.10)] bg-[var(--color-surface-2)] shadow-[0_18px_60px_rgba(0,0,0,0.06)]">
              <div className="aspect-[4/5]">
                <SafeImage src={heroSide?.image} alt={heroSide?.name || "Preview"} className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Legacy collections */}
      <section className="mt-14">
        <SectionTitle title="Collections" actionLabel="View all" actionHref="/shop" />
        <div className="mt-6 -mx-6 px-6 md:mx-0 md:px-0 relative">
          <button
            type="button"
            onClick={() => scrollCollections(-1)}
            className="flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full border border-[var(--color-border)] bg-white/70 backdrop-blur text-[var(--color-text)] shadow-sm hover:bg-white/85 transition active:scale-95"
            aria-label="Scroll left"
          >
            <span className="text-xl leading-none">‹</span>
          </button>

          <button
            type="button"
            onClick={() => scrollCollections(1)}
            className="flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full border border-[var(--color-border)] bg-white/70 backdrop-blur text-[var(--color-text)] shadow-sm hover:bg-white/85 transition active:scale-95"
            aria-label="Scroll right"
          >
            <span className="text-xl leading-none">›</span>
          </button>

          <div ref={collectionsRef} className="hide-scrollbar flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
            {quads.map((q) => (
              <div key={q.title} className="snap-start min-w-[78%] sm:min-w-[46%] md:min-w-[320px] lg:min-w-[360px]">
                <Link
                  to={q.href}
                  className="group relative rounded-[2rem] overflow-hidden border border-[rgba(17,24,39,0.10)] bg-[var(--color-surface-2)] shadow-[0_18px_55px_rgba(0,0,0,0.06)]"
                >
                  <div className="aspect-[4/5] md:aspect-[3/4] overflow-hidden">
                    <SafeImage
                      src={q.image}
                      alt={q.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0 pointer-events-none" />
                  <div className="absolute left-5 bottom-5">
                    <div className="inline-flex flex-col gap-0.5 rounded-2xl bg-black/50 backdrop-blur px-4 py-3">
                      <span className="text-[11px] uppercase tracking-[0.26em] text-white/75">{q.subtitle}</span>
                      <span className="font-display text-lg text-white">{q.title}</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default function Home() {
  const { products, categories, hero, homeHeroes } = useStore();

  const secretSlugs = useMemo(() => {
    return new Set(
      (categories || [])
        .filter((c) => String(c.category_type || "normal") === "secret")
        .map((c) => String(c.slug || "").toLowerCase())
        .filter(Boolean)
    );
  }, [categories]);

  const publicProducts = useMemo(() => {
    return (products || []).filter((p) => {
      const cat = String(p.category || "").toLowerCase();
      if (!secretSlugs.has(cat)) return true;
      return isCategoryUnlocked(cat);
    });
  }, [products, secretSlugs]);

  const featured = useMemo(() => {
    const arr = (publicProducts || []).filter((p) => p.featured);
    return (arr.length ? arr : publicProducts || []).slice(0, 8);
  }, [publicProducts]);

  const productById = useMemo(() => {
    const m = new Map();
    (publicProducts || []).forEach((p) => m.set(String(p.id), p));
    return m;
  }, [publicProducts]);

  const categoryByIdOrSlug = useMemo(() => {
    const m = new Map();
    (categories || []).forEach((c) => {
      m.set(String(c.id), c);
      m.set(String(c.slug), c);
    });
    return m;
  }, [categories]);

  const activeHeroes = useMemo(() => {
    const arr = Array.isArray(homeHeroes) ? homeHeroes : [];
    return arr
      .filter((h) => h && h.is_active !== false && String(h.image_url || "").trim())
      .slice()
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  }, [homeHeroes]);

  function resolveCategory(quad) {
    const key = quad?.category_id ? String(quad.category_id) : "";
    if (!key) return null;
    return categoryByIdOrSlug.get(key) || null;
  }

  function resolveQuadView(quad) {
    const qType = String(quad?.quad_type || "editorial");

    if (qType === "product") {
      const p = quad?.product_id ? productById.get(String(quad.product_id)) : null;
      if (!p) {
        return {
          href: "/shop",
          title: quad?.title || "Product",
          subtitle: "Product",
          images: [quad?.image_url].filter(Boolean),
        };
      }
      return {
        href: `/product/${p.id}`,
        title: quad?.title || p.name,
        subtitle: `Product • $${getUnitPrice(p)}`,
        images: [p.image || (p.images || [])[0] || quad?.image_url].filter(Boolean),
      };
    }

    // category/editorial => category page
    const cat = resolveCategory(quad);
    const slug = cat?.slug || "";
    const href = slug ? `/shop?category=${slug}` : "/shop";

    const mode = String(quad?.product_mode || "auto");
    const fromManual = (quad?.manual_product_ids || [])
      .map((id) => productById.get(String(id)))
      .filter(Boolean);

    const auto = slug
      ? (publicProducts || []).filter((p) => String(p.category) === slug).slice(0, 6)
      : [];

    const chosen = mode === "manual" ? fromManual : auto;
    const images = [
      quad?.image_url,
      ...chosen.map((p) => p.image).filter(Boolean),
      ...(chosen.flatMap((p) => p.images || []).filter(Boolean)),
    ].filter(Boolean);

    return {
      href,
      title: quad?.title || cat?.label || slug || "Collection",
      subtitle: qType === "editorial" ? "Editorial" : mode === "manual" ? "Curated" : "Collection",
      images,
    };
  }

  return (
    <main className="bg-[var(--color-bg)] relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-48 -left-48 h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.10),rgba(15,23,42,0))] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-56 -right-56 h-[760px] w-[760px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.08),rgba(15,23,42,0))] blur-3xl" />
      <div className="max-w-7xl mx-auto px-6 md:px-10 pt-8 pb-16">
        {activeHeroes.length ? (
          <div className="space-y-14">
            {activeHeroes.map((h, idx) => (
              <section
                key={h.id}
                className="rounded-[2.75rem] overflow-hidden border border-[rgba(17,24,39,0.10)] bg-[var(--color-surface-2)] shadow-[0_34px_90px_rgba(0,0,0,0.07)]"
              >
                {/* Big image */}
                <div className="relative">
                  {/* Editorial hero frame (avoid "cut" feeling + preserve text breathing room) */}
                  <div className="relative h-[68vh] sm:h-[76vh] lg:h-[84vh] min-h-[480px] sm:min-h-[560px] lg:min-h-[640px] max-h-[900px] overflow-hidden">
                    <SafeImage
                      src={h.image_url}
                      alt={h.title || "Hero"}
                      className="h-full w-full object-cover object-[50%_35%] lux-kenburns"
                    />
                  </div>

                  {/* Vignette / editorial overlays */}
                  <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(900px_420px_at_20%_15%,rgba(255,255,255,0.10),rgba(255,255,255,0))]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-black/0 pointer-events-none" />

                  {(h.title || h.subtitle) ? (
                    <div
                      className="absolute left-6 bottom-12 sm:left-10 sm:bottom-16 max-w-2xl lux-reveal"
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      <div className="text-[11px] uppercase tracking-[0.30em] text-white/70">
                        Collection
                      </div>
                      {h.title ? (
                        <h1 className="mt-3 font-display text-3xl sm:text-4xl md:text-6xl leading-[1.02] tracking-tight text-white">
                          {h.title}
                        </h1>
                      ) : null}
                      {h.subtitle ? (
                        <p className="mt-3 text-sm sm:text-base text-white/85 leading-relaxed max-w-xl">
                          {h.subtitle}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {/* subtle cue */}
                  <div className="absolute right-6 bottom-12 sm:right-10 sm:bottom-16 hidden sm:flex items-center gap-3 text-white/75 pointer-events-none lux-reveal" style={{ animationDelay: `${idx * 80 + 140}ms` }}>
                    <span className="text-[11px] uppercase tracking-[0.30em]">Explore</span>
                    <span className="h-px w-10 bg-white/35" />
                  </div>
                </div>

                {/* 4 quads */}
                <div className="relative mt-0 p-4 sm:p-7 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))] backdrop-blur border-t border-[rgba(17,24,39,0.10)]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-7">
                    {(h.quads || []).slice(0, 4).map((q, qi) => {
                      const view = resolveQuadView(q);
                      return (
                        <LuxuryQuad
                          key={`${h.id}-${q.position}`}
                          href={view.href}
                          title={view.title}
                          subtitle={view.subtitle}
                          images={view.images}
                          fallbackImage={h.image_url}
                          delayMs={idx * 80 + 220 + qi * 70}
                        />
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            <div className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-sm lux-reveal">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">Homepage builder is ready</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    No fashion heroes have been created yet. Add your first hero (big image + 4 quads) from the Admin.
                  </p>
                </div>
                <Link
                  to="/admin"
                  className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-95 transition"
                >
                  Go to Admin → Home
                </Link>
              </div>
            </div>

            <LegacyCollections products={publicProducts || []} categories={categories || []} hero={hero} />
          </div>
        )}

        {/* Featured */}
        <section className="mt-16">
          <SectionTitle title="Featured products" actionLabel="Shop" actionHref="/shop" />
          <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-6">
            {featured.map((p, i) => (
              <div key={p.id} className="lux-reveal" style={{ animationDelay: `${220 + i * 50}ms` }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
