import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "~/axios";

export default function Login() {
  const navigate = useNavigate();

  // Estado del formulario: lo que el usuario escribe
  const [form, setForm]     = useState({ email: "", password: "" });
  const [error, setError]   = useState("");       // Mensaje de error si el login falla
  const [loading, setLoading] = useState(false);  // Para deshabilitar el botón mientras carga

  // Actualiza el campo que cambió sin tocar los demás
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // Evita que la página recargue (comportamiento por defecto del form)
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", form);

      // Guardamos los tokens y la info del usuario en localStorage
      // para que estén disponibles en toda la app
      localStorage.setItem("accessToken",  data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user",         JSON.stringify(data.user));

      navigate("/archivos");
    } catch (err) {
      // El backend devuelve el mensaje de error en err.response.data.message
      setError(err.response?.data?.message ?? "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Repositorio de Archivos</h2>
        <p style={styles.subtitle}>Inicia sesión para continuar</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Correo electrónico</label>
          <input
            style={styles.input}
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="correo@ejemplo.com"
            required
          />

          <label style={styles.label}>Contraseña</label>
          <input
            style={styles.input}
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
          />

          {/* Solo mostramos el error si existe */}
          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p style={styles.registerText}>
          ¿No tienes cuenta?{" "}
          <a href="/register" style={styles.link}>Regístrate</a>
          {" "}(tu cuenta será activada por un administrador)
        </p>
      </div>
    </div>
  );
}

// Estilos inline simples. Puedes moverlos a un CSS cuando quieras.
const styles = {
  page: {
    minHeight: "100vh", display: "flex",
    alignItems: "center", justifyContent: "center",
    background: "#f0f2f5",
  },
  card: {
    background: "#fff", borderRadius: 12, padding: "2.5rem 2rem",
    boxShadow: "0 4px 24px rgba(0,0,0,0.10)", width: "100%", maxWidth: 400,
  },
  title:    { margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#1a1a2e" },
  subtitle: { color: "#666", marginTop: 4, marginBottom: "1.5rem" },
  form:     { display: "flex", flexDirection: "column", gap: "0.6rem" },
  label:    { fontWeight: 600, fontSize: "0.9rem", color: "#333" },
  input: {
    padding: "0.65rem 0.9rem", borderRadius: 8,
    border: "1.5px solid #ddd", fontSize: "1rem", outline: "none",
    transition: "border-color 0.2s",
  },
  error:  { color: "#e53e3e", fontSize: "0.9rem", margin: "0.25rem 0" },
  button: {
    marginTop: "0.75rem", padding: "0.75rem",
    background: "#4f46e5", color: "#fff", border: "none",
    borderRadius: 8, fontSize: "1rem", fontWeight: 600,
    cursor: "pointer", transition: "background 0.2s",
  },
  registerText: { marginTop: "1.25rem", textAlign: "center", fontSize: "0.875rem", color: "#666" },
  link: { color: "#4f46e5", fontWeight: 600 },
};
