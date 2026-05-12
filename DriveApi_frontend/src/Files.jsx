import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { api } from "./axios";

const me = () => JSON.parse(localStorage.getItem("user") || "{}");

export default function Files() {
  const navigate = useNavigate();
  const currentUser = me();
  const isAdmin = currentUser.role === 1;

  // breadcrumb: [{id, name}, ...] — vacío = raíz
  const [breadcrumb, setBreadcrumb] = useState([]);
  const currentDirId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length-1].id : null;

  const [dirs,  setDirs]  = useState([]);
  const [files, setFiles] = useState([]);
  const [totalFiles, setTotalFiles]     = useState(0);
  const [filePage, setFilePage]         = useState(1);
  const [filePageSize, setFilePageSize] = useState(10);
  const [fileFilters, setFileFilters]   = useState({ nombre:"", tipo:"", propietario:"" });

  const [showNewDir, setShowNewDir] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [renaming,  setRenaming]   = useState(null); // {type:'dir'|'file', item}
  const [newName,   setNewName]    = useState("");
  const [modalErr,  setModalErr]   = useState("");
  const [uploading, setUploading]  = useState(false);
  const fileInputRef = useRef(null);

  const loadDirs = useCallback(async () => {
    try {
      const params = { pageSize:100, ...(currentDirId != null ? {parentId:currentDirId} : {}) };
      const { data } = await api.get("/directories", { params });
      setDirs(data.data);
    } catch { setDirs([]); }
  }, [currentDirId]);

  const loadFiles = useCallback(async () => {
    if (currentDirId == null) { setFiles([]); setTotalFiles(0); return; }
    try {
      const params = { directoryId:currentDirId, page:filePage, pageSize:filePageSize,
        ...(fileFilters.nombre      && {nombre:fileFilters.nombre}),
        ...(fileFilters.tipo        && {tipo:fileFilters.tipo}),
        ...(fileFilters.propietario && {propietario:fileFilters.propietario}),
      };
      const { data } = await api.get("/files", { params });
      setFiles(data.data); setTotalFiles(data.total);
    } catch { setFiles([]); }
  }, [currentDirId, filePage, filePageSize, fileFilters]);

  useEffect(() => { loadDirs(); loadFiles(); }, [loadDirs, loadFiles]);

  const enterDir = (dir) => { setBreadcrumb(prev => [...prev, {id:dir.id, name:dir.name}]); setFilePage(1); setFileFilters({nombre:"",tipo:"",propietario:""}); };
  const goTo     = (idx)  => { setBreadcrumb(prev => idx===-1 ? [] : prev.slice(0, idx+1)); setFilePage(1); };

  const createDir = async () => {
    setModalErr("");
    if (!newDirName.trim()) { setModalErr("El nombre no puede estar vacío."); return; }
    try {
      await api.post("/directories", { name:newDirName.trim(), parentId:currentDirId });
      setShowNewDir(false); setNewDirName(""); loadDirs();
    } catch (err) { setModalErr(err.response?.data?.message ?? "Error al crear carpeta."); }
  };

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10*1024*1024) { alert("El archivo excede el límite de 10 MB."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("directoryId", currentDirId);
      await api.post("/files/upload", fd, { headers:{"Content-Type":"multipart/form-data"} });
      loadFiles();
    } catch (err) { alert(err.response?.data?.message ?? "Error al subir."); }
    finally { setUploading(false); e.target.value=""; }
  };

  const download = async (file) => {
    try {
      const res = await api.get(`/files/${file.id}/download`, { responseType:"blob" });
      const url  = URL.createObjectURL(new Blob([res.data]));
      const a    = document.createElement("a");
      a.href = url; a.setAttribute("download", file.name);
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { alert("Error al descargar."); }
  };

  const openRename = (type, item) => { setRenaming({type,item}); setNewName(item.name); setModalErr(""); };
  const rename = async () => {
    setModalErr("");
    if (!newName.trim()) { setModalErr("El nombre no puede estar vacío."); return; }
    try {
      if (renaming.type==="dir") { await api.put(`/directories/${renaming.item.id}`, {name:newName.trim()}); loadDirs(); }
      else                       { await api.put(`/files/${renaming.item.id}`,       {name:newName.trim()}); loadFiles(); }
      setRenaming(null);
    } catch (err) { setModalErr(err.response?.data?.message ?? "Error al renombrar."); }
  };

  const deleteDir = async (dir) => {
    if (!confirm(`¿Eliminar la carpeta "${dir.name}"?`)) return;
    try { await api.delete(`/directories/${dir.id}`); loadDirs(); }
    catch (err) { alert(err.response?.data?.message ?? "Error al eliminar."); }
  };

  const deleteFile = async (file) => {
    if (!confirm(`¿Eliminar el archivo "${file.name}"?`)) return;
    try { await api.delete(`/files/${file.id}`); loadFiles(); }
    catch (err) { alert(err.response?.data?.message ?? "Error al eliminar."); }
  };

  const canModify = (item) => isAdmin || item.owner?.id === currentUser.id;
  const totalFilePages = Math.ceil(totalFiles / filePageSize);

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <h1 style={s.title}>📁 Repositorio de Archivos</h1>
        <div style={{display:"flex",gap:"0.75rem"}}>
          {isAdmin && <button style={s.btnSec} onClick={() => navigate("/usuarios")}>👥 Usuarios</button>}
          <button style={s.btnDng} onClick={() => { localStorage.clear(); navigate("/login"); }}>Cerrar sesión</button>
        </div>
      </header>

      {/* Breadcrumb */}
      <div style={s.breadcrumb}>
        <span style={s.breadLink} onClick={() => goTo(-1)}>🏠 Raíz</span>
        {breadcrumb.map((seg,idx) => (
          <span key={seg.id}>
            <span style={{color:"#aaa",margin:"0 6px"}}>/</span>
            <span style={s.breadLink} onClick={() => goTo(idx)}>{seg.name}</span>
          </span>
        ))}
      </div>

      <div style={s.content}>
        {/* Carpetas */}
        <section style={s.section}>
          <div style={s.secHead}>
            <h2 style={s.secTitle}>Carpetas</h2>
            <button style={s.btnPri} onClick={() => { setShowNewDir(true); setModalErr(""); setNewDirName(""); }}>+ Nueva carpeta</button>
          </div>
          {dirs.length===0
            ? <p style={s.empty}>No hay carpetas aquí.</p>
            : <div style={s.grid}>
                {dirs.map(d => (
                  <div key={d.id} style={s.card}>
                    <div style={s.cardIcon} onClick={() => enterDir(d)}>📁</div>
                    <div style={s.cardName} onClick={() => enterDir(d)}>{d.name}</div>
                    <div style={s.cardMeta}>Por: {d.owner?.name}</div>
                    {canModify(d) && (
                      <div style={s.cardActs}>
                        <button style={s.btnTiny} onClick={() => openRename("dir",d)} title="Renombrar">✏️</button>
                        <button style={{...s.btnTiny,color:"#dc2626"}} onClick={() => deleteDir(d)} title="Eliminar">🗑️</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
          }
        </section>

        {/* Archivos (solo dentro de una carpeta) */}
        {currentDirId != null && (
          <section style={s.section}>
            <div style={s.secHead}>
              <h2 style={s.secTitle}>Archivos</h2>
              <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
                {uploading && <span style={{color:"#6b7280",fontSize:"0.9rem"}}>Subiendo...</span>}
                <input type="file" ref={fileInputRef} style={{display:"none"}} onChange={upload} />
                <button style={s.btnPri} disabled={uploading} onClick={() => fileInputRef.current.click()}>⬆️ Subir archivo</button>
              </div>
            </div>

            {/* Filtros */}
            <div style={s.filtersRow}>
              {[{n:"nombre",ph:"Filtrar por nombre..."},{n:"tipo",ph:"Filtrar por tipo (pdf, image...)"},{n:"propietario",ph:"Filtrar por propietario..."}].map(f=>(
                <input key={f.n} style={s.fi} placeholder={f.ph} value={fileFilters[f.n]}
                  onChange={e => { setFileFilters({...fileFilters,[f.n]:e.target.value}); setFilePage(1); }} />
              ))}
              <select style={s.fi} value={filePageSize} onChange={e => { setFilePageSize(Number(e.target.value)); setFilePage(1); }}>
                {[5,10,25].map(n=><option key={n} value={n}>{n} por página</option>)}
              </select>
            </div>

            {files.length===0
              ? <p style={s.empty}>No hay archivos en esta carpeta.</p>
              : <>
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead><tr>{["Nombre","Tipo","Tamaño","Propietario","Fecha","Acciones"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {files.map(f => (
                          <tr key={f.id} style={s.tr}>
                            <td style={s.td}>{f.name}</td>
                            <td style={s.td}><span style={s.typeBadge}>{f.contentType}</span></td>
                            <td style={s.td}>{f.sizeMB} MB</td>
                            <td style={s.td}>{f.owner?.name}</td>
                            <td style={s.td}>{f.createdAt?.split("T")[0]}</td>
                            <td style={s.td}>
                              <button style={s.btnTiny} onClick={() => download(f)} title="Descargar">⬇️</button>
                              {canModify(f) && <>
                                <button style={s.btnTiny} onClick={() => openRename("file",f)} title="Renombrar">✏️</button>
                                <button style={{...s.btnTiny,color:"#dc2626"}} onClick={() => deleteFile(f)} title="Eliminar">🗑️</button>
                              </>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalFiles > 0 && (
                    <div style={s.pag}>
                      <span style={{color:"#666"}}>{totalFiles} archivos</span>
                      <div style={{display:"flex",gap:8}}>
                        <button style={s.btnPg} disabled={filePage===1} onClick={() => setFilePage(p=>p-1)}>← Ant.</button>
                        <span style={{lineHeight:"2rem"}}>{filePage} / {totalFilePages}</span>
                        <button style={s.btnPg} disabled={filePage>=totalFilePages} onClick={() => setFilePage(p=>p+1)}>Sig. →</button>
                      </div>
                    </div>
                  )}
                </>
            }
          </section>
        )}

        {currentDirId == null && (
          <p style={{color:"#9ca3af",textAlign:"center",marginTop:"2rem",fontSize:"1rem"}}>
            📂 Entra en una carpeta para ver y subir archivos.
          </p>
        )}
      </div>

      {/* Modal: nueva carpeta */}
      {showNewDir && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h2 style={{marginTop:0}}>Nueva carpeta</h2>
            <label style={s.label}>Nombre</label>
            <input style={s.inp} value={newDirName} autoFocus
              onChange={e=>setNewDirName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&createDir()} />
            {modalErr && <p style={s.modalErr}>{modalErr}</p>}
            <div style={s.modalFoot}>
              <button style={s.btnSec} onClick={() => setShowNewDir(false)}>Cancelar</button>
              <button style={s.btnPri} onClick={createDir}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: renombrar */}
      {renaming && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h2 style={{marginTop:0}}>Renombrar {renaming.type==="dir"?"carpeta":"archivo"}</h2>
            <label style={s.label}>Nuevo nombre</label>
            <input style={s.inp} value={newName} autoFocus
              onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&rename()} />
            {modalErr && <p style={s.modalErr}>{modalErr}</p>}
            <div style={s.modalFoot}>
              <button style={s.btnSec} onClick={() => setRenaming(null)}>Cancelar</button>
              <button style={s.btnPri} onClick={rename}>Renombrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page:       {minHeight:"100vh",background:"#f8f9fa",fontFamily:"sans-serif"},
  header:     {background:"#fff",padding:"1rem 2rem",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"},
  title:      {margin:0,fontSize:"1.25rem",fontWeight:700},
  breadcrumb: {padding:"0.75rem 2rem",background:"#fff",borderBottom:"1px solid #f1f5f9",fontSize:"0.9rem",display:"flex",flexWrap:"wrap"},
  breadLink:  {color:"#4f46e5",cursor:"pointer",fontWeight:600},
  content:    {padding:"1.5rem 2rem",display:"flex",flexDirection:"column",gap:"1.5rem"},
  section:    {background:"#fff",borderRadius:12,padding:"1.5rem",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"},
  secHead:    {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"},
  secTitle:   {margin:0,fontSize:"1rem",fontWeight:700,color:"#374151"},
  grid:       {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:"1rem"},
  card:       {border:"1.5px solid #e5e7eb",borderRadius:10,padding:"1rem",textAlign:"center"},
  cardIcon:   {fontSize:"2.5rem",cursor:"pointer"},
  cardName:   {fontWeight:600,fontSize:"0.9rem",marginTop:"0.35rem",cursor:"pointer",wordBreak:"break-word"},
  cardMeta:   {fontSize:"0.75rem",color:"#9ca3af",marginTop:"0.2rem"},
  cardActs:   {marginTop:"0.5rem",display:"flex",justifyContent:"center",gap:"0.25rem"},
  filtersRow: {display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"1rem"},
  fi:         {padding:"0.5rem 0.75rem",borderRadius:8,border:"1.5px solid #ddd",fontSize:"0.875rem",minWidth:140},
  empty:      {color:"#9ca3af",textAlign:"center",padding:"2rem 0"},
  tableWrap:  {overflowX:"auto",borderRadius:8,border:"1px solid #e5e7eb"},
  table:      {width:"100%",borderCollapse:"collapse"},
  th:         {padding:"0.75rem 1rem",textAlign:"left",background:"#f9fafb",fontWeight:700,fontSize:"0.82rem",color:"#6b7280"},
  tr:         {borderBottom:"1px solid #f1f5f9"},
  td:         {padding:"0.7rem 1rem",fontSize:"0.875rem"},
  typeBadge:  {background:"#ede9fe",color:"#6d28d9",borderRadius:20,padding:"2px 8px",fontSize:"0.75rem",fontWeight:600},
  pag:        {display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:"0.75rem"},
  btnPri:     {background:"#4f46e5",color:"#fff",border:"none",borderRadius:8,padding:"0.5rem 1rem",cursor:"pointer",fontWeight:600,fontSize:"0.875rem"},
  btnSec:     {background:"#e5e7eb",color:"#374151",border:"none",borderRadius:8,padding:"0.5rem 1rem",cursor:"pointer",fontWeight:600,fontSize:"0.875rem"},
  btnDng:     {background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:8,padding:"0.5rem 1rem",cursor:"pointer",fontWeight:600,fontSize:"0.875rem"},
  btnTiny:    {background:"none",border:"none",cursor:"pointer",fontSize:"1.1rem",padding:"2px 4px"},
  btnPg:      {background:"#e5e7eb",border:"none",borderRadius:8,padding:"0.4rem 0.9rem",cursor:"pointer"},
  overlay:    {position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100},
  modal:      {background:"#fff",borderRadius:14,padding:"2rem",width:"100%",maxWidth:400,boxShadow:"0 8px 40px rgba(0,0,0,0.18)"},
  label:      {display:"block",fontWeight:600,fontSize:"0.85rem",marginBottom:4},
  inp:        {width:"100%",padding:"0.6rem 0.8rem",border:"1.5px solid #ddd",borderRadius:8,fontSize:"0.95rem",boxSizing:"border-box"},
  modalErr:   {color:"#dc2626",fontSize:"0.875rem",marginTop:"0.5rem"},
  modalFoot:  {display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"1.25rem"},
};
