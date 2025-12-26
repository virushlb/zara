import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useRef } from "react";
import { useStore } from "../context/StoreContext";
import SafeImage from "../components/SafeImage";

function SectionTitle({ title, actionLabel, actionHref }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-[var(--color-text)]">
          {title}
        </h2>
      </div>

      {actionLabel && actionHref ? (
        <Link
          to={actionHref}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function Quad({ title, subtitle, href, image }) {
  return (
    <Link
      to={href}
      className="group relative rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="aspect-[4/5] md:aspect-[3/4] overflow-hidden">
        <SafeImage src={image} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      </div>

      {/* soft overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0 pointer-events-none" />

      {/* label bottom-left */}
      <div className="absolute left-4 bottom-4">
        <div className="inline-flex flex-col gap-0.5 rounded-xl bg-black/55 backdrop-blur px-3 py-2">
          <span className="text-xs tracking-wide text-white/80">{subtitle}</span>
          <span className="text-base font-semibold text-white">{title}</span>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { products, categories, hero } = useStore();
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

  const featured = products.filter((p) => p.featured);
  const featuredList = (featured.length ? featured : products).slice(0, 8);

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
    <main className="bg-[var(--color-bg)]">
      <div className="max-w-7xl mx-auto px-6 md:px-10 pt-10 pb-16">
        {/* HERO */}
        <section className="rounded-3xl border border-[var(--color-border)] overflow-hidden bg-[linear-gradient(135deg,var(--color-surface),var(--color-surface-2))]">
          <div className="grid gap-10 md:grid-cols-2 items-center p-8 md:p-12">
            <div className="animate-[baggo-menu-reveal_320ms_ease-out]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                {hero?.badgeText || "New drop"}
              </div>

              <h1 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight text-[var(--color-text)] leading-tight whitespace-pre-line">
                {hero?.title || "Carry better. Shop Baggo."}
              </h1>

              <p className="mt-4 text-[var(--color-text-muted)] leading-7 max-w-xl">
                {hero?.subtitle || ""}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={hero?.primaryCtaHref || "/shop"}
                  className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold
                    bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-95 transition"
                >
                  {hero?.primaryCtaLabel || "Shop now"}
                </Link>
                <Link
                  to={hero?.secondaryCtaHref || "/shop"}
                  className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold
                    border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:bg-[var(--color-surface)] transition"
                >
                  {hero?.secondaryCtaLabel || "Explore"}
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
                <div className="aspect-[4/5] md:aspect-square">
                  <SafeImage src={heroMain?.image} alt={heroMain?.name || "Hero"} className="h-full w-full object-cover" />
                </div>

                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-3 py-1 text-xs text-white/85">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                  Featured
                </div>
              </div>

              {/* floating second image */}
              <div className="hidden md:block absolute -bottom-10 -left-10 w-40 rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
                <div className="aspect-[4/5]">
                  <SafeImage src={heroSide?.image} alt={heroSide?.name || "Preview"} className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* QUADS */}
        <section className="mt-14">
          <SectionTitle title="Collections" actionLabel="View all" actionHref="/shop" />
          <div className="mt-6 -mx-6 px-6 md:mx-0 md:px-0 relative">
            {/* scroll buttons */}
            <button
              type="button"
              onClick={() => scrollCollections(-1)}
              className="flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 z-10
                h-10 w-10 rounded-full border border-[var(--color-border)] bg-white/70 backdrop-blur
                text-[var(--color-text)] shadow-sm hover:bg-white/85 transition active:scale-95"
              aria-label="Scroll left"
            >
              <span className="text-xl leading-none">‹</span>
            </button>

            <button
              type="button"
              onClick={() => scrollCollections(1)}
              className="flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 z-10
                h-10 w-10 rounded-full border border-[var(--color-border)] bg-white/70 backdrop-blur
                text-[var(--color-text)] shadow-sm hover:bg-white/85 transition active:scale-95"
              aria-label="Scroll right"
            >
              <span className="text-xl leading-none">›</span>
            </button>

            <div
              ref={collectionsRef}
              className="hide-scrollbar flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2"
            >
              {quads.map((q) => (
                <div
                  key={q.title}
                  className="snap-start min-w-[78%] sm:min-w-[46%] md:min-w-[320px] lg:min-w-[360px]"
                >
                  <Quad {...q} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURED */}
        <section className="mt-14">
          <SectionTitle title="Featured products" actionLabel="Shop" actionHref="/shop" />
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            {featuredList.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}