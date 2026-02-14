import Container from "../layout/Container";
import { useCart } from "../context/CartContext";
import { validatePromoCode } from "../lib/promo";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMaxStockFor } from "../lib/stock";
import { fetchShippingSettings } from "../lib/shipping";
import { createOrder } from "../lib/orders";
import SafeImage from "../components/SafeImage";
import { getUnitPrice, hasDiscount, getBasePrice } from "../lib/pricing";
import { useStore } from "../context/StoreContext";

export default function Cart() {
  const { cart, removeFromCart, updateQuantity } = useCart();
  const { settings } = useStore();
  const navigate = useNavigate();
  const LAST_ORDER_KEY = "BAGGO_LAST_ORDER";
  const storeName = String(settings?.siteName || "Baggo");
  // Shipping
  const [shippingSettings, setShippingSettings] = useState(null);
  const [shippingMethod, setShippingMethod] = useState("");
  const [shippingMsg, setShippingMsg] = useState("");

  // Customer (optional)
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", notes: "" });

  // Load shipping settings (cloud mode) or defaults (demo)
  useEffect(() => {
    (async () => {
      const res = await fetchShippingSettings();
      if (res?.ok) {
        setShippingSettings(res.settings);
        const firstActive = (res.settings?.methods || []).find((m) => m.active !== false);
        setShippingMethod(firstActive?.code || "");
      } else {
        setShippingMsg(res?.error || "Couldn't load shipping settings");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(null); // {code,type,value,discount}
  const [promoMsg, setPromoMsg] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + getUnitPrice(item) * item.quantity, 0);

  const discount = promoApplied
    ? Math.max(
        0,
        Math.min(
          subtotal,
          promoApplied.type === "fixed"
            ? Number(promoApplied.value || 0)
            : (subtotal * Number(promoApplied.value || 0)) / 100
        )
      )
    : 0;
  const baseTotal = Math.max(0, subtotal - discount);

  const shippingFee = useMemo(() => {
    const methods = shippingSettings?.methods || [];
    const selected = methods.find((m) => String(m.code) === String(shippingMethod));
    const fee = Number(selected?.fee || 0);
    const threshold = shippingSettings?.free_threshold;
    const thr = threshold === null || threshold === undefined || threshold === "" ? null : Number(threshold);
    if (Number.isFinite(thr) && thr !== null && baseTotal >= thr) return 0;
    return Number.isFinite(fee) ? Math.max(0, fee) : 0;
  }, [shippingSettings, shippingMethod, baseTotal]);

  const total = Math.max(0, baseTotal + shippingFee);

  async function applyPromo() {
    const code = String(promoInput || "").trim();
    if (!code) {
      setPromoApplied(null);
      setPromoMsg("");
      return;
    }

    setPromoBusy(true);
    setPromoMsg("");
    try {
      const res = await validatePromoCode(code, subtotal);
      if (!res?.ok) {
        setPromoApplied(null);
        setPromoMsg(res?.error || "Invalid promo code");
      } else {
        // Keep only what we need; discount is derived so it stays correct if cart total changes.
        setPromoApplied({ code: res.promo.code, type: res.promo.type, value: res.promo.value });
        setPromoMsg(`Applied ${res.promo.code}`);
      }
    } catch (e) {
      setPromoApplied(null);
      setPromoMsg(e?.message || "Failed to apply code");
    } finally {
      setPromoBusy(false);
    }
  }

  async function checkoutWhatsApp() {
    const phone = String(settings?.whatsapp || "").replace(/[^0-9]/g, "");
    if (!phone) {
      window.alert("WhatsApp number is not set.\nGo to Admin → Website → WhatsApp number and save it.");
      return;
    }

    // IMPORTANT (mobile popup blockers):
    // Opening a new tab *after* awaiting network calls is often blocked.
    // So we pre-open a blank window synchronously (still within the click gesture)
    // and then navigate it once the WhatsApp URL is ready.
    const waWindow = window.open("about:blank", "_blank");

    const methods = shippingSettings?.methods || [];
    const selectedMethod = methods.find((m) => String(m.code) === String(shippingMethod));
    const methodLabel = selectedMethod?.label || shippingMethod || "Delivery";
  
    const itemsText = cart
      .map((item) => {
        const unit = getUnitPrice(item);
        const lineTotal = unit * Number(item.quantity || 0);
        const pricePart = hasDiscount(item)
          ? `Qty: ${item.quantity} × $${unit} (was $${getBasePrice(item)}) = $${lineTotal}`
          : `Qty: ${item.quantity} × $${unit} = $${lineTotal}`;

        return `• ${item.name}${item.size ? ` (${item.size})` : ""}${
          item.variantIndex !== null && item.variantIndex !== undefined
            ? ` (v${Number(item.variantIndex) + 1})`
            : ""
        }\n  ${pricePart}`;
      })
      .join("\n\n");
  
    const promoLine = promoApplied
      ? `\nPromo: *${promoApplied.code}* (-$${discount})`
      : "";

    // Create the order.
    // We always attempt this (createOrder already handles "demo/local" mode).
    // If it fails we still continue to WhatsApp, BUT we log it so you can debug.
    let createdOrderId = "";
    const payload = {
      status: "new",
      customer,
      items: cart.map((i) => ({
        product_id: i.id,
        name: i.name,
        price: getUnitPrice(i),
        quantity: i.quantity,
        size: i.size || null,
        variantIndex: i.variantIndex ?? null,
        image: i.image || null,
      })),
      promo_code: promoApplied ? promoApplied.code : null,
      delivery_method: shippingMethod || null,
      notes: customer?.notes || "",
      subtotal,
      discount,
      shipping: shippingFee,
      total,
    };

    const res = await createOrder(payload);
    if (!res?.ok) {
      // eslint-disable-next-line no-console
      console.warn("Order insert failed", res?.error);
    }
    if (res?.ok && res.id) createdOrderId = String(res.id);

    const customerLines = [
      customer?.name ? `Name: *${customer.name}*` : null,
      customer?.phone ? `Phone: *${customer.phone}*` : null,
      customer?.address ? `Address: *${customer.address}*` : null,
      customer?.notes ? `Notes: ${customer.notes}` : null,
    ].filter(Boolean);

    const orderIdLine = createdOrderId ? `\nOrder ID: *${createdOrderId}*` : "";

    const message = `
🛍️ *New Order — ${storeName}*${orderIdLine}

${customerLines.length ? customerLines.join("\n") + "\n\n" : ""}${itemsText}

——————————
Subtotal: *$${subtotal}*${promoLine}
Delivery: *${methodLabel}* (+$${shippingFee})
Total: *$${total}*
——————————

Please confirm availability.
`;
  
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(
      message
    )}`;
  
    // Save a small receipt locally so we can show an order confirmation screen.
    try {
      localStorage.setItem(
        LAST_ORDER_KEY,
        JSON.stringify({
          id: createdOrderId || null,
          created_at: new Date().toISOString(),
          customer,
          items: cart.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            size: i.size || null,
            variantIndex: i.variantIndex ?? null,
            image: i.image || null,
          })),
          promo_code: promoApplied ? promoApplied.code : null,
          delivery_method: shippingMethod || null,
          whatsapp_url: url,
          subtotal,
          discount,
          shipping: shippingFee,
          total,
        })
      );
    } catch {
      // ignore
    }

    // Navigate the pre-opened window (best chance to avoid popup blockers).
    if (waWindow) {
      try {
        waWindow.location.href = url;
      } catch {
        // ignore
      }
      // Keep the store tab on an order confirmation screen.
      navigate("/order-success");
      return;
    }

    // Fallback: if popups are blocked, open WhatsApp in the same tab.
    window.location.href = url;
  }
  

  if (cart.length === 0) {
    return (
      <Container>
        <p className="py-20 text-[var(--color-text-muted)]">Your cart is empty.</p>
      </Container>
    );
  }

  return (
    <Container>
      <div className="py-16 grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* Items */}
        <div className="lg:col-span-2 space-y-6">
          {cart.map((item, idx) => {
            const vIdx = item.variantIndex ?? null;
            const max = getMaxStockFor(item, item.size, vIdx);
            return (
            <div
              key={`${item.id}-${item.size || "nosize"}-${vIdx ?? "v0"}-${String(item.image || "")}`}
              className="baggo-reveal flex flex-col sm:flex-row sm:items-center gap-4 bg-[var(--color-surface-2)] text-[var(--color-text)] p-4 sm:p-6 rounded-xl border border-[var(--color-border)]"
              style={{ "--baggo-delay": `${Math.min(idx, 12) * 35}ms` }}

            >
              <SafeImage src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-lg" />

              <div className="flex-1">
                <p className="font-medium">
                  {item.name}
                  {item.size && (
                    <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                      ({item.size})
                    </span>
                  )}
                </p>

                {item.imageName || item.imageDescription ? (
                  <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {item.imageName ? <p>{item.imageName}</p> : null}
                    {item.imageDescription ? (
                      <p className="mt-0.5 text-xs opacity-90">{item.imageDescription}</p>
                    ) : null}
                  </div>
                ) : null}

                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  {hasDiscount(item) ? (
                    <>
                      <span className="line-through opacity-70 mr-2">${getBasePrice(item)}</span>
                      <span className="text-[var(--color-text)] font-medium">${getUnitPrice(item)}</span>
                    </>
                  ) : (
                    <>${getUnitPrice(item)}</>
                  )}
                </p>

                {/* Quantity controls */}
                <div className="flex items-center gap-4 mt-3">

                  <button
                    onClick={() =>
                      updateQuantity(
                        item.id,
                        item.size,
                        item.quantity - 1,
                        vIdx,
                        item.image
                      )
                    }
                    className="px-3 py-1 border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] baggo-tap"
                  >
                    −
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    onClick={() =>
                      updateQuantity(
                        item.id,
                        item.size,
                        item.quantity + 1,
                        vIdx,
                        item.image
                      )
                    }
                    disabled={max > 0 ? item.quantity >= max : false}
                    className="px-3 py-1 border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] disabled:opacity-30 baggo-tap"
                  >
                    +
                  </button>

                </div>
              </div>

              <button
                onClick={() => removeFromCart(item.id, item.size, vIdx, item.image)}
                className="text-[var(--color-danger)] text-sm hover:underline"
              >
                Remove
              </button>
            </div>
          );
          })}
        </div>

        {/* Summary */}
        <div className="bg-[var(--color-surface)] text-[var(--color-text)] p-8 rounded-xl h-fit border border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-muted)] mb-2">Order summary</p>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">Subtotal</span>
              <span>${subtotal}</span>
            </div>

            {promoApplied ? (
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">Discount ({promoApplied.code})</span>
                <span>- ${discount}</span>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
              <span className="font-medium">Total</span>
              <span className="text-xl font-semibold">${total}</span>
            </div>
          </div>

          {/* Delivery / Shipping */}
          <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="text-sm font-medium">Delivery</p>
            {shippingMsg ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{shippingMsg}</p> : null}

            <div className="mt-3">
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {(shippingSettings?.methods || []).filter((m) => m.active !== false).map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label} (+${Number(m.fee || 0)})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">Shipping fee</span>
              <span>${shippingFee}</span>
            </div>
          </div>

          {/* Customer info (optional) */}
          <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="text-sm font-medium">Customer info <span className="text-[var(--color-text-muted)]">(optional)</span></p>

            <div className="mt-3 space-y-2">
              <input
                value={customer.name}
                onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                placeholder="Name"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <input
                value={customer.phone}
                onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
                placeholder="Phone"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <input
                value={customer.address}
                onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))}
                placeholder="Address"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <textarea
                rows={2}
                value={customer.notes}
                onChange={(e) => setCustomer((c) => ({ ...c, notes: e.target.value }))}
                placeholder="Notes"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Promo code */}
          <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="text-sm font-medium">Promo code <span className="text-[var(--color-text-muted)]">(optional)</span></p>

            <div className="mt-3 flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="Enter code"
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={promoBusy}
                className="rounded-xl px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)] disabled:opacity-50"
              >
                {promoBusy ? "..." : "Apply"}
              </button>
            </div>

            {promoMsg ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{promoMsg}</p> : null}

            {promoApplied ? (
              <button
                type="button"
                onClick={() => {
                  setPromoApplied(null);
                  setPromoInput("");
                  setPromoMsg("");
                }}
                className="mt-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Remove code
              </button>
            ) : null}
          </div>

          <button
            onClick={checkoutWhatsApp}
            className="w-full mt-5 bg-[var(--color-primary)] text-[var(--color-on-primary)] py-3 rounded font-medium hover:opacity-90 transition"
          >
            Checkout on WhatsApp
          </button>
        </div>

      </div>
    </Container>
  );
}