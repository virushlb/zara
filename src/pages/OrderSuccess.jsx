import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Container from "../layout/Container";
import SafeImage from "../components/SafeImage";

const KEY = "BAGGO_LAST_ORDER";

function readLastOrder() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export default function OrderSuccess() {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(readLastOrder());
  }, []);

  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);

  return (
    <Container>
      <div className="py-16 max-w-3xl">
        <h1 className="text-3xl font-semibold text-[var(--color-text)]">Order received ✅</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Thanks! We got your order. We&rsquo;ll contact you on WhatsApp to confirm availability.
        </p>

        {data?.whatsapp_url ? (
          <div className="mt-6">
            <a
              href={data.whatsapp_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full px-5 py-3 text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)]"
            >
              Open WhatsApp
            </a>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              If WhatsApp didn&rsquo;t open automatically, tap the button above.
            </p>
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Order ID</p>
              <p className="mt-1 font-semibold text-[var(--color-text)] break-all">
                {data?.id || "(not saved)"}
              </p>
            </div>
            <div className="text-sm">
              <p className="text-[var(--color-text-muted)]">Total</p>
              <p className="mt-1 font-semibold text-[var(--color-text)]">${Number(data?.total || 0)}</p>
            </div>
          </div>

          {items.length ? (
            <div className="mt-6">
              <p className="text-sm font-medium text-[var(--color-text)]">Items</p>
              <div className="mt-3 divide-y divide-[var(--color-border)]">
                {items.map((it, idx) => (
                  <div key={`os-it-${idx}`} className="py-3 flex items-center gap-4">
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
                    <div className="text-sm text-[var(--color-text)] whitespace-nowrap">x{it.quantity}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Link
            to="/shop"
            className="rounded-full px-5 py-3 text-sm bg-[var(--color-primary)] text-[var(--color-on-primary)]"
          >
            Continue shopping
          </Link>
          <Link
            to="/cart"
            className="rounded-full px-5 py-3 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
          >
            Back to cart
          </Link>
        </div>
      </div>
    </Container>
  );
}