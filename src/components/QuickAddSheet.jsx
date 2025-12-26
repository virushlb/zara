import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import SafeImage from "./SafeImage";
import { getImageMeta } from "../lib/imageMeta";
import { getBasePrice, getUnitPrice, hasDiscount } from "../lib/pricing";
import { getMaxStockFor, isPerImageStock } from "../lib/stock";

/**
 * Mobile quick-add bottom sheet ("Choose options") similar to Shein/Zara.
 * - Slides from bottom
 * - Shows product images, name, price
 * - Size selector
 * - Sticky Add to cart CTA
 */
export default function QuickAddSheet({
  open,
  product,
  initialVariantIndex = 0,
  onClose,
  onConfirm,
}) {
  const images = useMemo(() => {
    const arr = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
    if (arr.length) return arr;
    return product?.image ? [product.image] : [];
  }, [product]);

  const sizes = useMemo(() => {
    return Array.isArray(product?.sizes) ? product.sizes.filter(Boolean) : [];
  }, [product]);

  const perImage = isPerImageStock(product?.stock);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [error, setError] = useState("");
  const scrollerRef = useRef(null);
  const startYRef = useRef(null);
  const dragYRef = useRef(0);
  const sheetRef = useRef(null);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Initialize state on open
  useEffect(() => {
    if (!open) return;
    setError("");
    setSelectedSize("");
    const idx = Math.min(Math.max(Number(initialVariantIndex || 0), 0), Math.max(images.length - 1, 0));
    setActiveIndex(idx);

    // Snap to the initial image
    window.setTimeout(() => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({ left: idx * el.clientWidth, behavior: "instant" });
    }, 0);
  }, [open, initialVariantIndex, images.length]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (idx !== activeIndex) {
      setActiveIndex(idx);
      // If size becomes invalid for this image, clear it.
      if (selectedSize && perImage) {
        if (getMaxStockFor(product, selectedSize, idx) <= 0) {
          setSelectedSize("");
        }
      }
    }
  }

  function handleAdd() {
    if (sizes.length > 1 && !selectedSize) {
      setError("Please choose a size.");
      return;
    }
    const finalSize = sizes.length === 1 ? sizes[0] : selectedSize;
    const vIdx = perImage ? activeIndex : null;
    const imageUrl = images[activeIndex] || images[0] || product?.image || "";
    const meta = getImageMeta(product, perImage ? activeIndex : 0);

    onConfirm?.({
      size: finalSize,
      variantIndex: vIdx,
      imageUrl,
      meta,
    });
  }

  // Light swipe-down to close (feels native)
  function onTouchStart(e) {
    if (!open) return;
    startYRef.current = e.touches?.[0]?.clientY ?? null;
    dragYRef.current = 0;
  }

  function onTouchMove(e) {
    if (!open) return;
    const startY = startYRef.current;
    if (startY == null) return;
    const y = e.touches?.[0]?.clientY ?? startY;
    const dy = Math.max(0, y - startY);
    dragYRef.current = dy;
    const sheet = sheetRef.current;
    if (!sheet) return;
    // Only start dragging if the inner content is scrolled to top
    const scrollable = sheet.querySelector("[data-sheet-scroll]");
    const atTop = scrollable ? scrollable.scrollTop <= 0 : true;
    if (!atTop) return;
    sheet.style.transform = `translateY(${Math.min(120, dy)}px)`;
  }

  function onTouchEnd() {
    if (!open) return;
    const dy = dragYRef.current || 0;
    const sheet = sheetRef.current;
    if (sheet) sheet.style.transform = "";
    startYRef.current = null;
    dragYRef.current = 0;
    if (dy > 80) onClose?.();
  }

  if (!open || !product) return null;
  // Render in a portal so `position: fixed` is truly viewport-fixed.
  // This avoids the "half-screen side panel" bug when this component is
  // mounted inside a transformed/animated parent (e.g. a card with `transform`).
  if (typeof document === "undefined" || !document.body) return null;

  const meta = getImageMeta(product, perImage ? activeIndex : 0);

  const sheet = (
    <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true" aria-label="Choose options">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/45 baggo-backdrop-enter"
        onClick={() => onClose?.()}
        aria-label="Close"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] baggo-sheet-enter shadow-2xl"
        style={{ height: "88vh" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Handle */}
        <div className="pt-2 flex justify-center">
          <div className="h-1.5 w-12 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Header */}
        <div className="px-4 pt-3 pb-3 flex items-center justify-between gap-3 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight text-[var(--color-text)]">
              Choose options
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="h-9 w-9 grid place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] active:scale-[0.98]"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* Content */}
        <div
          data-sheet-scroll
          className="h-full overflow-auto pb-24"
        >
          {/* Image gallery */}
          <div className="px-4 pt-4">
            <div className="rounded-2xl overflow-hidden bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              <div
                ref={scrollerRef}
                onScroll={onScroll}
                className="flex overflow-x-auto snap-x snap-mandatory baggo-scroll"
              >
                {images.map((src, i) => (
                  <div key={src + i} className="min-w-full snap-center">
                    <div className="aspect-[4/3] bg-[var(--color-surface-2)]">
                      <SafeImage
                        src={src}
                        alt={product?.name || "Product"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Dots */}
              {images.length > 1 ? (
                <div className="py-2 flex items-center justify-center gap-1.5">
                  {images.map((_, i) => (
                    <span
                      key={i}
                      className={
                        "h-1.5 w-1.5 rounded-full transition-opacity " +
                        (i === activeIndex ? "opacity-100 bg-[var(--color-text)]" : "opacity-30 bg-[var(--color-text)]")
                      }
                      aria-hidden="true"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Product info */}
          <div className="px-4 pt-4">
            <p className="text-base font-semibold leading-tight">{product?.name}</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {hasDiscount(product) ? (
                <>
                  <span className="line-through opacity-70 mr-2">${getBasePrice(product)}</span>
                  <span className="text-[var(--color-text)] font-semibold">${getUnitPrice(product)}</span>
                </>
              ) : (
                <>${getUnitPrice(product)}</>
              )}
            </p>

            {/* Image-level name/description (if provided) */}
            {(meta?.name || meta?.description) ? (
              <div className="mt-2 text-sm text-[var(--color-text-muted)]">
                {meta?.name ? <div className="font-medium text-[var(--color-text)]">{meta.name}</div> : null}
                {meta?.description ? <div className="mt-0.5">{meta.description}</div> : null}
              </div>
            ) : null}
          </div>

          {/* Options */}
          {sizes.length ? (
            <div className="px-4 pt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Size</p>
                <Link
                  to={`/product/${product.id}`}
                  className="text-xs text-[var(--color-text-muted)] underline underline-offset-2"
                  onClick={() => onClose?.()}
                >
                  View details
                </Link>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {sizes.map((s) => {
                  const disabled = perImage
                    ? getMaxStockFor(product, s, activeIndex) <= 0
                    : getMaxStockFor(product, s, null) <= 0;
                  const active = selectedSize === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setError("");
                        setSelectedSize(s);
                      }}
                      className={
                        "h-11 rounded-full border text-sm transition-all baggo-tap " +
                        (active
                          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
                          : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)]") +
                        (disabled ? " opacity-40 cursor-not-allowed" : "")
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              {error ? <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p> : null}
            </div>
          ) : null}
        </div>

        {/* Sticky CTA */}
        <div className="absolute inset-x-0 bottom-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <button
            type="button"
            onClick={handleAdd}
            disabled={sizes.length > 1 && !selectedSize}
            className="w-full h-12 rounded-full bg-[var(--color-text)] text-[var(--color-surface)] font-semibold disabled:opacity-40 active:scale-[0.99] transition"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
