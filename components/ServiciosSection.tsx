'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, Check, Trash2, Copy, Clock, GripVertical, ToggleLeft, ToggleRight, Edit2, Upload, Download, AlertTriangle, CheckCircle2, MoreVertical } from 'lucide-react';

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

// ── CSV IMPORT ─────────────────────────────────────────────────────────
interface CsvRow {
  nombre: string;
  duracion_minutos: number;
  precio: number | null;
  color: string;
  _line: number;
  _error?: string;
}

const CSV_TEMPLATE = `nombre,duracion,precio,color
Corte de pelo,30,15,#22C55E
Tinte completo,90,45,#3B82F6
Manicura,45,20,#A855F7`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'plantilla_servicios.csv';
  a.click(); URL.revokeObjectURL(url);
}

function normalizeDuracion(val: string): number | null {
  const clean = val.replace(/[^0-9]/g, '');
  const n = parseInt(clean);
  return isNaN(n) || n < 5 ? null : n;
}

function normalizePrecio(val: string): number | null {
  if (!val || !val.trim()) return null;
  const clean = val.trim().replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function normalizeColor(val: string): string {
  if (!val || !val.trim()) return '#22C55E';
  const v = val.trim();
  if (v.startsWith('#')) return v;
  const named: Record<string, string> = { verde:'#22C55E', azul:'#3B82F6', rojo:'#EF4444', naranja:'#F97316', morado:'#A855F7', rosa:'#EC4899', cyan:'#06B6D4', amarillo:'#F59E0B' };
  return named[v.toLowerCase()] || '#22C55E';
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const col = (row: string[], names: string[]): string => {
    for (const n of names) {
      const idx = headers.indexOf(n);
      if (idx !== -1 && row[idx] !== undefined) return (row[idx] || '').trim();
    }
    return '';
  };
  return lines.slice(1).map((line, i) => {
    const row = line.split(',');
    const nombre = col(row, ['nombre', 'name']);
    const durRaw = col(row, ['duracion', 'duration', 'minutos', 'min']);
    const precioRaw = col(row, ['precio', 'price']);
    const colorRaw = col(row, ['color']);
    const errors: string[] = [];
    if (!nombre) errors.push('nombre vacío');
    const dur = normalizeDuracion(durRaw);
    if (dur === null) errors.push('duración inválida');
    return {
      nombre, duracion_minutos: dur ?? 0,
      precio: normalizePrecio(precioRaw),
      color: normalizeColor(colorRaw),
      _line: i + 2,
      _error: errors.length ? errors.join(', ') : undefined,
    };
  }).filter(r => r.nombre || r._error);
}

// ── IMPORT MODAL ───────────────────────────────────────────────────────
type ImportStep = 1 | 2 | 3;

function ModalImportar({
  empresaId, serviciosExistentes, onDone, onCerrar,
}: {
  empresaId: string;
  serviciosExistentes: Servicio[];
  onDone: (msg: string) => void;
  onCerrar: () => void;
}) {
  const [step, setStep] = useState<ImportStep>(1);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [actualizarSiCoincide, setActualizarSiCoincide] = useState(false);
  const [importando, setImportando] = useState(false);

  const validas = rows.filter(r => !r._error);
  const conError = rows.filter(r => !!r._error);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setRows(parseCSV(text));
      setStep(3);
    };
    reader.readAsText(f, 'UTF-8');
  }

  async function confirmar() {
    setImportando(true);
    let creados = 0, actualizados = 0;
    const errores: CsvRow[] = [];
    const maxOrden = serviciosExistentes.length > 0 ? Math.max(...serviciosExistentes.map(s => s.orden)) : 0;
    for (let i = 0; i < validas.length; i++) {
      const r = validas[i];
      try {
        if (actualizarSiCoincide) {
          const existing = serviciosExistentes.find(s => s.nombre.toLowerCase().trim() === r.nombre.toLowerCase().trim());
          if (existing) {
            await supabase.from('servicios').update({ duracion_minutos: r.duracion_minutos, precio: r.precio, color: r.color }).eq('id', existing.id);
            actualizados++; continue;
          }
        }
        await supabase.from('servicios').insert({ empresa_id: empresaId, nombre: r.nombre, duracion_minutos: r.duracion_minutos, precio: r.precio, color: r.color, activo: true, orden: maxOrden + i + 1 });
        creados++;
      } catch { errores.push({ ...r, _error: 'Error al guardar en BD' }); }
    }
    setImportando(false);
    const msg = [creados > 0 ? `Creados: ${creados}` : '', actualizados > 0 ? `Actualizados: ${actualizados}` : '', (conError.length + errores.length) > 0 ? `Errores: ${conError.length + errores.length}` : ''].filter(Boolean).join(' · ');
    onDone(msg);
  }

  return (
    <>
      <style>{`@media (min-width: 640px) { .imp-modal-overlay { align-items: center !important; } .imp-modal-box { border-radius: 16px !important; max-width: 520px !important; } }`}</style>
      <div className="imp-modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:60, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onCerrar}>
        <div className="imp-modal-box" style={{ background:'#111827', borderRadius:'20px 20px 0 0', padding:24, width:'100%', maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', paddingBottom:32 }} onClick={e => e.stopPropagation()}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <h3 style={{ fontSize:17, fontWeight:700, color:'#F1F5F9' }}>Importar servicios</h3>
              <p style={{ fontSize:11, color:'#4B5563', marginTop:2 }}>Paso {step} de 3</p>
            </div>
            <button onClick={onCerrar} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', padding:4 }}><X size={18}/></button>
          </div>
          <div style={{ height:3, background:'rgba(148,163,184,0.1)', borderRadius:2, marginBottom:24, overflow:'hidden' }}>
            <div style={{ height:'100%', background:'#22C55E', width:`${(step/3)*100}%`, transition:'width 0.3s', borderRadius:2 }}/>
          </div>
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ background:'#1A2332', borderRadius:12, padding:16 }}>
                <p style={{ fontSize:13, fontWeight:600, color:'#F1F5F9', marginBottom:6 }}>📋 Descarga la plantilla CSV</p>
                <p style={{ fontSize:12, color:'#64748B', lineHeight:1.6, marginBottom:12 }}>Columnas: <code style={{ color:'#22C55E', fontSize:11 }}>nombre</code>, <code style={{ color:'#22C55E', fontSize:11 }}>duracion</code>, <code style={{ color:'#22C55E', fontSize:11 }}>precio</code> (opcional), <code style={{ color:'#22C55E', fontSize:11 }}>color</code> (opcional).</p>
                <button onClick={downloadTemplate} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', borderRadius:9, border:'1px solid rgba(34,197,94,0.3)', background:'rgba(34,197,94,0.08)', color:'#22C55E', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                  <Download size={14}/> Descargar plantilla.csv
                </button>
              </div>
              <button onClick={() => setStep(2)} style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'#22C55E', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:700 }}>Tengo el CSV listo →</button>
            </div>
          )}
          {step === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'32px 20px', background:'#1A2332', border:'2px dashed rgba(34,197,94,0.25)', borderRadius:14, cursor:'pointer' }}>
                <Upload size={28} style={{ color:'#22C55E' }}/>
                <div style={{ textAlign:'center' }}>
                  <p style={{ fontSize:14, fontWeight:600, color:'#F1F5F9' }}>Selecciona o arrastra tu CSV</p>
                  <p style={{ fontSize:12, color:'#4B5563', marginTop:4 }}>Solo archivos .csv</p>
                </div>
                <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{ position:'absolute', width:1, height:1, opacity:0, pointerEvents:'none' }}/>
              </label>
              <button onClick={() => setStep(1)} style={{ background:'none', border:'none', color:'#64748B', cursor:'pointer', fontSize:13, textDecoration:'underline' }}>← Volver</button>
            </div>
          )}
          {step === 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
                  <p style={{ fontSize:22, fontWeight:800, color:'#22C55E' }}>{validas.length}</p>
                  <p style={{ fontSize:11, color:'#64748B', fontWeight:600 }}>VÁLIDAS</p>
                </div>
                {conError.length > 0 && (
                  <div style={{ flex:1, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
                    <p style={{ fontSize:22, fontWeight:800, color:'#EF4444' }}>{conError.length}</p>
                    <p style={{ fontSize:11, color:'#64748B', fontWeight:600 }}>CON ERROR</p>
                  </div>
                )}
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#1A2332', borderRadius:10, cursor:'pointer' }}>
                <input type="checkbox" checked={actualizarSiCoincide} onChange={e => setActualizarSiCoincide(e.target.checked)} style={{ width:16, height:16, accentColor:'#22C55E' }}/>
                <div>
                  <p style={{ fontSize:13, color:'#F1F5F9', fontWeight:500 }}>Actualizar si el nombre coincide</p>
                  <p style={{ fontSize:11, color:'#4B5563' }}>Si está desactivado, siempre crea nuevos</p>
                </div>
              </label>
              <div style={{ maxHeight:220, overflowY:'auto', borderRadius:10, border:'1px solid rgba(148,163,184,0.07)' }}>
                {rows.slice(0,10).map((r,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background: i%2===0 ? '#1A2332' : '#111827', borderLeft: r._error ? '3px solid #EF4444' : '3px solid #22C55E' }}>
                    <div style={{ width:8, height:8, borderRadius:2, background: r._error ? '#EF4444' : r.color, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:600, color: r._error ? '#EF4444' : '#F1F5F9', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {r.nombre || '(sin nombre)'}{r._error && <span style={{ fontSize:10, color:'#EF4444', marginLeft:6, fontWeight:400 }}>— {r._error}</span>}
                      </p>
                      {!r._error && <p style={{ fontSize:10, color:'#4B5563' }}>{fmtDuracion(r.duracion_minutos)}{r.precio != null ? ` · ${r.precio}€` : ''}</p>}
                    </div>
                    <span style={{ fontSize:10, color:'#334155', flexShrink:0 }}>L{r._line}</span>
                  </div>
                ))}
                {rows.length > 10 && <div style={{ padding:'8px 12px', background:'#111827', textAlign:'center' }}><p style={{ fontSize:11, color:'#4B5563' }}>+{rows.length-10} filas más</p></div>}
              </div>
              {validas.length === 0 && <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'rgba(239,68,68,0.08)', borderRadius:10, border:'1px solid rgba(239,68,68,0.2)' }}><AlertTriangle size={14} style={{ color:'#EF4444' }}/><p style={{ fontSize:13, color:'#EF4444' }}>No hay filas válidas para importar.</p></div>}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => { setStep(2); setRows([]); }} style={{ flex:1, padding:'12px', borderRadius:12, border:'1px solid rgba(148,163,184,0.1)', background:'transparent', color:'#94A3B8', cursor:'pointer', fontSize:13, fontWeight:600 }}>← Cambiar CSV</button>
                <button onClick={confirmar} disabled={importando || validas.length === 0} style={{ flex:2, padding:'12px', borderRadius:12, border:'none', background: validas.length===0 ? '#1A2332' : '#22C55E', color: validas.length===0 ? '#334155' : '#fff', cursor: validas.length===0 ? 'not-allowed' : 'pointer', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {importando ? 'Importando...' : <><CheckCircle2 size={15}/> Importar {validas.length} servicios</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function fmtDuracion(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

// ── MODAL SERVICIO ─────────────────────────────────────────────────────
function ModalServicio({ editando, form, setForm, guardando, error, onGuardar, onCerrar }: {
  editando: boolean; form: FormServicio; setForm: React.Dispatch<React.SetStateAction<FormServicio>>;
  guardando: boolean; error: string; onGuardar: () => void; onCerrar: () => void;
}) {
  return (
    <>
      <style>{`@media (min-width: 640px) { .svc-modal-overlay { align-items: center !important; } .svc-modal-box { border-radius: 16px !important; max-width: 480px !important; } }`}</style>
      <div className="svc-modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:50, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onCerrar}>
        <div className="svc-modal-box" style={{ background: C.panel, borderRadius:'20px 20px 0 0', padding:24, width:'100%', maxWidth:'100%', paddingBottom:36, maxHeight:'92vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
            <h3 style={{ fontSize:17, fontWeight:700, color: C.text }}>{editando ? 'Editar servicio' : 'Nuevo servicio'}</h3>
            <button onClick={onCerrar} style={{ background:'none', border:'none', cursor:'pointer', color: C.textMid, padding:4 }}><X size={18}/></button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ fontSize:11, color: C.textMid, fontWeight:700, letterSpacing:0.8, display:'block', marginBottom:7, textTransform:'uppercase' }}>Nombre *</label>
              <input type="text" placeholder="Ej: Corte de pelo" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} autoFocus
                style={{ width:'100%', padding:'12px 14px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:12, color: C.text, fontSize:15, outline:'none', boxSizing:'border-box' }}/>
            </div>
            <div>
              <label style={{ fontSize:11, color: C.textMid, fontWeight:700, letterSpacing:0.8, display:'block', marginBottom:7, textTransform:'uppercase' }}>Duración *</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {DURACIONES.map(d => {
                  const sel = String(d) === form.duracion_minutos;
                  return <button key={d} onClick={() => setForm(p => ({ ...p, duracion_minutos: String(d) }))} style={{ padding:'7px 12px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: sel ? C.green : C.panelAlt, color: sel ? '#fff' : C.textMid, outline: sel ? 'none' : `1px solid ${C.border}`, transition:'all 0.12s' }}>{fmtDuracion(d)}</button>;
                })}
              </div>
              <input type="number" placeholder="Otra duración (min)" min={5} max={480} value={DURACIONES.includes(Number(form.duracion_minutos)) ? '' : form.duracion_minutos} onChange={e => setForm(p => ({ ...p, duracion_minutos: e.target.value }))}
                style={{ marginTop:8, width:'100%', padding:'10px 14px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:10, color: C.text, fontSize:14, outline:'none', boxSizing:'border-box' }}/>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color: C.textMid, fontWeight:700, letterSpacing:0.8, display:'block', marginBottom:7, textTransform:'uppercase' }}>Precio (opcional)</label>
                <div style={{ position:'relative' }}>
                  <input type="text" inputMode="decimal" placeholder="0.00" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))}
                    style={{ width:'100%', padding:'12px 14px', paddingRight:32, background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:12, color: C.text, fontSize:15, outline:'none', boxSizing:'border-box' }}/>
                  <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color: C.textDim, fontSize:13 }}>€</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize:11, color: C.textMid, fontWeight:700, letterSpacing:0.8, display:'block', marginBottom:7, textTransform:'uppercase' }}>Color</label>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {COLORS.map(col => <button key={col} onClick={() => setForm(p => ({ ...p, color: col }))} style={{ width:26, height:26, borderRadius:8, border:'none', cursor:'pointer', background: col, outline: form.color===col ? `2px solid ${col}` : 'none', outlineOffset:2, transform: form.color===col ? 'scale(1.15)' : 'scale(1)', transition:'all 0.12s' }}/>)}
                </div>
              </div>
            </div>
            {error && <p style={{ color: C.red, fontSize:13 }}>{error}</p>}
            <button onClick={onGuardar} disabled={guardando} style={{ width:'100%', padding:'14px', borderRadius:13, border:'none', background: guardando ? '#166534' : C.green, color:'#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize:15, fontWeight:700, opacity: guardando ? 0.7 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {guardando ? 'Guardando...' : (<><Check size={16}/>{editando ? 'Guardar cambios' : 'Crear servicio'}</>)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── MOBILE ACTION SHEET ────────────────────────────────────────────────
function ActionSheet({ servicio, onEdit, onDuplicate, onToggle, onDelete, onCerrar }: {
  servicio: Servicio;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onCerrar: () => void;
}) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:60, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onCerrar}>
      <div style={{ background:'#111827', borderRadius:'20px 20px 0 0', padding:'20px 16px 36px', width:'100%', maxWidth:'100%' }} onClick={e => e.stopPropagation()}>
        {/* Título */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, paddingBottom:14, borderBottom:'1px solid rgba(148,163,184,0.07)' }}>
          <div style={{ width:10, height:10, borderRadius:3, background: servicio.color, flexShrink:0 }}/>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:C.text }}>{servicio.nombre}</p>
            <p style={{ fontSize:11, color:C.textDim }}>{fmtDuracion(servicio.duracion_minutos)}{servicio.precio ? ` · ${servicio.precio}€` : ''}</p>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <button onClick={() => { onEdit(); onCerrar(); }}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'13px 16px', borderRadius:12, border:'none', background:'transparent', color:C.text, cursor:'pointer', fontSize:14, fontWeight:500, textAlign:'left' }}>
            <Edit2 size={17} style={{ color:C.textMid }}/> Editar
          </button>
          <button onClick={() => { onDuplicate(); onCerrar(); }}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'13px 16px', borderRadius:12, border:'none', background:'transparent', color:C.text, cursor:'pointer', fontSize:14, fontWeight:500, textAlign:'left' }}>
            <Copy size={17} style={{ color:C.textMid }}/> Duplicar
          </button>
          <button onClick={() => { onToggle(); onCerrar(); }}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'13px 16px', borderRadius:12, border:'none', background:'transparent', color:C.text, cursor:'pointer', fontSize:14, fontWeight:500, textAlign:'left' }}>
            {servicio.activo
              ? <ToggleRight size={17} style={{ color:C.green }}/> 
              : <ToggleLeft size={17} style={{ color:C.textMid }}/>}
            {servicio.activo ? 'Desactivar' : 'Activar'}
          </button>
          <div style={{ height:1, background:'rgba(148,163,184,0.07)', margin:'4px 0' }}/>
          <button onClick={() => { onDelete(); onCerrar(); }}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'13px 16px', borderRadius:12, border:'none', background:'rgba(239,68,68,0.08)', color:C.red, cursor:'pointer', fontSize:14, fontWeight:600, textAlign:'left' }}>
            <Trash2 size={17}/> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────
