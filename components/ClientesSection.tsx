'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, X, Phone, Mail, ChevronRight, ArrowLeft, Trash2, Edit2, Check, Calendar, MessageCircle, DollarSign, AlertTriangle, ChevronDown } from 'lucide-react';
import { calcularFiabilidad, inferEstadoDetallado, type FiabilidadResult } from '@/lib/fiabilidad';

const C = {
  bg: '#0B0F1A', panel: '#111827', panelAlt: '#1A2332',
  accent: '#22C55E', accentDim: 'rgba(34,197,94,0.15)',
  red: '#EF4444', redDim: 'rgba(239,68,68,0.12)',
  amber: '#F59E0B', blue: '#3B82F6', purple: '#A855F7', orange: '#FB923C',
  text: '#F1F5F9', textMid: '#94A3B8', textDim: '#4B5563',
  divider: 'rgba(148,163,184,0.06)',
};

const ESTADOS_DETALLADOS = [
  { key: 'completada', label: 'Completada', icon: '✅', color: '#10B981' },
  { key: 'no_show_real', label: 'No-show real', icon: '🔴', color: '#EF4444' },
  { key: 'no_show_justificado', label: 'No-show justificado', icon: '🟠', color: '#FB923C' },
  { key: 'cancelacion_tardia', label: 'Cancelación tardía', icon: '🟡', color: '#F59E0B' },
  { key: 'cancelacion_anticipada', label: 'Cancelación anticipada', icon: '⚪', color: '#6B7280' },
  { key: 'reprogramada', label: 'Reprogramada', icon: '🔵', color: '#3B82F6' },
];

function getEstadoVisual(cita: any) {
  const ed = inferEstadoDetallado(cita);
  return ESTADOS_DETALLADOS.find(e => e.key === ed) || ESTADOS_DETALLADOS[0];
}

interface Cliente { id: string; nombre: string; telefono?: string; email?: string; notas?: string; created_at?: string; }
interface FormCliente { nombre: string; telefono: string; email: string; notas: string; }

/* ═══ DONUT — solo completadas vs incidencias ═══ */
function DonutSimple({ completadas, incidencias, total }: { completadas: number; incidencias: number; total: number }) {
  if (total === 0) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: C.textDim, fontSize: 11 }}>Sin datos</div>;
  const size = 140, stroke = 16, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const pComp = completadas / total;
  const dComp = pComp * circ;
  const dInc = incidencias > 0 ? (incidencias / total) * circ : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.accent} strokeWidth={stroke}
            strokeDasharray={`${dComp} ${circ - dComp}`} strokeDashoffset={0} strokeLinecap="butt" />
          {dInc > 0 && (
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.red} strokeWidth={stroke}
              strokeDasharray={`${dInc} ${circ - dInc}`} strokeDashoffset={-(dComp + 2)} strokeLinecap="butt" />
          )}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: C.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          <span style={{ fontSize: 8, color: C.textDim, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>citas</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: C.accent }} />
          <span style={{ fontSize: 11, color: C.textMid }}>Completadas <b style={{ color: C.accent }}>{completadas}</b></span>
        </div>
        {incidencias > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: C.red }} />
            <span style={{ fontSize: 11, color: C.textMid }}>Incidencias <b style={{ color: C.red }}>{incidencias}</b></span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ RISK BADGE ═══ */
function RiskBadge({ fiab }: { fiab: FiabilidadResult }) {
  const icons: Record<string, string> = { fiable: '🟢', atencion: '🟡', riesgo: '🔴', nuevo: '⚫' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 8,
      background: fiab.riskColor + '18',
      border: `1px solid ${fiab.riskColor}33`,
      fontSize: 12, fontWeight: 700, color: fiab.riskColor,
    }}>
      {icons[fiab.riskLabel] || '⚫'} {fiab.displayLabel}
    </span>
  );
}

/* ═══ METRIC CARD ═══ */
function MetricCard({ value, label, sub, color }: { value: string | number; label: string; sub?: string; color: string }) {
  return (
    <div style={{ background: C.panelAlt, borderRadius: 10, padding: '14px 16px', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {sub && <span style={{ fontSize: 10, color: C.textDim }}>{sub}</span>}
      </div>
      <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 4, display: 'block' }}>{label}</span>
    </div>
  );
}

