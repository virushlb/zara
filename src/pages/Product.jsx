import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { useCart } from "../context/CartContext";
import Container from "../layout/Container";
import ProductCard from "../components/ProductCard";
import Modal from "../components/Modal";
import { isCategoryUnlocked, unlockCategoryWithPassword } from "../lib/secretAccess";
import { getMaxStockFor, isPerImageStock, hasAnyStock } from "../lib/stock";
import { getImageIndex, getImageMeta } from "../lib/imageMeta";
import SafeImage from "../components/SafeImage";
import { getUnitPrice, hasDiscount, getBasePrice } from "../lib/pricing";

function Pill({ active, children, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-2 rounded-full text-sm border transition-all active:scale-[0.98] ${
        active
          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
          : "bg-[var(--color-surface-2)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-text)]/30"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

export default function Product() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { products, categories } = useStore();
  const navigate = useNavigate();

  const product = products.find((item) => String(item.id) === String(id));

  // Secret category lock (prevents direct URL access)
  const categoryMeta = useMemo(() => {
    if (!product) return null;
    return (categories || []).find((c) => String(c.slug) === String(product.category)) || null;
  }, [categories, product]);

  const isLocked = Boolean(
    product &&
      categoryMeta &&
      String(categoryMeta.category_type || "normal") === "secret" &&
      !isCategoryUnlocked(product.category)
  );

  const [secretOpen, setSecretOpen] = useState(false);
  const [secretPassword, setSecretPassword] = useState("");
  const [secretError, setSecretError] = useState("");
  const [secretBusy, setSecretBusy] = useState(false);

  useEffect(() => {
    if (isLocked) setSecretOpen(true);
  }, [isLocked]);

  const sizes = useMemo(() => product?.sizes || [], [product]);
  const images = useMemo(
    () => (product?.images?.length ? product.images : product?.image ? [product.image] : []),
    [product]
  );

  const [selectedSize, setSelectedSize] = useState("");
  const [sizeError, setSizeError] = useState(false);
  const [activeImg, setActiveImg] = useState("");
  const [variantIndex, setVariantIndex] = useState(null);

  const activeMeta = useMemo(() => {
    if (!product) return { name: "", description: "", index: 0 };
    const url = activeImg || images[0] || product.image || "";
    const idx = getImageIndex(product, url);
    return getImageMeta(product, idx);
  }, [product, activeImg, images]);

  // Fix: when product loads async, pick a default size/image.
  useEffect(() => {
    if (!sizes.length) {
      setSelectedSize("");
      return;
    }

    // If there is only one size, auto-select it (smooth UX).
    // If there are multiple sizes, require explicit selection.
    if (sizes.length === 1) {
      setSelectedSize(sizes[0]);
    } else {
      setSelectedSize((cur) => (cur && sizes.includes(cur) ? cur : ""));
    }
  }, [product?.id, sizes]);

  useEffect(() => {
    if (!images.length) return;
    setActiveImg((cur) => (cur && images.includes(cur) ? cur : images[0]));
  }, [product?.id, images]);

  // Keep variantIndex in sync with the active image (only used in per-image stock mode)
  useEffect(() => {
    if (!product) return;
    if (!isPerImageStock(product.stock)) {
      setVariantIndex(null);
      return;
    }
    const idx = images.indexOf(activeImg);
    setVariantIndex(idx >= 0 ? idx : 0);
  }, [product, images, activeImg]);

  // When variant changes, try to keep a size selected that is in-stock for that variant.
  useEffect(() => {
    if (!product) return;
    if (!sizes.length) return;
    if (variantIndex === null || variantIndex === undefined) return;

    // If user hasn't chosen a size (multi-size), don't auto-pick.
    if (!selectedSize) return;

    // If chosen size is out for this variant, try the first in-stock size.
    if (getMaxStockFor(product, selectedSize, variantIndex) > 0) return;
    const firstInStock = sizes.find((s) => getMaxStockFor(product, s, variantIndex) > 0);
    setSelectedSize(firstInStock || "");
  }, [product, sizes, variantIndex, selectedSize]);

  const anyStock = useMemo(() => hasAnyStock(product), [product]);

  const isOutOfStock = useMemo(() => {
    if (!product) return true;
    if (!sizes.length) return false;
    if (!selectedSize) return !anyStock;
    const vIdx = variantIndex ?? null;
    return getMaxStockFor(product, selectedSize, vIdx) <= 0;
  }, [product, sizes.length, selectedSize, variantIndex, anyStock]);

  const [added, setAdded] = useState(false);

  function handleAddToCart() {
    if (!product) return;

    // Multi-size products: require an explicit choice.
    if (sizes.length > 1 && !selectedSize) {
      setSizeError(true);
      window.setTimeout(() => setSizeError(false), 1400);
      const el = document.getElementById("baggo-size-picker");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Single-size: auto-use it.
    const finalSize = sizes.length === 1 ? sizes[0] : selectedSize || null;
    if (sizes.length && !finalSize) return;

    // Image -> cart: always use the currently selected image.
    const imgUrl = activeImg || images[0] || product.image || "";
    const imgIdx = getImageIndex(product, imgUrl);
    const meta = getImageMeta(product, imgIdx);

    addToCart({
      ...product,
      size: finalSize,
      variantIndex: variantIndex ?? null,
      image: imgUrl,
      imageName: meta.name,
      imageDescription: meta.description,
      imageIndex: meta.index,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  const youMayAlsoLike = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.category === product.category && p.id !== product.id)
      .slice(0, 8);
  }, [product, products]);

  async function handleUnlockSecret() {
    if (!product?.category) return;
    setSecretBusy(true);
    setSecretError("");
    try {
      const ok = await unlockCategoryWithPassword({ slug: product.category, password: secretPassword });
      if (!ok) {
        setSecretError("Wrong password. Try again.");
        return;
      }
      setSecretOpen(false);
      setSecretPassword("");
    } catch (e) {
      setSecretError("Couldn't unlock this collection. Please try again.");
    } finally {
      setSecretBusy(false);
    }
  }

  function handleCancelSecret() {
    setSecretOpen(false);
    setSecretPassword("");
    setSecretError("");
    setSecretBusy(false);
    // Prevent looping on a locked product page.
    navigate("/shop");
  }

  if (!product) {
    return (
      <Container>
        <p className="text-[var(--color-text-muted)]">Product not found.</p>
      </Container>
    );
  }

  if (isLocked) {
    return (
      <Container>
        <div className="pt-10 pb-16">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h1 className="text-xl font-semibold text-[var(--color-text)]">Private collection</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Enter the password to view this product.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSecretOpen(true)}
                className="rounded-full px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)]"
              >
                Unlock
              </button>
              <button
                type="button"
                onClick={handleCancelSecret}
                className="rounded-full px-4 py-2 text-sm border border-[var(--color-border)] bg-[var(--color-bg)]"
              >
                Back to shop
              </button>
            </div>
          </div>

          <Modal
            open={secretOpen}
            title={`Private collection${categoryMeta?.label ? `: ${categoryMeta.label}` : ""}`}
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
            <p className="text-sm text-[var(--color-text-muted)]">Enter the password to view this category.</p>
            <input
              type="password"
              value={secretPassword}
              onChange={(e) => setSecretPassword(e.target.value)}
              placeholder="Password"
              className="mt-3 w-full border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            {secretError ? <p className="mt-3 text-sm text-red-600">{secretError}</p> : null}
          </Modal>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      {/* Breadcrumb */}
      <div className="text-sm text-[var(--color-text-muted)] mb-6">
        <Link to="/shop" className="hover:text-[var(--color-text)] transition">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/shop?category=${product.category}`}
          className="hover:text-[var(--color-text)] transition capitalize"
        >
          {product.category}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--color-text)]">{product.name}</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-10 items-start">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
            <SafeImage key={activeImg} src={activeImg} alt={product.name} className="w-full aspect-[4/5] object-cover baggo-fade" />
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 baggo-scroll">
              {images.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImg(src)}
                  className={`w-20 h-24 rounded-xl overflow-hidden border transition-all ${
                    src === activeImg
                      ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/25"
                      : "border-[var(--color-border)] hover:border-[var(--color-text)]/30"
                  }`}
                >
                  <SafeImage src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="lg:sticky lg:top-24">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 md:p-7">
            <div className="flex items-start justify-between gap-6">
              <div key={`meta-${activeMeta.index}`} className="baggo-fade">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">
                  {activeMeta.name || product.name}
                </h1>
                {activeMeta.name && activeMeta.name !== product.name ? (
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {product.name}
                  </p>
                ) : null}
                <p className="mt-2 text-[var(--color-text-muted)] capitalize">
                  {product.category}
                </p>
              </div>

              <div className="text-right">
                <p className="text-2xl font-semibold text-[var(--color-text)]">
                  {hasDiscount(product) ? (
                    <>
                      <span className="line-through opacity-60 mr-2 text-base">${getBasePrice(product)}</span>
                      <span>${getUnitPrice(product)}</span>
                    </>
                  ) : (
                    <>${getUnitPrice(product)}</>
                  )}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Taxes may apply
                </p>
              </div>
            </div>

            <p key={`desc-${activeMeta.index}`} className="mt-6 text-[var(--color-text)]/85 leading-relaxed baggo-fade">
              {activeMeta.description || product.description || "Premium materials, clean silhouette, and durable build — designed for everyday elegance."}
            </p>

            {/* Sizes */}
            {sizes.length ? (
              <div id="baggo-size-picker" className={`mt-7 ${sizeError ? "animate-baggo-shake" : ""}`.trim()}>
                <p className="text-sm font-medium text-[var(--color-text)] mb-3">
                  Size
                </p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <Pill
                      key={s}
                      active={selectedSize === s}
                      disabled={getMaxStockFor(product, s, variantIndex ?? null) <= 0}
                      onClick={() => {
                        setSizeError(false);
                        setSelectedSize(s);
                      }}
                    >
                      {s}
                    </Pill>
                  ))}
                </div>

                {selectedSize && (() => {
                  const qty = getMaxStockFor(product, selectedSize, variantIndex ?? null);
                  if (qty <= 0) return (
                    <p className="mt-3 text-xs text-[var(--color-text-muted)]">Out of stock</p>
                  );
                  if (qty <= 10) return (
                    <p className="mt-3 text-xs text-[var(--color-text-muted)]">Only {qty} left</p>
                  );
                  return null;
                })()}

                {sizeError && !selectedSize ? (
                  <p className="mt-3 text-xs text-[var(--color-danger)]">Please choose a size.</p>
                ) : null}
              </div>
            ) : null}

            {/* Add to cart */}
            <button
              disabled={isOutOfStock}
              onClick={handleAddToCart}
              className="mt-8 w-full rounded-xl py-3.5 font-medium bg-[var(--color-primary)] text-[var(--color-on-primary)] disabled:opacity-40 transition active:scale-[0.99]"
            >
              {isOutOfStock
                ? "Out of stock"
                : sizes.length > 1 && !selectedSize
                ? "Choose size"
                : "Add to cart"}
            </button>

            {added && (
              <p className="mt-3 text-sm text-[var(--color-success)] baggo-fade">
                Added to cart ✓
              </p>
            )}

          </div>
        </div>
      </div>

      {/* You may also like */}
      {youMayAlsoLike.length > 0 && (
        <div className="mt-16">
          <div className="flex items-end justify-between gap-6 mb-6">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-[var(--color-text)]">
              You may also like
            </h2>
            <Link
              to={`/shop?category=${product.category}`}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
            >
              View all
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {youMayAlsoLike.map((p, idx) => (
              <div key={p.id} className="baggo-reveal" style={{ "--baggo-delay": `${Math.min(idx, 12) * 35}ms` }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}