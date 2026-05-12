import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { api } from "./axios";

const me = () => JSON.parse(localStorage.getItem("user") || "{}");

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(10);
  const [filters, setFilters]     = useState({ nombre:"", correo:"", rol:"" });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(emptyForm());
  const [formErr, setFormErr]     = useState("");
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    try {
      const params = { page, pageSize,
        ...(filters.nombre && { nombre: filters.nombre }),
        ...(filters.correo && { correo: filters.correo }),
        ...(filters.rol !== "" && { rol: filters.rol }),
      };
      const { data } = await api.get("/user", { params });
      setUsers(data.data); setTotal(data.total);
    } catch (err) {
      if (err.response?.status === 403) navigate("/archivos");
    }
  }, [page, pageSize, filters, navigate]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormErr(""); setShowModal(true); };
  const openEdit   = (u) => {
    setEditing(u);
    setForm({ name:u.name, email:u.email, birth:u.birth?.split("T")[0]??"", role:u.role, active:u.active, password:"", passwordConfirm:"" });
    setFormErr(""); setShowModal(true);
  };

  const save = async () => {
    setFormErr("");
    if (form.password && form.password !== form.passwordConfirm) { setFormErr("Las contraseñas no coinciden."); return; }
    setSaving(true);
    try {
      const body = { name:form.name, email:form.email, birth:form.birth, role:Number(form.role), active:form.active,
        ...(form.password && { password:form.password, passwordConfirm:form.passwordConfirm }) };
      editing ? await api.put(`/user/${editing.id}`, body) : await api.post("/user", body);
      setShowModal(false); load();
    } catch (err) { setFormErr(err.response?.data?.message ?? "Error al guardar."); }
    finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    try { await api.patch(`/user/${u.id}/active`, { active: !u.active }); }
    catch (err) { alert(err.response?.data?.message ?? "Error."); }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>👥 Gestión de Usuarios</h1>
        <div style={{display:"flex",gap:"0.75rem"}}>
          <button style={s.btnSec} onClick={() => navigate("/archivos")}>📁 Archivos</button>
          <button style={s.btnPri} onClick={openCreate}>+ Nuevo usuario</button>
          <button style={s.btnDng} onClick={() => { localStorage.clear(); navigate("/login"); }}>Cerrar sesión</button>
        </div>
      </header>

      {/* Filtros */}
      <div style={s.filtersRow}>
        {[{name:"nombre",ph:"Filtrar por nombre..."},{name:"correo",ph:"Filtrar por correo..."}].map(f => (
          <input key={f.name} style={s.fi} placeholder={f.ph} name={f.name} value={filters[f.name]}
            onChange={e => { setFilters({...filters,[e.target.name]:e.target.value}); setPage(1); }} />
        ))}
        <select style={s.fi} value={filters.rol} onChange={e => { setFilters({...filters,rol:e.target.value}); setPage(1); }}>
          <option value="">Todos los roles</option>
          <option value="0">Usuario común</option>
          <option value="1">Administrador</option>
        </select>
        <select style={s.fi} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
          {[5,10,25,50].map(n => <option key={n} value={n}>{n} por página</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead><tr>{["ID","Nombre","Correo","Rol","Estado","Fecha nac.","Acciones"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {users.length===0
              ? <tr><td colSpan={7} style={{textAlign:"center",padding:"2rem",color:"#999"}}>No se encontraron usuarios.</td></tr>
              : users.map(u => (
                <tr key={u.id} style={s.tr}>
                  <td style={s.td}>{u.id}</td>
                  <td style={s.td}>{u.name}</td>
                  <td style={s.td}>{u.email}</td>
                  <td style={s.td}><span style={{...s.badge,background:u.role===1?"#4f46e5":"#6b7280"}}>{u.role===1?"Admin":"Usuario"}</span></td>
                  <td style={s.td}><span style={{...s.badge,background:u.active?"#16a34a":"#dc2626"}}>{u.active?"Activo":"Inactivo"}</span></td>
                  <td style={s.td}>{u.birth?.split("T")[0]}</td>
                  <td style={s.td}>
                    <button style={s.btnSm} onClick={() => openEdit(u)}>✏️ Editar</button>
                    {u.id !== me().id && (
                      <button style={{...s.btnSm,background:u.active?"#fee2e2":"#dcfce7",color:u.active?"#dc2626":"#16a34a"}}
                        onClick={() => toggleActive(u)}>{u.active?"Desactivar":"Activar"}</button>
                    )}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div style={s.pag}>
        <span style={{color:"#666"}}>Total: {total} usuarios</span>
        <div style={{display:"flex",gap:8}}>
          <button style={s.btnPg} disabled={page===1} onClick={() => setPage(p=>p-1)}>← Anterior</button>
          <span style={{lineHeight:"2rem",color:"#444"}}>Página {page} de {totalPages||1}</span>
          <button style={s.btnPg} disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}>Siguiente →</button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h2 style={{marginTop:0}}>{editing?"Editar usuario":"Nuevo usuario"}</h2>
            {[{l:"Nombre",n:"name",t:"text"},{l:"Correo",n:"email",t:"email"},{l:"Fecha de nacimiento",n:"birth",t:"date"}].map(f=>(
              <div key={f.n} style={{marginBottom:"0.75rem"}}>
                <label style={s.label}>{f.l}</label>
                <input style={s.inp} type={f.t} value={form[f.n]} onChange={e=>setForm({...form,[f.n]:e.target.value})} />
              </div>
            ))}
            <div style={{marginBottom:"0.75rem"}}>
              <label style={s.label}>Contraseña {editing&&"(dejar en blanco para no cambiar)"}</label>
              <input style={s.inp} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
            </div>
            <div style={{marginBottom:"0.75rem"}}>
              <label style={s.label}>Confirmar contraseña</label>
              <input style={s.inp} type="password" value={form.passwordConfirm} onChange={e=>setForm({...form,passwordConfirm:e.target.value})} />
            </div>
            <div style={{display:"flex",gap:"1rem",marginBottom:"0.75rem"}}>
              <div style={{flex:1}}>
                <label style={s.label}>Rol</label>
                <select style={s.inp} value={form.role} onChange={e=>setForm({...form,role:Number(e.target.value)})}>
                  <option value={0}>Usuario común</option>
                  <option value={1}>Administrador</option>
                </select>
              </div>
              <div style={{flex:1}}>
                <label style={s.label}>Estado</label>
                <select style={s.inp} value={String(form.active)} onChange={e=>setForm({...form,active:e.target.value==="true"})}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>
            {formErr && <p style={{color:"#dc2626",marginBottom:"0.5rem"}}>{formErr}</p>}
            <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end"}}>
              <button style={s.btnSec} onClick={() => setShowModal(false)}>Cancelar</button>
              <button style={s.btnPri} onClick={save} disabled={saving}>{saving?"Guardando...":"Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function emptyForm() { return {name:"",email:"",birth:"",role:0,active:true,password:"",passwordConfirm:""}; }

const s = {
  page:      {minHeight:"100vh",background:"#f8f9fa",fontFamily:"sans-serif"},
  header:    {background:"#fff",padding:"1rem 2rem",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"},
  title:     {margin:0,fontSize:"1.25rem",fontWeight:700},
  filtersRow:{display:"flex",gap:"0.75rem",padding:"1.25rem 2rem",flexWrap:"wrap"},
  fi:        {padding:"0.55rem 0.8rem",borderRadius:8,border:"1.5px solid #ddd",fontSize:"0.9rem",minWidth:160},
  tableWrap: {overflowX:"auto",margin:"0 2rem",borderRadius:12,boxShadow:"0 2px 8px rgba(0,0,0,0.07)",background:"#fff"},
  table:     {width:"100%",borderCollapse:"collapse"},
  th:        {padding:"0.9rem 1rem",textAlign:"left",background:"#f1f5f9",fontWeight:700,fontSize:"0.85rem",color:"#475569"},
  tr:        {borderBottom:"1px solid #f1f5f9"},
  td:        {padding:"0.8rem 1rem",fontSize:"0.9rem"},
  badge:     {color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:"0.78rem",fontWeight:600},
  pag:       {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 2rem"},
  btnPri:    {background:"#4f46e5",color:"#fff",border:"none",borderRadius:8,padding:"0.5rem 1rem",cursor:"pointer",fontWeight:600},
  btnSec:    {background:"#e5e7eb",color:"#374151",border:"none",borderRadius:8,padding:"0.5rem 1rem",cursor:"pointer",fontWeight:600},
  btnDng:    {background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:8,padding:"0.5rem 1rem",cursor:"pointer",fontWeight:600},
  btnSm:     {background:"#f1f5f9",border:"none",borderRadius:6,padding:"4px 10px",marginRight:4,cursor:"pointer",fontSize:"0.82rem"},
  btnPg:     {background:"#e5e7eb",border:"none",borderRadius:8,padding:"0.4rem 0.9rem",cursor:"pointer"},
  overlay:   {position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100},
  modal:     {background:"#fff",borderRadius:14,padding:"2rem",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.18)"},
  label:     {display:"block",fontWeight:600,fontSize:"0.85rem",marginBottom:4},
  inp:       {width:"100%",padding:"0.6rem 0.8rem",border:"1.5px solid #ddd",borderRadius:8,fontSize:"0.95rem",boxSizing:"border-box"},
};
