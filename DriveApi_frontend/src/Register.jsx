import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "./axios";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ name:"", email:"", password:"", passwordConfirm:"", birth:"" });
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.passwordConfirm) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true);
    try {
      await api.post("/auth/register", form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message ?? "Error al registrarse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>Crear cuenta</h2>
        <p style={s.subtitle}>Tu cuenta quedará pendiente de activación por un administrador</p>

        {success ? (
          <div style={s.successBox}>
            <p style={{margin:0}}>✅ ¡Cuenta creada! Un administrador debe activarla antes de que puedas entrar.</p>
            <button style={{...s.btn, marginTop:"1rem"}} onClick={() => navigate("/login")}>Ir al login</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            <label style={s.label}>Nombre completo</label>
            <input style={s.input} type="text" name="name" value={form.name} onChange={handleChange} placeholder="Tu nombre" required />
            <label style={s.label}>Correo electrónico</label>
            <input style={s.input} type="email" name="email" value={form.email} onChange={handleChange} placeholder="correo@ejemplo.com" required />
            <label style={s.label}>Fecha de nacimiento</label>
            <input style={s.input} type="date" name="birth" value={form.birth} onChange={handleChange} required />
            <label style={s.label}>Contraseña</label>
            <input style={s.input} type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" required />
            <label style={s.label}>Confirmar contraseña</label>
            <input style={s.input} type="password" name="passwordConfirm" value={form.passwordConfirm} onChange={handleChange} placeholder="••••••••" required />
            {error && <p style={s.error}>{error}</p>}
            <button style={s.btn} type="submit" disabled={loading}>{loading ? "Registrando..." : "Registrarse"}</button>
          </form>
        )}

        <p style={s.foot}>
          ¿Ya tienes cuenta?{" "}
          <span style={s.link} onClick={() => navigate("/login")}>Inicia sesión</span>
        </p>
      </div>
    </div>
  );
}

const s = {
  page:       { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f0f2f5" },
  card:       { background:"#fff", borderRadius:12, padding:"2.5rem 2rem", boxShadow:"0 4px 24px rgba(0,0,0,0.10)", width:"100%", maxWidth:430 },
  title:      { margin:0, fontSize:"1.5rem", fontWeight:700, color:"#1a1a2e" },
  subtitle:   { color:"#666", marginTop:4, marginBottom:"1.25rem", fontSize:"0.875rem" },
  form:       { display:"flex", flexDirection:"column", gap:"0.5rem" },
  label:      { fontWeight:600, fontSize:"0.875rem", color:"#333" },
  input:      { padding:"0.65rem 0.9rem", borderRadius:8, border:"1.5px solid #ddd", fontSize:"1rem" },
  error:      { color:"#e53e3e", fontSize:"0.875rem", margin:"0.25rem 0" },
  btn:        { marginTop:"0.75rem", padding:"0.75rem", background:"#4f46e5", color:"#fff", border:"none", borderRadius:8, fontSize:"1rem", fontWeight:600, cursor:"pointer" },
  successBox: { background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:8, padding:"1rem", color:"#16a34a", textAlign:"center" },
  foot:       { marginTop:"1.25rem", textAlign:"center", fontSize:"0.875rem", color:"#666" },
  link:       { color:"#4f46e5", fontWeight:600, cursor:"pointer" },
};
