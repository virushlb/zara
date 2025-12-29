import { Routes, Route } from "react-router-dom";

import ProductsAdmin from "./ProductsAdmin";
import CategoriesAdmin from "./CategoriesAdmin";
import WebsiteAdmin from "./WebsiteAdmin";
import PromoCodesAdmin from "./PromoCodesAdmin";
import OrdersAdmin from "./OrdersAdmin";
import DeliveryAdmin from "./DeliveryAdmin";
import InventoryAdmin from "./InventoryAdmin";

/* ✅ NEW */
import HomeAdmin from "./HomeAdmin";

const AdminRouter = () => {
  return (
    <Routes>
      <Route path="products" element={<ProductsAdmin />} />
      <Route path="categories" element={<CategoriesAdmin />} />
      <Route path="website" element={<WebsiteAdmin />} />

      {/* ✅ NEW ROUTE */}
      <Route path="home" element={<HomeAdmin />} />

      <Route path="promocodes" element={<PromoCodesAdmin />} />
      <Route path="orders" element={<OrdersAdmin />} />
      <Route path="delivery" element={<DeliveryAdmin />} />
      <Route path="inventory" element={<InventoryAdmin />} />
    </Routes>
  );
};

export default AdminRouter;
