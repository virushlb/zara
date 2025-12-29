import { NavLink } from "react-router-dom";

const AdminTabs = () => {
  return (
    <nav className="admin-tabs">
      <NavLink to="/admin/products">Products</NavLink>
      <NavLink to="/admin/categories">Categories</NavLink>
      <NavLink to="/admin/website">Website</NavLink>

      {/* ✅ NEW TAB */}
      <NavLink to="/admin/home">Home</NavLink>

      <NavLink to="/admin/promocodes">Promo codes</NavLink>
      <NavLink to="/admin/orders">Orders</NavLink>
      <NavLink to="/admin/delivery">Delivery</NavLink>
      <NavLink to="/admin/inventory">Inventory</NavLink>
    </nav>
  );
};

export default AdminTabs;
