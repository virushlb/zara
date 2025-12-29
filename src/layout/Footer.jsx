import { NavLink } from "react-router-dom";
import { useStore } from "../context/StoreContext";

export default function Footer() {
  const { settings } = useStore();
  const name = settings?.siteName || "Baggo";
  const year = new Date().getFullYear();

  const linkClass = ({ isActive }) =>
    `transition-colors duration-200 ${
      isActive
        ? "text-[var(--color-text)]"
        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
    }`;

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="font-display text-lg tracking-tight text-[var(--color-text)]">
              {name}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)] max-w-sm">
              A refined online home for collections, lookbooks, and limited drops.
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold text-[var(--color-text)]">Pages</div>
            <div className="mt-4 grid gap-2 text-sm">
              <NavLink to="/" className={linkClass}>
                Home
              </NavLink>
              <NavLink to="/shop" className={linkClass}>
                Shop
              </NavLink>
              <NavLink to="/favorites" className={linkClass}>
                Favorites
              </NavLink>
              <NavLink to="/cart" className={linkClass}>
                Cart
              </NavLink>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-[var(--color-text)]">Info</div>
            <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">
              For custom orders, styling, wholesale, or collaborations — get in touch anytime.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t border-[var(--color-border)] pt-6">
          <p className="text-xs text-[var(--color-text-muted)]">
            © {year} {name}. All rights reserved.
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">Designed for a premium shopping experience.</p>
        </div>
      </div>
    </footer>
  );
}