/* ═══ HISTORY ROW (editable) ═══ */
function HistoryRow({ cita, onUpdate }: { cita: any; onUpdate: (id: string, ed: string) => void; key?: string }) {
  const [dropOpen, setDropOpen] = useState(false);
  const vis = getEstadoVisual(cita);
  const f = cita.hora_inicio ? new Date(cita.hora_inicio) : null;
  const dateStr = f ? f.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const timeStr = cita.hora_inicio?.substring(11, 16) || '';
  const svc = cita.servicios?.nombre || cita.servicio_nombre_libre || '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.divider}`, position: 'relative' }}>
      {/* Date + time */}
      <div style={{ width: 90, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, display: 'block' }}>{dateStr}</span>
        <span style={{ fontSize: 10, color: C.textDim }}>{timeStr}</span>
      </div>
      {/* Estado badge — clickable */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setDropOpen(!dropOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 6, border: `1px solid ${vis.color}33`,
            background: vis.color + '15', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: vis.color,
          }}>
          <span>{vis.icon}</span> {vis.label} <ChevronDown style={{ width: 10, height: 10 }} />
        </button>
        {dropOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setDropOpen(false)} />
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 61,
              background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 200, overflow: 'hidden',
            }}>
              {ESTADOS_DETALLADOS.map(ed => (
                <button key={ed.key}
                  onClick={() => { onUpdate(cita.id, ed.key); setDropOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 12px', border: 'none', cursor: 'pointer', fontSize: 12,
                    background: inferEstadoDetallado(cita) === ed.key ? ed.color + '15' : 'transparent',
                    color: inferEstadoDetallado(cita) === ed.key ? ed.color : C.text,
                    fontWeight: inferEstadoDetallado(cita) === ed.key ? 700 : 400,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = ed.color + '10')}
                  onMouseLeave={e => (e.currentTarget.style.background = inferEstadoDetallado(cita) === ed.key ? ed.color + '15' : 'transparent')}
                >
                  <span>{ed.icon}</span> {ed.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {/* Service */}
      <span style={{ fontSize: 12, color: C.textMid, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc}</span>
      {/* Importe */}
      {cita.importe != null && cita.importe > 0 && (
        <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{cita.importe}€</span>
      )}
    </div>
  );
}

/* ═══ MODAL CLIENTE ═══ */
function ModalCliente({ editando, form, setForm, guardando, error, onGuardar, onCerrar }:
  { editando: boolean; form: FormCliente; setForm: React.Dispatch<React.SetStateAction<FormCliente>>; guardando: boolean; error: string; onGuardar: () => void; onCerrar: () => void; }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:50,display:'flex',alignItems:'flex-end',justifyContent:'center' }} onClick={onCerrar}>
      <div style={{ background:C.panel,borderRadius:'20px 20px 0 0',padding:24,width:'100%',maxWidth:500,paddingBottom:32 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
          <h3 style={{ fontSize:18,fontWeight:700 }}>{editando?'Editar cliente':'Nuevo cliente'}</h3>
          <button onClick={onCerrar} style={{ background:'none',border:'none',cursor:'pointer',color:C.textMid }}><X className="w-5 h-5"/></button>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {[{l:'NOMBRE *',t:'text',k:'nombre',p:'Nombre del cliente'},{l:'TELÉFONO',t:'tel',k:'telefono',p:'600 000 000'},{l:'EMAIL',t:'email',k:'email',p:'email@ejemplo.com'}].map(f=>(
            <div key={f.k}><label style={{fontSize:12,color:C.textMid,fontWeight:600,display:'block',marginBottom:6}}>{f.l}</label>
            <input type={f.t} placeholder={f.p} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
              style={{width:'100%',padding:'12px 14px',background:C.panelAlt,border:`1px solid ${C.divider}`,borderRadius:12,color:C.text,fontSize:15,outline:'none',boxSizing:'border-box'}}/></div>))}
          <div><label style={{fontSize:12,color:C.textMid,fontWeight:600,display:'block',marginBottom:6}}>NOTAS</label>
          <textarea placeholder="Alergias, preferencias..." value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
            rows={3} style={{width:'100%',padding:'12px 14px',background:C.panelAlt,border:`1px solid ${C.divider}`,borderRadius:12,color:C.text,fontSize:15,outline:'none',resize:'none',boxSizing:'border-box'}}/></div>
          {error&&<p style={{color:C.red,fontSize:13}}>{error}</p>}
          <button onClick={onGuardar} disabled={guardando}
            style={{width:'100%',padding:'14px',borderRadius:14,border:'none',background:C.accent,color:'#fff',cursor:guardando?'not-allowed':'pointer',fontSize:15,fontWeight:700,opacity:guardando?0.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            {guardando?'Guardando...':(<><Check className="w-4 h-4"/>{editando?'Guardar cambios':'Crear cliente'}</>)}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ COMPONENTE PRINCIPAL ═══ */
export default function ClientesSection({ empresaId }: { empresaId: string }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [vistaDetalle, setVistaDetalle] = useState<Cliente | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historialCitas, setHistorialCitas] = useState<any[]>([]);
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [mostrarImporte, setMostrarImporte] = useState(false);
  const [form, setForm] = useState<FormCliente>({ nombre:'',telefono:'',email:'',notas:'' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const fiabilidad = useMemo(() => calcularFiabilidad(historialCitas), [historialCitas]);

  const analytics = useMemo(() => {
    if (historialCitas.length === 0) return null;
    const now = new Date();
    const completadas = historialCitas.filter(c => inferEstadoDetallado(c) === 'completada');
    const past = completadas.filter(c => new Date(c.hora_inicio) <= now);
    const lastDate = past.length > 0 ? new Date(past[0].hora_inicio) : null;
    const daysSince = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : null;

    let freq: number | null = null;
    if (past.length >= 2) {
      const ts = past.map(c => new Date(c.hora_inicio).getTime()).sort((a,b) => b-a);
      let td = 0;
      for (let i = 0; i < ts.length-1; i++) td += ts[i]-ts[i+1];
      freq = Math.round(td / ((ts.length-1) * 86400000));
    }

    const incidencias = fiabilidad.noShowsReales + fiabilidad.cancelacionesTardias;

    const svc: Record<string,number> = {};
    historialCitas.forEach(c => { const nm = c.servicios?.nombre || c.servicio_nombre_libre; if (nm) svc[nm] = (svc[nm]||0)+1; });
    const top = Object.entries(svc).sort((a,b) => b[1]-a[1])[0];

    const citasConImporte = historialCitas.filter(c => c.importe != null && c.importe > 0);
    const ingresoTotal = citasConImporte.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0);
    const mediaPorVisita = citasConImporte.length > 0 ? ingresoTotal / citasConImporte.length : 0;

    // Frequency label
    let freqLabel = '—';
    if (freq !== null) {
      if (freq <= 7) freqLabel = '~semanal';
      else if (freq <= 14) freqLabel = `~${freq}d`;
      else if (freq <= 35) freqLabel = `~${Math.round(freq/7)} sem`;
      else freqLabel = `~${Math.round(freq/30)} mes`;
    }

    // Last visit label
    let lastLabel = '—';
    if (daysSince !== null) {
      if (daysSince === 0) lastLabel = 'Hoy';
      else if (daysSince < 7) lastLabel = `${daysSince}d`;
      else if (daysSince < 30) lastLabel = `${Math.floor(daysSince/7)} sem`;
      else lastLabel = `${Math.floor(daysSince/30)} mes`;
    }

    // Future citas
    const fut = historialCitas.filter(c => new Date(c.hora_inicio) > now && inferEstadoDetallado(c) === 'completada');

    return {
      completadas: fiabilidad.completadas, incidencias, total: historialCitas.length,
      daysSince, freq, freqLabel, lastLabel,
      top: top ? { name: top[0], count: top[1] } : null,
      ingresoTotal, mediaPorVisita, citasConImporte: citasConImporte.length,
      hasFuture: fut.length > 0,
      lastVisitColor: daysSince !== null && daysSince > 60 ? C.red : daysSince !== null && daysSince > 30 ? C.amber : C.text,
    };
  }, [historialCitas, fiabilidad]);

  useEffect(() => { if (empresaId) { load(); loadConfig(); } }, [empresaId]);
  useEffect(() => { if (vistaDetalle) { loadCitas(vistaDetalle.id); } }, [vistaDetalle]);

  async function load() { setLoading(true); const { data } = await supabase.from('clientes').select('*').eq('empresa_id',empresaId).order('nombre'); setClientes(data||[]); setLoading(false); }
  async function loadConfig() { const { data } = await supabase.from('empresas').select('mostrar_importe').eq('id',empresaId).single(); setMostrarImporte(data?.mostrar_importe || false); }
  async function loadCitas(id: string) { setLoadingCitas(true); const { data } = await supabase.from('citas').select('*, servicios(nombre)').eq('cliente_id',id).order('hora_inicio',{ascending:false}).limit(200); setHistorialCitas(data||[]); setLoadingCitas(false); }

  // ═══ UPDATE ESTADO DETALLADO ═══
  async function updateEstadoDetallado(citaId: string, nuevoEstado: string) {
    await supabase.from('citas').update({ estado_detallado: nuevoEstado }).eq('id', citaId);
    // Update local state immediately
    setHistorialCitas(prev => prev.map(c =>
      c.id === citaId ? { ...c, estado_detallado: nuevoEstado } : c
    ));
  }

  const filtered = clientes.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (c.telefono||'').includes(busqueda) || (c.email||'').toLowerCase().includes(busqueda.toLowerCase()));

  function openNew() { setForm({nombre:'',telefono:'',email:'',notas:''}); setError(''); setEditando(false); setModalAbierto(true); }
  function openEdit(cl: Cliente) { setForm({nombre:cl.nombre||'',telefono:cl.telefono||'',email:cl.email||'',notas:cl.notas||''}); setError(''); setEditando(true); setModalAbierto(true); }

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setGuardando(true); setError('');
    if (editando && vistaDetalle) {
      const { error } = await supabase.from('clientes').update({nombre:form.nombre.trim(),telefono:form.telefono.trim()||null,email:form.email.trim()||null,notas:form.notas.trim()||null}).eq('id',vistaDetalle.id);
      if (error) { setError('Error'); setGuardando(false); return; }
      setVistaDetalle(p => p ? {...p,...form} : p);
    } else {
      const { error } = await supabase.from('clientes').insert({empresa_id:empresaId,nombre:form.nombre.trim(),telefono:form.telefono.trim()||null,email:form.email.trim()||null,notas:form.notas.trim()||null});
      if (error) { setError('Error'); setGuardando(false); return; }
    }
    await load(); setModalAbierto(false); setGuardando(false);
  }

  async function del() { if (!vistaDetalle) return; await supabase.from('clientes').delete().eq('id',vistaDetalle.id); await load(); setVistaDetalle(null); setConfirmDelete(false); }
  function fmtDate(s?: string) { if (!s) return '—'; return new Date(s).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'}); }

  /* ═══ VISTA DETALLE ═══ */
  if (vistaDetalle) {
    const a = analytics;
    const f = fiabilidad;
    const incidencias = f.noShowsReales + f.cancelacionesTardias;

    return (
      <div style={{ height: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* TOPBAR */}
        <div style={{ background: C.panel, borderBottom: `1px solid ${C.divider}`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={() => { setVistaDetalle(null); setConfirmDelete(false); }}
            style={{ color: C.textMid, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600, letterSpacing: 0.5 }}>CLIENTE</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => openEdit(vistaDetalle)}
            style={{ color: C.textMid, background: 'none', border: `1px solid ${C.divider}`, cursor: 'pointer', padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Edit2 className="w-3 h-3" /> Editar
          </button>
        </div>

        {loadingCitas ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim }}>Cargando...</div>
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* SIDEBAR IZQUIERDO */}
            <div style={{ width: 260, flexShrink: 0, background: C.panel, borderRight: `1px solid ${C.divider}`, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

              {/* Identidad + Risk Badge */}
              <div style={{ padding: '20px 18px 14px', borderBottom: `1px solid ${C.divider}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: C.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: C.accent }}>
                    {vistaDetalle.nombre[0].toUpperCase()}
                  </div>
                  <RiskBadge fiab={f} />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2, marginBottom: 3 }}>{vistaDetalle.nombre}</h2>
                <p style={{ fontSize: 11, color: C.textDim }}>Desde {fmtDate(vistaDetalle.created_at)}</p>
                {a?.top && <p style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>Favorito: <span style={{ color: C.purple, fontWeight: 700 }}>{a.top.name}</span> ({a.top.count}x)</p>}
              </div>

              {/* Contacto */}
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.divider}` }}>
                <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>CONTACTO</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {vistaDetalle.telefono
                    ? <a href={`tel:${vistaDetalle.telefono}`} style={{ display:'flex',alignItems:'center',gap:7,color:C.text,textDecoration:'none',fontSize:12 }}><Phone className="w-3.5 h-3.5" style={{color:C.accent,flexShrink:0}}/> {vistaDetalle.telefono}</a>
                    : <span style={{fontSize:11,color:C.textDim}}>Sin teléfono</span>}
                  {vistaDetalle.email
                    ? <a href={`mailto:${vistaDetalle.email}`} style={{ display:'flex',alignItems:'center',gap:7,color:C.text,textDecoration:'none',fontSize:12,wordBreak:'break-all' as const }}><Mail className="w-3.5 h-3.5" style={{color:C.blue,flexShrink:0}}/> {vistaDetalle.email}</a>
                    : <span style={{fontSize:11,color:C.textDim}}>Sin email</span>}
                </div>
                {vistaDetalle.notas && <p style={{ fontSize:11,color:C.textMid,marginTop:8,lineHeight:1.5,borderTop:`1px solid ${C.divider}`,paddingTop:8 }}>{vistaDetalle.notas}</p>}
              </div>

              {/* Acciones */}
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.divider}` }}>
                <button style={{ width:'100%',padding:'9px 12px',borderRadius:7,border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:5,marginBottom:7 }}>
                  <Calendar className="w-3.5 h-3.5" /> Crear cita
                </button>
                <div style={{ display: 'flex', gap: 6 }}>
                  {vistaDetalle.telefono && (
                    <a href={`tel:${vistaDetalle.telefono}`} style={{ flex:1,padding:'7px',borderRadius:7,border:`1px solid ${C.divider}`,background:'transparent',color:C.textMid,fontSize:11,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:4,textDecoration:'none' }}>
                      <Phone className="w-3 h-3" /> Llamar</a>
                  )}
                  {vistaDetalle.telefono && (
                    <a href={`https://wa.me/${vistaDetalle.telefono.replace(/\s/g,'')}`} target="_blank" rel="noopener noreferrer"
                      style={{ flex:1,padding:'7px',borderRadius:7,border:`1px solid ${C.divider}`,background:'transparent',color:C.textMid,fontSize:11,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:4,textDecoration:'none' }}>
                      <MessageCircle className="w-3 h-3" /> WhatsApp</a>
                  )}
                </div>
              </div>

              {/* Eliminar */}
              <div style={{ marginTop: 'auto', padding: '12px 18px' }}>
                {!confirmDelete
                  ? <button onClick={() => setConfirmDelete(true)} style={{ width:'100%',padding:'7px',borderRadius:5,border:'none',background:'transparent',color:C.textDim,cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',gap:4 }}><Trash2 className="w-3 h-3"/> Eliminar</button>
                  : <div style={{ background:C.redDim,borderRadius:8,padding:10 }}>
                      <p style={{fontSize:12,fontWeight:600,marginBottom:7}}>¿Eliminar a {vistaDetalle.nombre}?</p>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:'6px',borderRadius:6,border:'none',background:C.panelAlt,color:C.text,cursor:'pointer',fontSize:11}}>No</button>
                        <button onClick={del} style={{flex:1,padding:'6px',borderRadius:6,border:'none',background:C.red,color:'#fff',cursor:'pointer',fontSize:11,fontWeight:600}}>Sí</button>
                      </div>
                    </div>}
              </div>
            </div>

            {/* PANEL PRINCIPAL */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {a ? (<>

                {/* BLOQUE B — 4 Metric Cards */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <MetricCard value={a.completadas} label="Completadas" color={C.accent} />
                  <MetricCard value={incidencias} label="Incidencias" color={incidencias > 0 ? C.red : C.textDim} sub={incidencias > 0 ? `${f.noShowsReales} ns · ${f.cancelacionesTardias} ct` : ''} />
                  <MetricCard value={a.freqLabel} label="Frecuencia" color={C.blue} />
                  <MetricCard value={a.lastLabel} label="Última visita" color={a.lastVisitColor} />
                </div>

                {/* BLOQUE C — Alerta (si hay riesgo) */}
                {f.alertMessage && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10,
                    background: f.alertLevel === 'danger' ? C.redDim : f.alertLevel === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.06)',
                    border: `1px solid ${f.alertLevel === 'danger' ? 'rgba(239,68,68,0.25)' : f.alertLevel === 'warn' ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.15)'}`,
                  }}>
                    <AlertTriangle style={{ width: 16, height: 16, color: f.riskColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: f.riskColor, lineHeight: 1.4 }}>
                      {f.alertMessage}
                    </span>
                  </div>
                )}

                {/* BLOQUE D — Donut + Historial editable */}
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, flex: 1, minHeight: 0 }}>

                  {/* Donut */}
                  <div style={{ background: C.panel, borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <DonutSimple completadas={f.completadas} incidencias={incidencias} total={f.totalCitas} />
                    {/* Desglose debajo del donut */}
                    {(f.noShowsReales > 0 || f.noShowsJustificados > 0 || f.cancelacionesTardias > 0 || f.cancelacionesAnticipadas > 0 || f.reprogramadas > 0) && (
                      <div style={{ marginTop: 14, width: '100%', borderTop: `1px solid ${C.divider}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {ESTADOS_DETALLADOS.slice(1).map(ed => {
                          const count = ed.key === 'no_show_real' ? f.noShowsReales
                            : ed.key === 'no_show_justificado' ? f.noShowsJustificados
                            : ed.key === 'cancelacion_tardia' ? f.cancelacionesTardias
                            : ed.key === 'cancelacion_anticipada' ? f.cancelacionesAnticipadas
                            : ed.key === 'reprogramada' ? f.reprogramadas : 0;
                          if (count === 0) return null;
                          return (
                            <div key={ed.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 10 }}>{ed.icon}</span>
                              <span style={{ fontSize: 10, color: C.textMid, flex: 1 }}>{ed.label}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: ed.color }}>{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Historial editable */}
                  <div style={{ background: C.panel, borderRadius: 12, padding: '14px 16px', overflow: 'auto', minHeight: 200 }}>
                    <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
                      Historial de citas <span style={{ fontWeight: 400 }}>({historialCitas.length})</span>
                    </p>
                    {historialCitas.length > 0 ? (
                      historialCitas.slice(0, 30).map(c => (
                        <HistoryRow key={c.id} cita={c} onUpdate={updateEstadoDetallado} />
                      ))
                    ) : (
                      <p style={{ fontSize: 11, color: C.textDim }}>Sin citas registradas</p>
                    )}
                    {historialCitas.length > 30 && (
                      <p style={{ fontSize: 10, color: C.textDim, marginTop: 8, textAlign: 'center' }}>+{historialCitas.length - 30} citas más</p>
                    )}
                  </div>
                </div>

                {/* BLOQUE E — Rentabilidad */}
                {mostrarImporte && a.citasConImporte > 0 && (
                  <div style={{
                    background: C.panel, borderRadius: 12, padding: '14px 20px',
                    display: 'flex', alignItems: 'center', gap: 28,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign className="w-4 h-4" style={{ color: C.accent }} />
                      </div>
                      <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Rentabilidad</p>
                    </div>
                    <div style={{ display: 'flex', gap: 36, flex: 1 }}>
                      <div>
                        <span style={{ fontSize: 22, fontWeight: 800, color: C.accent, fontVariantNumeric: 'tabular-nums' }}>{a.ingresoTotal.toFixed(0)}€</span>
                        <p style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase' }}>Total generado</p>
                      </div>
                      <div>
                        <span style={{ fontSize: 22, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{a.mediaPorVisita.toFixed(0)}€</span>
                        <p style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase' }}>Media por visita</p>
                      </div>
                    </div>
                  </div>
                )}

              </>) : (
                <div style={{ display:'flex',alignItems:'center',justifyContent:'center',flex:1 }}>
                  <div style={{textAlign:'center'}}>
                    <p style={{fontSize:15,color:C.textMid}}>Sin datos de actividad</p>
                    <p style={{fontSize:12,color:C.textDim}}>Los análisis aparecerán con la primera cita</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {modalAbierto && <ModalCliente editando={editando} form={form} setForm={setForm} guardando={guardando} error={error} onGuardar={save} onCerrar={()=>setModalAbierto(false)} />}
      </div>
    );
  }

  /* ═══ LISTA DE CLIENTES ═══ */
  return (
    <div style={{ minHeight:'100vh',background:C.bg,color:C.text }}>
      <div style={{ background:C.panel,borderBottom:`1px solid ${C.divider}`,padding:'16px 20px' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
          <h2 style={{ fontSize:20,fontWeight:700 }}>Clientes</h2>
          <button onClick={openNew} style={{ background:C.accent,color:'#fff',border:'none',borderRadius:12,padding:'10px 16px',cursor:'pointer',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:6 }}><Plus className="w-4 h-4"/> Nuevo</button>
        </div>
        <div style={{ position:'relative' }}>
          <Search className="w-4 h-4" style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:C.textMid }} />
          <input type="text" placeholder="Buscar por nombre, teléfono o email..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            style={{ width:'100%',padding:'10px 12px 10px 36px',background:C.panelAlt,border:`1px solid ${C.divider}`,borderRadius:12,color:C.text,fontSize:14,outline:'none',boxSizing:'border-box' }} />
          {busqueda && <button onClick={()=>setBusqueda('')} style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:C.textMid }}><X className="w-4 h-4"/></button>}
        </div>
      </div>
      <div style={{ padding:'12px 16px 80px' }}>
        {loading ? <div style={{textAlign:'center',padding:40,color:C.textMid}}>Cargando clientes...</div>
        : filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:60}}>
            <div style={{fontSize:40,marginBottom:12}}>👥</div>
            <p style={{color:C.textMid,fontSize:15}}>{busqueda?'No hay resultados':'Aún no tienes clientes'}</p>
            {!busqueda && <button onClick={openNew} style={{marginTop:16,background:C.accent,color:'#fff',border:'none',borderRadius:12,padding:'12px 24px',cursor:'pointer',fontSize:14,fontWeight:600}}>Añadir primer cliente</button>}
          </div>
        ) : (
          <>
            <p style={{fontSize:12,color:C.textMid,marginBottom:10}}>{filtered.length} cliente{filtered.length!==1?'s':''}</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {filtered.map(cl => (
                <button key={cl.id} onClick={()=>setVistaDetalle(cl)}
                  style={{background:C.panel,border:`1px solid ${C.divider}`,borderRadius:14,padding:'14px 16px',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:14,width:'100%'}}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.panelAlt)} onMouseLeave={e=>(e.currentTarget.style.background=C.panel)}>
                  <div style={{width:44,height:44,borderRadius:12,background:C.accentDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:C.accent,flexShrink:0}}>{cl.nombre[0].toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:15,fontWeight:600,color:C.text}}>{cl.nombre}</p>
                    <p style={{fontSize:12,color:C.textMid,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cl.telefono||cl.email||'Sin contacto'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{color:C.textMid,flexShrink:0}} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {modalAbierto && <ModalCliente editando={editando} form={form} setForm={setForm} guardando={guardando} error={error} onGuardar={save} onCerrar={()=>setModalAbierto(false)} />}
    </div>
  );
}
