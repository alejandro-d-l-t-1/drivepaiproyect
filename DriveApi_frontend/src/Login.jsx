import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "./axios";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);
      localStorage.setItem("accessToken",  data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user",         JSON.stringify(data.user));
      navigate("/archivos");
    } catch (err) {
      setError(err.response?.data?.message ?? "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>Repositorio de Archivos</h2>
        <p style={s.subtitle}>Inicia sesión para continuar</p>
        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>Correo electrónico</label>
          <input style={s.input} type="email" name="email"
            value={form.email} onChange={handleChange}
            placeholder="correo@ejemplo.com" required />
          <label style={s.label}>Contraseña</label>
          <input style={s.input} type="password" name="password"
            value={form.password} onChange={handleChange}
            placeholder="••••••••" required />
          {error && <p style={s.error}>{error}</p>}
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
        <p style={s.foot}>
          ¿No tienes cuenta?{" "}
          <span style={s.link} onClick={() => navigate("/register")}>Regístrate</span>
          {" "}(tu cuenta será activada por un administrador)
        </p>
      </div>
    </div>
  );
}

const s = {
  page:     { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f0f2f5" },
  card:     { background:"#fff", borderRadius:12, padding:"2.5rem 2rem", boxShadow:"0 4px 24px rgba(0,0,0,0.10)", width:"100%", maxWidth:400 },
  title:    { margin:0, fontSize:"1.5rem", fontWeight:700, color:"#1a1a2e" },
  subtitle: { color:"#666", marginTop:4, marginBottom:"1.5rem" },
  form:     { display:"flex", flexDirection:"column", gap:"0.6rem" },
  label:    { fontWeight:600, fontSize:"0.9rem", color:"#333" },
  input:    { padding:"0.65rem 0.9rem", borderRadius:8, border:"1.5px solid #ddd", fontSize:"1rem" },
  error:    { color:"#e53e3e", fontSize:"0.875rem", margin:"0.25rem 0" },
  btn:      { marginTop:"0.75rem", padding:"0.75rem", background:"#4f46e5", color:"#fff", border:"none", borderRadius:8, fontSize:"1rem", fontWeight:600, cursor:"pointer" },
  foot:     { marginTop:"1.25rem", textAlign:"center", fontSize:"0.875rem", color:"#666" },
  link:     { color:"#4f46e5", fontWeight:600, cursor:"pointer" },
};
