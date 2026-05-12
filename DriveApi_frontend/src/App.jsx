import { Routes, Route, Navigate } from "react-router";
import Login from "./Login";
import Register from "./Register";
import Users from "./Users";
import Files from "./Files";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("accessToken");
  return token ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (!localStorage.getItem("accessToken")) return <Navigate to="/login" replace />;
  if (user.role !== 1) return <Navigate to="/archivos" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Rutas privadas para cualquier usuario autenticado */}
      <Route path="/archivos" element={<PrivateRoute><Files /></PrivateRoute>} />

      {/* Ruta privada solo para administradores */}
      <Route path="/usuarios" element={<AdminRoute><Users /></AdminRoute>} />

      {/* Redirige la raíz a archivos */}
      <Route path="/" element={<Navigate to="/archivos" replace />} />
      <Route path="*" element={<Navigate to="/archivos" replace />} />
    </Routes>
  );
}

export default App;
