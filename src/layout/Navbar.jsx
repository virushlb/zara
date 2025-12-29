import { NavLink } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { useCart } from "../context/CartContext";
import { useEffect, useMemo, useState } from "react";

function CartIcon({ count, animate }) {
  return (
    <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 active:scale-95 transition">
      {/* simple cart svg */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="20" r="1" />
        <circle cx="17" cy="20" r="1" />
        <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H7" />
      </svg>

      {count > 0 && (
        <span
          className={`absolute -top-1 -right-1 bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[11px] font-bold px-2 py-0.5 rounded-full transition-transform ${
            animate ? "scale-125" : "scale-100"
          }`}
        >
          {count}
        </span>
      )}
    </span>
  );
}

export default function Navbar() {
  const { settings } = useStore();
  const { cart } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [animateCart, setAnimateCart] = useState(false);
  const [open, setOpen] = useState(false);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  // Navbar effect on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cart badge pop
  useEffect(() => {
    if (cartCount > 0) {
      setAnimateCart(true);
      const t = setTimeout(() => setAnimateCart(false), 260);
      return () => clearTimeout(t);
    }
  }, [cartCount]);

  const linkClass = ({ isActive }) =>
    `relative block py-2 transition-all duration-200 hover:-translate-y-0.5 ${
      isActive
        ? "text-[var(--color-nav-text)]"
        : "text-[var(--color-nav-text-muted)] hover:text-[var(--color-nav-text)]"
    } after:content-[''] after:absolute after:left-0 after:-bottom-0.5 after:h-[1px] after:w-full after:bg-[var(--color-nav-text)] after:origin-left after:transition-transform after:duration-300 ${
      isActive ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"
    }`;

  return (
    <nav className="sticky top-0 z-50">
      {/* Top bar */}
      <div
        className={`baggo-nav-enter baggo-nav-glass relative overflow-hidden bg-[var(--color-nav-bg)] border-b border-[var(--color-nav-border)] transition-all duration-300 ${
          scrolled ? "baggo-nav-scrolled shadow-sm" : ""
        }`}
      >
        <div
          className={`max-w-7xl mx-auto px-6 flex items-center justify-between relative z-10 ${
            scrolled ? "h-16" : "h-20"
          }`}
        >
          {/* Logo */}
          <NavLink
            to="/"
            className={`text-[var(--color-nav-text)] font-display uppercase tracking-[0.22em] transition-all hover:opacity-90 active:opacity-80 ${
              scrolled ? "text-base" : "text-lg"
            }`}
            onClick={() => setOpen(false)}
          >
            {settings?.siteName || "Baggo"}
          </NavLink>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-10 text-sm uppercase tracking-wider">
            <NavLink to="/" className={linkClass}>
              Home
            </NavLink>
            <NavLink to="/shop" className={linkClass}>
              Shop
            </NavLink>
            <NavLink to="/favorites" className={linkClass}>
              Favorites
            </NavLink>

            <NavLink to="/cart" className="relative text-[var(--color-nav-text-muted)] hover:text-[var(--color-nav-text)] transition">
              <span className="relative inline-flex items-center gap-2">
                Cart
                {cartCount > 0 && (
                  <span
                    className={`absolute -top-2 -right-5 bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[11px] font-bold px-2 py-0.5 rounded-full transition-transform ${
                      animateCart ? "scale-125" : "scale-100"
                    }`}
                  >
                    {cartCount}
                  </span>
                )}
              </span>
            </NavLink>
          </div>

          {/* Mobile actions */}
          <div className="md:hidden flex items-center gap-2">
            <NavLink to="/cart" onClick={() => setOpen(false)} className="text-[var(--color-nav-text)]">
              <CartIcon count={cartCount} animate={animateCart} />
            </NavLink>

            <button
              onClick={() => setOpen((v) => !v)}
              className="text-[var(--color-nav-text)] text-2xl w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-black/5 active:scale-95 transition"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <span
                className={`inline-block transition-transform duration-200 ${
                  open ? "rotate-90" : "rotate-0"
                }`}
              >
                {open ? "✕" : "☰"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu (not clipped, sits under bar) */}
      {open && (
        <div className="baggo-menu-enter md:hidden bg-[var(--color-nav-bg)] backdrop-blur-xl border-b border-[var(--color-nav-border)] px-6 py-4">
          <div className="max-w-7xl mx-auto space-y-2 uppercase tracking-wider text-sm">
            <NavLink to="/" onClick={() => setOpen(false)} className={linkClass}>
              Home
            </NavLink>
            <NavLink to="/shop" onClick={() => setOpen(false)} className={linkClass}>
              Shop
            </NavLink>
            <NavLink to="/favorites" onClick={() => setOpen(false)} className={linkClass}>
              Favorites
            </NavLink>
            <NavLink to="/cart" onClick={() => setOpen(false)} className={linkClass}>
              Cart ({cartCount})
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  );
}
