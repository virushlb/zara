import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFavorites } from "../context/FavoritesContext";
import { useCart } from "../context/CartContext";
import { getMaxStockFor, hasAnyStock, isPerImageStock, pickFirstInStock } from "../lib/stock";
import SafeImage from "./SafeImage";
import Modal from "./Modal";
import QuickAddSheet from "./QuickAddSheet";
import { getImageMeta } from "../lib/imageMeta";
import { getUnitPrice, hasDiscount, getBasePrice } from "../lib/pricing";

export default function ProductCard({ product }) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const { addToCart } = useCart();
  const liked = isFavorite(product.id);

  // Quick add:
  // - legacy: first in-stock size
  // - per-image: first (variant,size) pair with stock
  const quickPick = useMemo(() => pickFirstInStock(product), [product]);
  const outOfStock = useMemo(() => !hasAnyStock(product), [product]);

  const [added, setAdded] = useState(false);
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  const [sizeSheetOpen, setSizeSheetOpen] = useState(false);
  const [modalSize, setModalSize] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const addedTimerRef = useRef(null);

  useEffect(() => {
    // Mobile detection (used for quick-add UX)
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(Boolean(mq.matches));
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) {
        window.clearTimeout(addedTimerRef.current);
      }
    };
  }, []);

  function handleQuickAdd(e) {
    e.preventDefault();
    e.stopPropagation();

    if (outOfStock) return;

    const sizes = Array.isArray(product?.sizes) ? product.sizes.filter(Boolean) : [];
    // If multiple sizes exist, require the user to choose one.
    // We open a quick modal instead of silently failing.
    if (sizes.length > 1) {
      setModalSize("");
      // Desktop: center modal
      // Mobile: full product bottom sheet (Shein-like)
      if (isMobile) setSizeSheetOpen(true);
      else setSizeModalOpen(true);
      return;
    }

    const finalSize = sizes.length === 1 ? sizes[0] : quickPick.size;
    const vIdx = quickPick.variantIndex ?? null;
    const imgUrl = quickPick.image || product.image;
    const meta = getImageMeta(product, isPerImageStock(product?.stock) ? Number(vIdx || 0) : 0);

    addToCart({
      ...product,
      size: finalSize,
      variantIndex: vIdx,
      image: imgUrl,
      imageName: meta.name,
      imageDescription: meta.description,
      imageIndex: meta.index,
    });

    setAdded(true);
    if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <div className="relative baggo-card group">
      {/* Favorite */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(product);
        }}
        className="absolute top-2 right-2 z-20 text-lg baggo-tap transition-opacity md:opacity-0 md:group-hover:opacity-100"
        aria-label={liked ? "Remove from favorites" : "Add to favorites"}
      >
        {liked ? "❤️" : "🤍"}
      </button>

      {/* Image (with overlay link) */}
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] transition-colors duration-300 group-hover:border-[var(--color-text)]/15">
        <SafeImage src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]" />

        {/* Click anywhere on the image to open product */}
        <Link
          to={`/product/${product.id}`}
          className="absolute inset-0 z-10"
          aria-label={`Open ${product.name}`}
        />

        {/* Quick add (+) */}
        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={outOfStock}
          aria-label={outOfStock ? "Out of stock" : "Add to cart"}
          className={
            "absolute bottom-3 right-3 z-20 grid place-items-center h-11 w-11 rounded-full " +
            "border border-[var(--color-border)] bg-[var(--color-surface-2)]/90 backdrop-blur " +
            "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] baggo-tap " +
            "md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 " +
            (outOfStock ? "opacity-45 cursor-not-allowed" : "") +
            (added ? " animate-baggo-pop" : "")
          }
        >
          {/* ping ring */}
          {added && (
            <span
              className="absolute inset-0 rounded-full border border-[var(--color-success)] opacity-60 animate-ping"
              aria-hidden="true"
            />
          )}

          {/* plus / check swap */}
          <span
            className={
              "relative text-xl leading-none font-semibold select-none transition-all duration-200 " +
              (added ? "opacity-0 scale-75" : "opacity-100 scale-100")
            }
            aria-hidden="true"
          >
            +
          </span>
          <span
            className={
              "absolute text-lg font-semibold select-none transition-all duration-200 " +
              (added ? "opacity-100 scale-100" : "opacity-0 scale-75")
            }
            aria-hidden="true"
          >
            ✓
          </span>
        </button>
      </div>

      {/* Info */}
      <Link to={`/product/${product.id}`} className="block mt-2">
        <p className="text-sm font-medium leading-tight">{product.name}</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {hasDiscount(product) ? (
            <>
              <span className="line-through opacity-70 mr-2">${getBasePrice(product)}</span>
              <span className="text-[var(--color-text)] font-medium">${getUnitPrice(product)}</span>
            </>
          ) : (
            <>${getUnitPrice(product)}</>
          )}
        </p>
      </Link>

      {/* Quick-add size picker (only when product has multiple sizes) */}
      <QuickAddSheet
        open={sizeSheetOpen}
        product={product}
        initialVariantIndex={isPerImageStock(product?.stock) ? Number(quickPick.variantIndex ?? 0) : 0}
        onClose={() => setSizeSheetOpen(false)}
        onConfirm={({ size, variantIndex, imageUrl, meta }) => {
          if (!size) return;
          addToCart({
            ...product,
            size,
            variantIndex,
            image: imageUrl,
            imageName: meta?.name,
            imageDescription: meta?.description,
            imageIndex: meta?.index,
          });

          setSizeSheetOpen(false);
          setAdded(true);
          if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
          addedTimerRef.current = window.setTimeout(() => setAdded(false), 1200);
        }}
      />

      <Modal
        open={sizeModalOpen}
        title="Choose options"
        onClose={() => setSizeModalOpen(false)}
        widthClass="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSizeModalOpen(false)}
              className="rounded-full px-4 py-2 text-sm border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!modalSize) return;

                // Pick a variant that has stock for the chosen size (per-image mode)
                let vIdx = null;
                let imgUrl = (product?.images || [product?.image]).filter(Boolean)[0] || "";
                if (isPerImageStock(product?.stock)) {
                  const imgs = Array.isArray(product?.images) ? product.images : [];
                  let found = 0;
                  for (let i = 0; i < Math.max(1, imgs.length); i++) {
                    if (getMaxStockFor(product, modalSize, i) > 0) {
                      found = i;
                      break;
                    }
                  }
                  vIdx = found;
                  imgUrl = imgs[found] || imgs[0] || product.image || "";
                }

                const meta = getImageMeta(product, isPerImageStock(product?.stock) ? Number(vIdx || 0) : 0);

                addToCart({
                  ...product,
                  size: modalSize,
                  variantIndex: vIdx,
                  image: imgUrl,
                  imageName: meta.name,
                  imageDescription: meta.description,
                  imageIndex: meta.index,
                });

                setSizeModalOpen(false);
                setAdded(true);
                if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
                addedTimerRef.current = window.setTimeout(() => setAdded(false), 1200);
              }}
              disabled={!modalSize}
              className="rounded-full px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)] disabled:opacity-40 transition active:scale-[0.99]"
            >
              Add to cart
            </button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-text-muted)]">
          Select a size to add <span className="font-medium text-[var(--color-text)]">{product.name}</span> to your cart.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(product?.sizes || []).map((s) => {
            const disabled =
              isPerImageStock(product?.stock)
                ? // Any variant with stock for this size?
                  !Array.from({ length: (product?.images || []).length || 1 }).some((_, i) =>
                    getMaxStockFor(product, s, i) > 0
                  )
                : getMaxStockFor(product, s, null) <= 0;
            return (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => setModalSize(s)}
                className={
                  "px-4 py-2 rounded-full text-sm border transition-all active:scale-[0.98] " +
                  (modalSize === s
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-text)]/30") +
                  (disabled ? " opacity-40 cursor-not-allowed" : "")
                }
              >
                {s}
              </button>
            );
          })}
        </div>

        {!modalSize ? (
          <p className="mt-3 text-xs text-[var(--color-danger)]">Please choose a size.</p>
        ) : null}
      </Modal>
    </div>
  );
}