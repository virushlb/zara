import ProductCard from "../components/ProductCard";
import Modal from "../components/Modal";
import Container from "../layout/Container";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { getUnitPrice } from "../lib/pricing";
import { isCategoryUnlocked, unlockCategoryWithPassword } from "../lib/secretAccess";

export default function Shop() {
  const { products, categories: storeCategories } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const categories = useMemo(() => {
    const visible = (storeCategories || []).filter((c) => c.visible !== false);
    return [
      { label: "All", value: "all" },
      ...visible.map((c) => ({
        label: `${c.label || c.slug}${c.category_type === "secret" ? " 🔒" : ""}`,
        value: c.slug,
      })),
    ];
  }, [storeCategories]);

  const useCategoryDropdown = useMemo(() => {
    // Excluding "All" — if there are more than 5 real categories, switch to dropdown for a cleaner UI.
    return Math.max(0, (categories?.length || 0) - 1) > 5;
  }, [categories]);

  const prices = products.map((p) => Number(getUnitPrice(p) || 0));
  const minRange = Math.min(50, ...prices);
  const maxRange = Math.max(200, ...prices);

  const [category, setCategory] = useState("all");
  const [maxPrice, setMaxPrice] = useState(maxRange);
  const [sort, setSort] = useState("default");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Secret categories
  const [secretModal, setSecretModal] = useState({ open: false, slug: "", label: "" });
  const [secretPassword, setSecretPassword] = useState("");
  const [secretError, setSecretError] = useState("");
  const [secretBusy, setSecretBusy] = useState(false);

  useEffect(() => {
    setMaxPrice((prev) => Math.max(prev, maxRange));
  }, [maxRange]);

  const PAGE_SIZE = 16; // 15–20 per page

  const rangePct = useMemo(() => {
    if (maxRange <= minRange) return 100;
    return Math.round(((maxPrice - minRange) / (maxRange - minRange)) * 100);
  }, [maxPrice, minRange, maxRange]);

  // Allow /shop?category=bags (used by Home)
  useEffect(() => {
    const c = (searchParams.get("category") || "").toLowerCase();
    if (!c) return;
    const ok = categories.some((x) => x.value === c);
    if (ok) setCategory(c);
  }, [searchParams, categories]);

  const selectedCategoryMeta = useMemo(() => {
    return (storeCategories || []).find((c) => c.slug === category) || null;
  }, [storeCategories, category]);

  const isLocked =
    category !== "all" &&
    selectedCategoryMeta?.category_type === "secret" &&
    !isCategoryUnlocked(category);

  // If user lands on a secret category (or selects one), ask for the password.
  useEffect(() => {
    if (!isLocked) return;
    setSecretModal({ open: true, slug: category, label: selectedCategoryMeta?.label || category });
    setSecretError("");
    setSecretPassword("");
  }, [isLocked, category, selectedCategoryMeta]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [category, maxPrice, sort, search]);

  const filteredProducts = useMemo(() => {
    if (isLocked) return [];
    let result = [...products].filter((p) => {
      const matchesCategory = category === "all" || p.category === category;
      const matchesPrice = Number(getUnitPrice(p) || 0) <= maxPrice;
      const matchesSearch = String(p.name || "")
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesCategory && matchesPrice && matchesSearch;
    });

    if (sort === "low") result.sort((a, b) => getUnitPrice(a) - getUnitPrice(b));
    if (sort === "high") result.sort((a, b) => getUnitPrice(b) - getUnitPrice(a));

    return result;
  }, [category, maxPrice, sort, search, products, isLocked]);

  const total = filteredProducts.length;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(total, startIndex + PAGE_SIZE);

  const pagedProducts = useMemo(() => {
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, startIndex, endIndex]);

  const pageButtons = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const buttons = new Set([1, totalPages, safePage]);
    if (safePage - 1 >= 1) buttons.add(safePage - 1);
    if (safePage + 1 <= totalPages) buttons.add(safePage + 1);

    const sorted = Array.from(buttons).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < sorted.length; i++) {
      out.push(sorted[i]);
      const next = sorted[i + 1];
      if (next && next - sorted[i] > 1) out.push("…");
    }
    return out;
  }, [totalPages, safePage]);

  async function handleUnlockSecret() {
    if (!secretModal.slug) return;
    setSecretBusy(true);
    setSecretError("");
    try {
      const ok = await unlockCategoryWithPassword({ slug: secretModal.slug, password: secretPassword });
      if (!ok) {
        setSecretError("Wrong password. Try again.");
        return;
      }
      setSecretModal({ open: false, slug: "", label: "" });
      setSecretPassword("");
    } catch (e) {
      setSecretError("Couldn't unlock this collection. Please try again.");
    } finally {
      setSecretBusy(false);
    }
  }

  function handleCancelSecret() {
    setSecretModal({ open: false, slug: "", label: "" });
    setSecretPassword("");
    setSecretError("");
    setSecretBusy(false);
    // If the user landed via /shop?category=..., remove it so the modal doesn't pop back.
    const next = new URLSearchParams(searchParams);
    next.delete("category");
    setSearchParams(next);
    setCategory("all");
  }

  return (
    <Container>
      {/* On mobile, keep the top spacing clean (not massive). */}
      <div className="pt-8 pb-16 sm:py-16">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-6">
          <h1 className="text-3xl font-semibold">Shop</h1>

          {/* Search */}
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Categories: buttons (<=5) or dropdown (>5) */}
          {useCategoryDropdown ? (
            <div className="relative w-full max-w-xs">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="baggo-select"
                aria-label="Category"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M7 10l5 5 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              {categories.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-4 py-2 rounded-full text-sm transition ${
                    category === c.value
                      ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Price */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text-muted)]">Max price:</span>
              <input
                type="range"
                min={minRange}
                max={maxRange}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="baggo-range w-44"
                style={{ "--baggo-range-pct": `${rangePct}%` }}
              />
              <span className="text-sm font-medium">${maxPrice}</span>
            </div>

            {/* Sort */}
            <div className="relative w-full sm:w-[260px]">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="baggo-select"
                aria-label="Sort"
              >
                <option value="default">Sort</option>
                <option value="low">Price: Low → High</option>
                <option value="high">Price: High → Low</option>
              </select>

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {isLocked ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text)]">
            This collection is private. Enter the password to view it.
          </div>
        ) : null}

        <p className="text-sm text-[var(--color-text-muted)]">
          {total === 0
            ? "Showing 0 results"
            : `Showing ${startIndex + 1}–${endIndex} of ${total} result${total !== 1 ? "s" : ""}`}
        </p>

        {/* Products */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {pagedProducts.map((product, idx) => (
            <div key={product.id} className="baggo-reveal" style={{ "--baggo-delay": `${Math.min(idx, 12) * 35}ms` }}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <p className="mt-10 text-[var(--color-text-muted)]">No products found for “{search}”.</p>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm disabled:opacity-50"
            >
              Prev
            </button>

            {pageButtons.map((b, idx) =>
              b === "…" ? (
                <span key={`dots-${idx}`} className="px-2 text-[var(--color-text-muted)]">
                  …
                </span>
              ) : (
                <button
                  key={b}
                  onClick={() => setPage(Number(b))}
                  className={`min-w-[40px] px-3 py-2 rounded-lg text-sm border transition ${
                    safePage === b
                      ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
                      : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  {b}
                </button>
              )
            )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <Modal
        open={secretModal.open}
        title={`Private collection${secretModal.label ? `: ${secretModal.label}` : ""}`}
        onClose={handleCancelSecret}
        widthClass="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelSecret}
              className="rounded-lg px-4 py-2 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUnlockSecret}
              disabled={secretBusy || !secretPassword.trim()}
              className="rounded-lg px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)] disabled:opacity-50"
            >
              {secretBusy ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-text-muted)]">
          Enter the password to view this category.
        </p>

        <input
          type="password"
          value={secretPassword}
          onChange={(e) => setSecretPassword(e.target.value)}
          placeholder="Password"
          className="mt-3 w-full border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />

        {secretError ? <p className="mt-3 text-sm text-red-600">{secretError}</p> : null}
      </Modal>
    </Container>
  );
}
