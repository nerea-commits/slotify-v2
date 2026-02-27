'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, Check, Trash2, Copy, Clock, Euro, GripVertical, ToggleLeft, ToggleRight, Edit2 } from 'lucide-react';

const C = {
  bg: '#0B0F1A', panel: '#111827', panelAlt: '#1A2332',
  green: '#22C55E', greenDim: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redDim: 'rgba(239,68,68,0.1)',
  text: '#F1F5F9', textMid: '#94A3B8', textDim: '#4B5563',
  border: 'rgba(148,163,184,0.07)',
};

interface Servicio {
  id: string;
  empresa_id: string;
  nombre: string;
  duracion_minutos: number;
  precio?: number | null;
  color: string;
  activo: boolean;
  orden: number;
}

interface FormServicio {
  nombre: string;
  duracion_minutos: string;
  precio: string;
  color: string;
}

const COLORS = ['#22C55E','#3B82F6','#A855F7','#F59E0B','#EF4444','#EC4899','#06B6D4','#F97316'];

const DURACIONES = [15,20,30,45,60,75,90,120];

function fmtDuracion(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

// ── MODAL ──────────────────────────────────────────────────────────────
function ModalServicio({
  editando, form, setForm, guardando, error,
  onGuardar, onCerrar,
}: {
  editando: boolean;
  form: FormServicio;
  setForm: React.Dispatch<React.SetStateAction<FormServicio>>;
  guardando: boolean;
  error: string;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:50, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onCerrar}
    >
      <div
        style={{ background: C.panel, borderRadius:'20px 20px 0 0', padding:24, width:'100%', maxWidth:480, paddingBottom:36 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <h3 style={{ fontSize:17, fontWeight:700, color: C.text }}>{editando ? 'Editar servicio' : 'Nuevo servicio'}</h3>
          <button onClick={onCerrar} style={{ background:'none', border:'none', cursor:'pointer', color: C.textMid, padding:4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Nombre */}
          <div>
            <label style={{ fontSize:11, color: C.textMid, fontWeight:700, letterSpacing:0.8, display:'block', marginBottom:7, textTransform:'uppercase' }}>Nombre *</label>
            <input
              type="text" placeholder="Ej: Corte de pelo" value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              autoFocus
              style={{ width:'100%', padding:'12px 14px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:12, color: C.text, fontSize:15, outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {/* Duración */}
          <div>
            <label style={{ fontSize:11, color: C.textMid, fontWeight:700, letterSpacing:0.8, display:'block', marginBottom:7, textTransform:'uppercase' }}>Duración *</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {DURACIONES.map(d => {
                const sel = String(d) === form.duracion_minutos;
                return (
                  <button key={d} onClick={() => setForm(p => ({ ...p, duracion_minutos: String(d) }))}
                    style={{
                      padding:'7px 12px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                      background: sel ? C.green : C.panelAlt,
                      color: sel ? '#fff' : C.textMid,
                      outline: sel ? 'none' : `1px solid ${C.border}`,
                      transition:'all 0.12s',
                    }}>
                    {fmtDuracion(d)}
                  </button>
                );
              })}
            </div>
            <input
              type="number" placeholder="Otra duración (min)" min={5} max={480}
              value={DURACIONES.includes(Number(form.duracion_minutos)) ? '' : form.duracion_minutos}
              onChange={e => setForm(p => ({ ...p, duracion_minutos: e.target.value }))}
              style={{ marginTop:8, width:'100%', padding:'10px 14px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:10, color: C.text, fontSize:14, outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {/* Precio + Color en fila */}
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:11, color: C.textMid, fontWeight:700, letterSpacing:0.8, display:'block', marginBottom:7, textTransform:'uppercase' }}>Precio (opcional)</label>
              <div style={{ position:'relative' }}>
                <input
                  type="text" inputMode="decimal" placeholder="0.00" value={form.precio}
                  onChange={e => setForm(p => ({ ...p, precio: e.target.value }))}
                  style={{ width:'100%', padding:'12px 14px', paddingRight:32, background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:12, color: C.text, fontSize:15, outline:'none', boxSizing:'border-box' }}
                />
                <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color: C.textDim, fontSize:13 }}>€</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize:11, color: C.textMid, fontWeight:700, letterSpacing:0.8, display:'block', marginBottom:7, textTransform:'uppercase' }}>Color</label>
              <div style={{ display:'flex', gap:5 }}>
                {COLORS.map(col => (
                  <button key={col} onClick={() => setForm(p => ({ ...p, color: col }))}
                    style={{
                      width:26, height:26, borderRadius:8, border:'none', cursor:'pointer',
                      background: col,
                      outline: form.color === col ? `2px solid ${col}` : 'none',
                      outlineOffset: 2,
                      transform: form.color === col ? 'scale(1.15)' : 'scale(1)',
                      transition:'all 0.12s',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {error && <p style={{ color: C.red, fontSize:13 }}>{error}</p>}

          <button onClick={onGuardar} disabled={guardando}
            style={{ width:'100%', padding:'14px', borderRadius:13, border:'none', background: guardando ? '#166534' : C.green, color:'#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize:15, fontWeight:700, opacity: guardando ? 0.7 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            {guardando ? 'Guardando...' : (<><Check size={16}/>{editando ? 'Guardar cambios' : 'Crear servicio'}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────
export default function ServiciosSection({ empresaId }: { empresaId: string }) {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Servicio | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState<FormServicio>({ nombre:'', duracion_minutos:'60', precio:'', color: C.green });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<string | null>(null);

  useEffect(() => { if (empresaId) load(); }, [empresaId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('servicios').select('*')
      .eq('empresa_id', empresaId)
      .order('orden').order('nombre');
    setServicios(data || []);
    setLoading(false);
  }

  function openNew() {
    setEditTarget(null);
    setForm({ nombre:'', duracion_minutos:'60', precio:'', color: C.green });
    setError('');
    setModalOpen(true);
  }

  function openEdit(s: Servicio) {
    setEditTarget(s);
    setForm({
      nombre: s.nombre,
      duracion_minutos: String(s.duracion_minutos),
      precio: s.precio != null ? String(s.precio) : '',
      color: s.color || C.green,
    });
    setError('');
    setModalOpen(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    const dur = parseInt(form.duracion_minutos);
    if (!dur || dur < 5) { setError('Duración mínima: 5 minutos'); return; }

    setGuardando(true); setError('');

    const data: any = {
      nombre: form.nombre.trim(),
      duracion_minutos: dur,
      precio: form.precio.trim() ? parseFloat(form.precio.replace(',','.')) : null,
      color: form.color,
      empresa_id: empresaId,
    };

    if (editTarget) {
      const { error: err } = await supabase.from('servicios').update(data).eq('id', editTarget.id);
      if (err) { setError('Error al guardar'); setGuardando(false); return; }
    } else {
      const maxOrden = servicios.length > 0 ? Math.max(...servicios.map(s => s.orden)) + 1 : 0;
      data.orden = maxOrden;
      data.activo = true;
      const { error: err } = await supabase.from('servicios').insert(data);
      if (err) { setError('Error al crear'); setGuardando(false); return; }
    }

    await load();
    setModalOpen(false);
    setGuardando(false);
  }

  async function toggleActivo(s: Servicio) {
    await supabase.from('servicios').update({ activo: !s.activo }).eq('id', s.id);
    setServicios(prev => prev.map(x => x.id === s.id ? { ...x, activo: !x.activo } : x));
  }

  async function duplicar(s: Servicio) {
    const maxOrden = servicios.length > 0 ? Math.max(...servicios.map(x => x.orden)) + 1 : 0;
    await supabase.from('servicios').insert({
      empresa_id: empresaId,
      nombre: s.nombre + ' (copia)',
      duracion_minutos: s.duracion_minutos,
      precio: s.precio,
      color: s.color,
      activo: true,
      orden: maxOrden,
    });
    await load();
  }

  async function eliminar(id: string) {
    await supabase.from('servicios').delete().eq('id', id);
    setConfirmDelete(null);
    await load();
  }

  // ── Drag & drop reorder ──
  function onDragStart(id: string) { setDragItem(id); }
  function onDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setDragOver(id); }
  async function onDrop(targetId: string) {
    if (!dragItem || dragItem === targetId) { setDragItem(null); setDragOver(null); return; }
    const list = [...servicios];
    const fromIdx = list.findIndex(s => s.id === dragItem);
    const toIdx = list.findIndex(s => s.id === targetId);
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    const updated = list.map((s, i) => ({ ...s, orden: i }));
    setServicios(updated);
    setDragItem(null);
    setDragOver(null);
    // Persist order
    for (const s of updated) {
      await supabase.from('servicios').update({ orden: s.orden }).eq('id', s.id);
    }
  }

  const activos = servicios.filter(s => s.activo);
  const inactivos = servicios.filter(s => !s.activo);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color: C.textMid, fontSize:14 }}>
      Cargando servicios...
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight:'100vh', color: C.text, paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom:`1px solid ${C.border}`, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700 }}>Servicios</h2>
          <p style={{ fontSize:12, color: C.textMid, marginTop:2 }}>
            {activos.length} activo{activos.length !== 1 ? 's' : ''}
            {inactivos.length > 0 && ` · ${inactivos.length} inactivo${inactivos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={openNew}
          style={{ background: C.green, color:'#fff', border:'none', borderRadius:12, padding:'10px 16px', cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
          <Plus size={15}/> Nuevo
        </button>
      </div>

      <div style={{ padding:'16px 16px 0', maxWidth:640, margin:'0 auto' }}>

        {servicios.length === 0 ? (
          /* Estado vacío */
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✂️</div>
            <p style={{ fontSize:16, fontWeight:600, color: C.textMid, marginBottom:8 }}>Sin servicios todavía</p>
            <p style={{ fontSize:13, color: C.textDim, marginBottom:24, lineHeight:1.6 }}>
              Los servicios son opcionales — puedes crear citas sin ellos.<br/>
              Si los configuras, ahorrarás tiempo al rellenar citas.
            </p>
            <button onClick={openNew}
              style={{ background: C.green, color:'#fff', border:'none', borderRadius:13, padding:'13px 28px', cursor:'pointer', fontSize:14, fontWeight:700 }}>
              Crear primer servicio
            </button>
          </div>
        ) : (
          <>
            {/* Lista activos */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {activos.map(s => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => onDragStart(s.id)}
                  onDragOver={e => onDragOver(e, s.id)}
                  onDrop={() => onDrop(s.id)}
                  onDragEnd={() => { setDragItem(null); setDragOver(null); }}
                  style={{
                    background: C.panel,
                    border: `1px solid ${dragOver === s.id ? C.green + '44' : C.border}`,
                    borderRadius:14, padding:'12px 14px',
                    display:'flex', alignItems:'center', gap:12,
                    opacity: dragItem === s.id ? 0.5 : 1,
                    transition:'all 0.12s',
                    cursor:'default',
                  }}
                >
                  {/* Drag handle */}
                  <div style={{ color: C.textDim, cursor:'grab', flexShrink:0, display:'flex', alignItems:'center' }}>
                    <GripVertical size={14}/>
                  </div>

                  {/* Color dot */}
                  <div style={{ width:10, height:10, borderRadius:3, background: s.color || C.green, flexShrink:0 }}/>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:14, fontWeight:600, color: C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.nombre}
                    </p>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:2 }}>
                      <span style={{ fontSize:11, color: C.textMid, display:'flex', alignItems:'center', gap:3 }}>
                        <Clock size={10}/> {fmtDuracion(s.duracion_minutos)}
                      </span>
                      {s.precio != null && s.precio > 0 && (
                        <span style={{ fontSize:11, color: C.green, fontWeight:600, display:'flex', alignItems:'center', gap:3 }}>
                          {s.precio}€
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                    <button onClick={() => openEdit(s)} title="Editar"
                      style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:6, borderRadius:7, display:'flex' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.panelAlt; (e.currentTarget as HTMLElement).style.color = C.text; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = C.textDim; }}>
                      <Edit2 size={13}/>
                    </button>
                    <button onClick={() => duplicar(s)} title="Duplicar"
                      style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:6, borderRadius:7, display:'flex' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.panelAlt; (e.currentTarget as HTMLElement).style.color = C.text; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = C.textDim; }}>
                      <Copy size={13}/>
                    </button>
                    <button onClick={() => toggleActivo(s)} title="Desactivar"
                      style={{ background:'none', border:'none', cursor:'pointer', color: C.green, padding:6, borderRadius:7, display:'flex' }}>
                      <ToggleRight size={17}/>
                    </button>
                    {confirmDelete === s.id ? (
                      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                        <button onClick={() => eliminar(s.id)}
                          style={{ padding:'4px 8px', borderRadius:6, border:'none', background: C.red, color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                          Eliminar
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          style={{ padding:'4px 8px', borderRadius:6, border:'none', background: C.panelAlt, color: C.textMid, cursor:'pointer', fontSize:11 }}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(s.id)} title="Eliminar"
                        style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:6, borderRadius:7, display:'flex' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.red; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.textDim; }}>
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Inactivos */}
            {inactivos.length > 0 && (
              <div style={{ marginTop:20 }}>
                <p style={{ fontSize:10, color: C.textDim, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:8, paddingLeft:4 }}>
                  Inactivos
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {inactivos.map(s => (
                    <div key={s.id} style={{
                      background: C.panel, border:`1px solid ${C.border}`, borderRadius:14, padding:'10px 14px',
                      display:'flex', alignItems:'center', gap:12, opacity:0.55,
                    }}>
                      <div style={{ width:10, height:10, borderRadius:3, background: s.color || C.textDim, flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, color: C.textMid, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.nombre}</p>
                        <span style={{ fontSize:11, color: C.textDim }}>{fmtDuracion(s.duracion_minutos)}</span>
                      </div>
                      <button onClick={() => toggleActivo(s)} title="Activar"
                        style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:6, display:'flex' }}>
                        <ToggleLeft size={17}/>
                      </button>
                      <button onClick={() => setConfirmDelete(s.id)} title="Eliminar"
                        style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:6, display:'flex' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.red; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.textDim; }}>
                        {confirmDelete === s.id ? (
                          <span onClick={() => eliminar(s.id)} style={{ fontSize:11, color: C.red, fontWeight:700 }}>Eliminar</span>
                        ) : <Trash2 size={13}/>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <ModalServicio
          editando={!!editTarget}
          form={form} setForm={setForm}
          guardando={guardando} error={error}
          onGuardar={guardar} onCerrar={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