export default function ServiciosSection({ empresaId, canEdit = true }: { empresaId: string; canEdit?: boolean }) {
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
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [actionSheet, setActionSheet] = useState<Servicio | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { if (empresaId) load(); }, [empresaId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('servicios').select('*').eq('empresa_id', empresaId).order('orden').order('nombre');
    setServicios(data || []);
    setLoading(false);
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000); }

  function openNew() {
    setEditTarget(null);
    setForm({ nombre:'', duracion_minutos:'60', precio:'', color: C.green });
    setError('');
    setModalOpen(true);
  }

  function openEdit(s: Servicio) {
    setEditTarget(s);
    setForm({ nombre: s.nombre, duracion_minutos: String(s.duracion_minutos), precio: s.precio != null ? String(s.precio) : '', color: s.color || C.green });
    setError('');
    setModalOpen(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    const dur = parseInt(form.duracion_minutos);
    if (!dur || dur < 5) { setError('Duración mínima: 5 minutos'); return; }
    setGuardando(true); setError('');
    const data: any = { nombre: form.nombre.trim(), duracion_minutos: dur, precio: form.precio.trim() ? parseFloat(form.precio.replace(',','.')) : null, color: form.color, empresa_id: empresaId };
    if (editTarget) {
      const { error: err } = await supabase.from('servicios').update(data).eq('id', editTarget.id);
      if (err) { setError('Error al guardar'); setGuardando(false); return; }
    } else {
      const maxOrden = servicios.length > 0 ? Math.max(...servicios.map(s => s.orden)) + 1 : 0;
      data.orden = maxOrden; data.activo = true;
      const { error: err } = await supabase.from('servicios').insert(data);
      if (err) { setError('Error al crear'); setGuardando(false); return; }
    }
    await load(); setModalOpen(false); setGuardando(false);
  }

  async function toggleActivo(s: Servicio) {
    await supabase.from('servicios').update({ activo: !s.activo }).eq('id', s.id);
    setServicios(prev => prev.map(x => x.id === s.id ? { ...x, activo: !x.activo } : x));
  }

  async function duplicar(s: Servicio) {
    const maxOrden = servicios.length > 0 ? Math.max(...servicios.map(x => x.orden)) + 1 : 0;
    await supabase.from('servicios').insert({ empresa_id: empresaId, nombre: s.nombre + ' (copia)', duracion_minutos: s.duracion_minutos, precio: s.precio, color: s.color, activo: true, orden: maxOrden });
    await load();
  }

  async function eliminar(id: string) {
    await supabase.from('servicios').delete().eq('id', id);
    setConfirmDelete(null);
    await load();
  }

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
    setServicios(updated); setDragItem(null); setDragOver(null);
    for (const s of updated) await supabase.from('servicios').update({ orden: s.orden }).eq('id', s.id);
  }

  const activos = servicios.filter(s => s.activo);
  const inactivos = servicios.filter(s => !s.activo);

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color: C.textMid, fontSize:14 }}>Cargando servicios...</div>;

  return (
    <div style={{ background: C.bg, minHeight:'100vh', color: C.text, paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom:`1px solid ${C.border}`, padding: isMobile ? '12px 14px' : '16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <h2 style={{ fontSize: isMobile ? 17 : 18, fontWeight:700 }}>Servicios</h2>
          <p style={{ fontSize:12, color: C.textMid, marginTop:2 }}>
            {activos.length} activo{activos.length !== 1 ? 's' : ''}
            {inactivos.length > 0 && ` · ${inactivos.length} inactivo${inactivos.length !== 1 ? 's' : ''}`}
            {!canEdit && <span style={{ marginLeft:8, fontSize:11, color: C.textDim, background: 'rgba(148,163,184,0.08)', padding:'2px 8px', borderRadius:6 }}>Solo lectura</span>}
          </p>
        </div>
        {canEdit && (
          <div style={{ display:'flex', gap:8 }}>
            {/* En móvil, ocultar "Importar" y añadirlo dentro de un menú o dejarlo solo el botón nuevo */}
            {!isMobile && (
              <button onClick={() => setImportOpen(true)}
                style={{ background:'transparent', color: C.textMid, border:`1px solid ${C.border}`, borderRadius:12, padding:'9px 14px', cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                <Upload size={13}/> Importar
              </button>
            )}
            {isMobile && (
              <button onClick={() => setImportOpen(true)}
                style={{ background:'transparent', color: C.textMid, border:`1px solid ${C.border}`, borderRadius:10, padding:'9px 10px', cursor:'pointer', display:'flex', alignItems:'center' }}>
                <Upload size={16}/>
              </button>
            )}
            <button onClick={openNew} style={{ background: C.green, color:'#fff', border:'none', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '9px 14px' : '10px 16px', cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
              <Plus size={15}/> Nuevo
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: isMobile ? '12px 12px 0' : '16px 16px 0', maxWidth:640, margin:'0 auto' }}>
        {servicios.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✂️</div>
            <p style={{ fontSize:16, fontWeight:600, color: C.textMid, marginBottom:8 }}>Sin servicios todavía</p>
            <p style={{ fontSize:13, color: C.textDim, marginBottom:24, lineHeight:1.6 }}>Los servicios son opcionales — puedes crear citas sin ellos.<br/>Si los configuras, ahorrarás tiempo al rellenar citas.</p>
            {canEdit && <button onClick={openNew} style={{ background: C.green, color:'#fff', border:'none', borderRadius:13, padding:'13px 28px', cursor:'pointer', fontSize:14, fontWeight:700 }}>Crear primer servicio</button>}
          </div>
        ) : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {activos.map(s => (
                <div key={s.id}
                  draggable={canEdit && !isMobile}
                  onDragStart={() => canEdit && !isMobile && onDragStart(s.id)}
                  onDragOver={e => canEdit && !isMobile && onDragOver(e, s.id)}
                  onDrop={() => canEdit && !isMobile && onDrop(s.id)}
                  onDragEnd={() => { setDragItem(null); setDragOver(null); }}
                  style={{ background: C.panel, border:`1px solid ${dragOver===s.id ? C.green+'44' : C.border}`, borderRadius:14, padding: isMobile ? '12px 12px' : '12px 14px', display:'flex', alignItems:'center', gap:10, opacity: dragItem===s.id ? 0.5 : 1, transition:'all 0.12s', cursor:'default' }}>

                  {/* Grip solo en desktop */}
                  {canEdit && !isMobile && <div style={{ color: C.textDim, cursor:'grab', flexShrink:0, display:'flex', alignItems:'center' }}><GripVertical size={14}/></div>}

                  <div style={{ width:10, height:10, borderRadius:3, background: s.color||C.green, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize: isMobile ? 13 : 14, fontWeight:600, color: C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.nombre}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
                      <span style={{ fontSize:11, color: C.textMid, display:'flex', alignItems:'center', gap:3 }}><Clock size={10}/> {fmtDuracion(s.duracion_minutos)}</span>
                      {s.precio != null && s.precio > 0 && <span style={{ fontSize:11, color: C.green, fontWeight:700 }}>{s.precio}€</span>}
                    </div>
                  </div>

                  {/* Acciones: móvil = botón "..." → action sheet | desktop = botones individuales */}
                  {canEdit && (
                    isMobile ? (
                      <button onClick={() => setActionSheet(s)}
                        style={{ background:'none', border:'none', cursor:'pointer', color: C.textMid, padding:'6px 4px', borderRadius:8, display:'flex', alignItems:'center', flexShrink:0 }}>
                        <MoreVertical size={18}/>
                      </button>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:2, flexShrink:0 }}>
                        <button onClick={() => openEdit(s)} title="Editar" style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:6, borderRadius:7, display:'flex' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.panelAlt; (e.currentTarget as HTMLElement).style.color = C.text; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = C.textDim; }}><Edit2 size={13}/></button>
                        <button onClick={() => duplicar(s)} title="Duplicar" style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:6, borderRadius:7, display:'flex' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.panelAlt; (e.currentTarget as HTMLElement).style.color = C.text; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = C.textDim; }}><Copy size={13}/></button>
                        <button onClick={() => toggleActivo(s)} title="Desactivar" style={{ background:'none', border:'none', cursor:'pointer', color: C.green, padding:6, borderRadius:7, display:'flex' }}><ToggleRight size={17}/></button>
                        {confirmDelete === s.id ? (
                          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                            <button onClick={() => eliminar(s.id)} style={{ padding:'4px 8px', borderRadius:6, border:'none', background: C.red, color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700 }}>Eliminar</button>
                            <button onClick={() => setConfirmDelete(null)} style={{ padding:'4px 8px', borderRadius:6, border:'none', background: C.panelAlt, color: C.textMid, cursor:'pointer', fontSize:11 }}>No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(s.id)} title="Eliminar" style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:6, borderRadius:7, display:'flex' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.red; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.textDim; }}><Trash2 size={13}/></button>
                        )}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>

            {inactivos.length > 0 && (
              <div style={{ marginTop:20 }}>
                <p style={{ fontSize:10, color: C.textDim, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:8, paddingLeft:4 }}>Inactivos</p>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {inactivos.map(s => (
                    <div key={s.id} style={{ background: C.panel, border:`1px solid ${C.border}`, borderRadius:14, padding: isMobile ? '10px 12px' : '10px 14px', display:'flex', alignItems:'center', gap:10, opacity:0.55 }}>
                      <div style={{ width:10, height:10, borderRadius:3, background: s.color||C.textDim, flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, color: C.textMid, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.nombre}</p>
                        <span style={{ fontSize:11, color: C.textDim }}>{fmtDuracion(s.duracion_minutos)}</span>
                      </div>
                      {canEdit && (
                        isMobile ? (
                          <button onClick={() => setActionSheet(s)}
                            style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:'6px 4px', borderRadius:8, display:'flex', alignItems:'center' }}>
                            <MoreVertical size={18}/>
                          </button>
                        ) : (
                          <>
                            <button onClick={() => toggleActivo(s)} title="Activar" style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:6, display:'flex' }}><ToggleLeft size={17}/></button>
                            <button onClick={() => setConfirmDelete(s.id)} title="Eliminar" style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:6, display:'flex' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.red; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.textDim; }}>
                              {confirmDelete === s.id ? <span onClick={() => eliminar(s.id)} style={{ fontSize:11, color: C.red, fontWeight:700 }}>Eliminar</span> : <Trash2 size={13}/>}
                            </button>
                          </>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', background:'#1E293B', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:'12px 20px', zIndex:70, display:'flex', alignItems:'center', gap:10, boxShadow:'0 4px 20px rgba(0,0,0,0.4)', whiteSpace:'nowrap' }}>
          <CheckCircle2 size={16} style={{ color:'#22C55E', flexShrink:0 }}/>
          <p style={{ fontSize:13, color:'#F1F5F9', fontWeight:500 }}>{toast}</p>
        </div>
      )}

      {/* Action Sheet móvil */}
      {actionSheet && (
        <ActionSheet
          servicio={actionSheet}
          onEdit={() => openEdit(actionSheet)}
          onDuplicate={() => duplicar(actionSheet)}
          onToggle={() => toggleActivo(actionSheet)}
          onDelete={() => { setConfirmDelete(actionSheet.id); eliminar(actionSheet.id); }}
          onCerrar={() => setActionSheet(null)}
        />
      )}

      {importOpen && canEdit && <ModalImportar empresaId={empresaId} serviciosExistentes={servicios} onDone={msg => { setImportOpen(false); showToast(msg); load(); }} onCerrar={() => setImportOpen(false)}/>}
      {modalOpen && canEdit && <ModalServicio editando={!!editTarget} form={form} setForm={setForm} guardando={guardando} error={error} onGuardar={guardar} onCerrar={() => setModalOpen(false)}/>}
    </div>
  );
}
