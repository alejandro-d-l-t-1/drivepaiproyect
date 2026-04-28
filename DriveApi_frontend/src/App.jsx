import { Routes, Route, Navigate } from "react-router";
import Login from "~/Login";
import Users from "~/Users";
import Files from "~/Files";

// Componente guardián: si no hay token, manda al login
function PrivateRoute({ children }) {
  const token = localStorage.getItem("accessToken");
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Todas estas rutas requieren estar autenticado */}
      <Route path="/usuarios" element={<PrivateRoute><Users /></PrivateRoute>} />
      <Route path="/archivos" element={<PrivateRoute><Files /></PrivateRoute>} />

      {/* Si alguien entra a "/", lo mandamos a archivos */}
      <Route path="/" element={<Navigate to="/archivos" replace />} />
    </Routes>
  );
}

export default App;
