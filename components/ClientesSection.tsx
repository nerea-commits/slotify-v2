'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, X, Phone, Mail, ChevronRight, ArrowLeft, Trash2, Edit2, Check, Calendar, MessageCircle, DollarSign } from 'lucide-react';
import { calcularFiabilidad, type FiabilidadResult } from '@/lib/fiabilidad';

const C = {
  bg: '#0B0F1A', panel: '#111827', panelAlt: '#1A2332',
  accent: '#22C55E', accentDim: 'rgba(34,197,94,0.15)',
  red: '#EF4444', redDim: 'rgba(239,68,68,0.12)',
  amber: '#F59E0B', blue: '#3B82F6', purple: '#A855F7',
  text: '#F1F5F9', textMid: '#94A3B8', textDim: '#4B5563',
  divider: 'rgba(148,163,184,0.06)', grid: 'rgba(148,163,184,0.05)',
};

interface Cliente { id: string; nombre: string; telefono?: string; email?: string; notas?: string; created_at?: string; }
interface FormCliente { nombre: string; telefono: string; email: string; notas: string; }

/* ═══ FIABILIDAD RING ═══ */
function FiabilidadRing({ fiab, size = 150 }: { fiab: FiabilidadResult; size?: number }) {
  const s = 10, r = (size - s) / 2, circ = 2 * Math.PI * r;
  const off = circ - (fiab.score / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth={s} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={fiab.color} strokeWidth={s}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: fiab.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fiab.score}%</span>
        <span style={{ fontSize: 9, color: C.textMid, fontWeight: 700, letterSpacing: 1.5, marginTop: 3, textTransform: 'uppercase' }}>{fiab.label}</span>
      </div>
    </div>
  );
}

/* ═══ DONUT CHART DE ESTADOS ═══ */
function DonutEstados({ completadas, canceladas, noShows }: { completadas: number; canceladas: number; noShows: number }) {
  const total = completadas + canceladas + noShows;
  if (total === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: C.textDim, fontSize: 11 }}>
      Sin datos
    </div>
  );

  const size = 120, stroke = 14, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const segments = [
    { value: completadas, color: C.accent, label: 'Completadas' },
    { value: canceladas, color: C.amber, label: 'Canceladas' },
    { value: noShows, color: C.red, label: 'No-show' },
  ].filter(s => s.value > 0);

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const dash = pct * circ;
    const gap = circ - dash;
    const arc = { ...seg, pct, dash, gap, offset };
    offset += dash + 2; // 2px gap between segments
    return arc;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* Donut SVG */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth={stroke} />
          {arcs.map((arc, i) => (
            <circle key={i}
              cx={size/2} cy={size/2} r={r} fill="none"
              stroke={arc.color} strokeWidth={stroke}
              strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: 8, color: C.textDim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>total</span>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: C.textMid, flex: 1 }}>{seg.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: seg.color, fontVariantNumeric: 'tabular-nums' }}>{seg.value}</span>
            <span style={{ fontSize: 10, color: C.textDim, minWidth: 32, textAlign: 'right' }}>
              {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ BAR CHART actividad ═══ */
function ActivityChart({ citas }: { citas: any[] }) {
  const data = useMemo(() => {
    const now = new Date();
    const r: { label: string; count: number; cur: boolean }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const count = citas.filter(c => {
        if (!c.hora_inicio) return false;
        const cd = new Date(c.hora_inicio);
        return cd.getFullYear() === y && cd.getMonth() === m && c.estado !== 'cancelada' && c.estado !== 'Cancelada';
      }).length;
      r.push({ label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.','').toUpperCase(), count, cur: i === 0 });
    }
    return r;
  }, [citas]);

  const max = Math.max(...data.map(d => d.count), 1);
  const W = 280, H = 100, pL = 20, pR = 6, pT = 8, pB = 20;
  const cW = W - pL - pR, cH = H - pT - pB;
  const bW = cW / data.length, bI = bW * 0.52;
  const ticks: number[] = [];
  const step = max <= 3 ? 1 : max <= 8 ? 2 : 5;
  for (let t = 0; t <= max; t += step) ticks.push(t);
  if (ticks[ticks.length-1] < max) ticks.push(max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map(t => {
        const y = pT + cH - (t / max) * cH;
        return (<g key={t}>
          <line x1={pL} x2={W-pR} y1={y} y2={y} stroke={C.grid} strokeWidth={1} />
          <text x={pL-4} y={y+3} textAnchor="end" fill={C.textDim} fontSize={8} fontFamily="system-ui">{t}</text>
        </g>);
      })}
      {data.map((d, i) => {
        const x = pL + i * bW + (bW - bI) / 2;
        const bH = d.count === 0 ? 2 : (d.count / max) * cH;
        const y = pT + cH - bH;
        return (<g key={i}>
          <rect x={x} y={y} width={bI} height={bH} rx={2.5} fill={d.cur ? C.accent : 'rgba(34,197,94,0.3)'} />
          {d.count > 0 && <text x={x+bI/2} y={y-4} textAnchor="middle" fill={d.cur ? C.accent : C.textMid} fontSize={9} fontWeight={700} fontFamily="system-ui">{d.count}</text>}
          <text x={x+bI/2} y={H-5} textAnchor="middle" fill={d.cur ? C.text : C.textDim} fontSize={8} fontWeight={d.cur ? 700 : 400} fontFamily="system-ui">{d.label}</text>
        </g>);
      })}
    </svg>
  );
}

/* ═══ TIMELINE DOT ═══ */
function TDot({ cita, isLast }: { cita: any; isLast: boolean }) {
  const estado = (cita.estado || '').toLowerCase();
  const col = estado === 'cancelada' ? C.textDim : (estado === 'no-show' || estado === 'no_show') ? C.red : C.accent;
  const f = new Date(cita.hora_inicio), now = new Date();
  const diff = Math.floor((now.getTime() - f.getTime()) / 86400000);
  const ds = diff === 0 ? 'Hoy' : diff === 1 ? 'Ayer' : diff < 7 ? `${diff}d` : diff < 30 ? `${Math.floor(diff/7)}sem` : f.toLocaleDateString('es-ES',{day:'numeric',month:'short'});
  const sv = cita.servicios?.nombre || cita.servicio_nombre_libre || 'Servicio';
  const hr = cita.hora_inicio?.substring(11, 16);
  const imp = cita.importe;
  return (
    <div style={{ display: 'flex', gap: 8, minHeight: 30 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 8, flexShrink: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0, marginTop: 3 }} />
        {!isLast && <div style={{ flex: 1, width: 1, background: C.divider, marginTop: 2 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 4, display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{sv}</span>
        <span style={{ fontSize: 10, color: C.textDim }}>{hr} · {ds}</span>
        {imp != null && imp > 0 && <span style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>{imp}€</span>}
        {estado === 'cancelada' && <span style={{ fontSize: 9, color: C.textDim, fontWeight: 600 }}>CANCEL.</span>}
        {(estado === 'no-show' || estado === 'no_show') && <span style={{ fontSize: 9, color: C.red, fontWeight: 600 }}>NO-SHOW</span>}
      </div>
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

  // ═══ FILTRO ACTIVO para métricas clicables ═══
  type FiltroEstado = 'todos' | 'completadas' | 'canceladas' | 'no-show';
  const [filtroActivo, setFiltroActivo] = useState<FiltroEstado>('todos');

  const fiabilidad = useMemo(() => calcularFiabilidad(historialCitas), [historialCitas]);

  const analytics = useMemo(() => {
    if (historialCitas.length === 0) return null;
    const now = new Date();
    const estado = (c: any) => (c.estado || '').toLowerCase();
    const ok = historialCitas.filter(c => estado(c) !== 'cancelada' && estado(c) !== 'no-show' && estado(c) !== 'no_show');
    const canc = historialCitas.filter(c => estado(c) === 'cancelada');
    const ns = historialCitas.filter(c => estado(c) === 'no-show' || estado(c) === 'no_show');
    const past = ok.filter(c => new Date(c.hora_inicio) <= now);
    const lastDate = past.length > 0 ? new Date(past[0].hora_inicio) : null;
    const daysSince = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / 86400000) : null;

    let freq: number | null = null;
    if (past.length >= 2) {
      const ts = past.map(c => new Date(c.hora_inicio).getTime()).sort((a,b) => b-a);
      let td = 0; for (let i = 0; i < ts.length-1; i++) td += ts[i]-ts[i+1];
      freq = Math.round(td / ((ts.length-1) * 86400000));
    }

    const svc: Record<string,number> = {};
    historialCitas.forEach(c => { const nm = c.servicios?.nombre || c.servicio_nombre_libre; if (nm) svc[nm] = (svc[nm]||0)+1; });
    const top = Object.entries(svc).sort((a,b) => b[1]-a[1])[0];

    const citasConImporte = historialCitas.filter(c => c.importe != null && c.importe > 0);
    const ingresoTotal = citasConImporte.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0);
    const mediaPorVisita = citasConImporte.length > 0 ? ingresoTotal / citasConImporte.length : 0;

    const ins: string[] = [];
    if (freq !== null) {
      if (freq <= 7) ins.push('Viene ~cada semana');
      else if (freq <= 14) ins.push(`Cada ~${freq} días`);
      else if (freq <= 35) ins.push(`Cada ~${Math.round(freq/7)} semanas`);
      else ins.push(`Cada ~${Math.round(freq/30)} meses`);
    }
    if (daysSince !== null) {
      if (daysSince === 0) ins.push('Vino hoy');
      else if (daysSince < 7) ins.push(`Última: hace ${daysSince}d`);
      else if (daysSince < 30) ins.push(`Última: hace ${Math.floor(daysSince/7)} sem`);
      else ins.push(`Última: hace ${Math.floor(daysSince/30)} meses`);
    }
    if (freq !== null && daysSince !== null && daysSince > freq * 1.5) ins.push('⚠ Más tiempo del habitual sin venir');
    const fut = historialCitas.filter(c => new Date(c.hora_inicio) > now && estado(c) !== 'cancelada');
    if (fut.length > 0) { const d = Math.floor((new Date(fut[fut.length-1].hora_inicio).getTime()-now.getTime())/86400000); ins.push(d===0?'Cita hoy':d===1?'Cita mañana':`Próxima en ${d}d`); }
    else if (ok.length > 0) ins.push('Sin próxima cita');

    return {
      visits: ok.length, canc: canc.length, ns: ns.length, total: historialCitas.length,
      daysSince, freq,
      top: top ? { name: top[0], count: top[1] } : null, ins,
      ingresoTotal, mediaPorVisita, citasConImporte: citasConImporte.length,
    };
  }, [historialCitas]);

  // ═══ Citas filtradas según métrica activa ═══
  const citasFiltradas = useMemo(() => {
    if (filtroActivo === 'todos') return historialCitas;
    return historialCitas.filter(c => {
      const est = (c.estado || '').toLowerCase();
      if (filtroActivo === 'completadas') return est !== 'cancelada' && est !== 'no-show' && est !== 'no_show';
      if (filtroActivo === 'canceladas') return est === 'cancelada';
      if (filtroActivo === 'no-show') return est === 'no-show' || est === 'no_show';
      return true;
    });
  }, [historialCitas, filtroActivo]);

  useEffect(() => { if (empresaId) { load(); loadConfig(); } }, [empresaId]);
  useEffect(() => { if (vistaDetalle) { loadCitas(vistaDetalle.id); setFiltroActivo('todos'); } }, [vistaDetalle]);

  async function load() { setLoading(true); const { data } = await supabase.from('clientes').select('*').eq('empresa_id',empresaId).order('nombre'); setClientes(data||[]); setLoading(false); }
  async function loadConfig() { const { data } = await supabase.from('empresas').select('mostrar_importe').eq('id',empresaId).single(); setMostrarImporte(data?.mostrar_importe || false); }
  async function loadCitas(id: string) { setLoadingCitas(true); const { data } = await supabase.from('citas').select('*, servicios(nombre)').eq('cliente_id',id).order('hora_inicio',{ascending:false}).limit(200); setHistorialCitas(data||[]); setLoadingCitas(false); }

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

    // Botones de filtro clicable
    const filtros: { key: FiltroEstado; label: string; count: number; color: string }[] = [
      { key: 'todos',       label: 'Todas',        count: historialCitas.length, color: C.textMid },
      { key: 'completadas', label: 'Completadas',  count: a?.visits ?? 0,        color: C.accent },
      { key: 'canceladas',  label: 'Canceladas',   count: a?.canc ?? 0,          color: C.amber },
      { key: 'no-show',     label: 'No-show',      count: a?.ns ?? 0,            color: C.red },
    ];

    return (
      <div style={{ height: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* TOPBAR */}
        <div style={{ background: C.panel, borderBottom: `1px solid ${C.divider}`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={() => { setVistaDetalle(null); setConfirmDelete(false); }}
            style={{ color: C.textMid, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600, letterSpacing: 0.5 }}>ANÁLISIS DE CLIENTE</span>
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

              {/* Identidad */}
              <div style={{ padding: '20px 18px 14px', borderBottom: `1px solid ${C.divider}` }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: C.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: C.accent, marginBottom: 10 }}>
                  {vistaDetalle.nombre[0].toUpperCase()}
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
                    ? <a href={`mailto:${vistaDetalle.email}`} style={{ display:'flex',alignItems:'center',gap:7,color:C.text,textDecoration:'none',fontSize:12,wordBreak:'break-all' }}><Mail className="w-3.5 h-3.5" style={{color:C.blue,flexShrink:0}}/> {vistaDetalle.email}</a>
                    : <span style={{fontSize:11,color:C.textDim}}>Sin email</span>}
                </div>
                {vistaDetalle.notas && <p style={{ fontSize:11,color:C.textMid,marginTop:8,lineHeight:1.5,borderTop:`1px solid ${C.divider}`,paddingTop:8 }}>{vistaDetalle.notas}</p>}
              </div>

              {/* Insights */}
              {a && a.ins.length > 0 && (
                <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.divider}` }}>
                  <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 7 }}>INSIGHTS</p>
                  {a.ins.map((t,i) => (
                    <p key={i} style={{ fontSize: 11, lineHeight: 1.6, color: t.includes('⚠') ? C.amber : C.textMid, fontWeight: t.includes('⚠') ? 600 : 400 }}>{t}</p>
                  ))}
                </div>
              )}

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
            <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {a ? (<>

                {/* FILA 1: Fiabilidad + Donut + Métricas */}
                <div style={{ display: 'grid', gridTemplateColumns: '180px 200px 1fr', gap: 2 }}>

                  {/* Anillo fiabilidad */}
                  <div style={{ background: C.panel, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', gap: 8 }}>
                    <FiabilidadRing fiab={f} size={130} />
                    <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Fiabilidad</p>
                    {f.alertLevel !== 'none' && f.alertMessage && (
                      <div style={{
                        padding: '5px 8px', borderRadius: 6, textAlign: 'center', maxWidth: 160,
                        background: f.alertLevel === 'danger' ? C.redDim : f.alertLevel === 'warn' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.06)',
                      }}>
                        <p style={{ fontSize: 9, color: f.alertLevel === 'danger' ? C.red : f.alertLevel === 'warn' ? C.amber : C.textMid, lineHeight: 1.4 }}>
                          {f.alertMessage}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Donut estados */}
                  <div style={{ background: C.panel, padding: '16px 14px', display: 'flex', flexDirection: 'column' }}>
                    <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>Distribución</p>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                      <DonutEstados completadas={a.visits} canceladas={a.canc} noShows={a.ns} />
                    </div>
                  </div>

                  {/* Métricas clicables */}
                  <div style={{ background: C.panel, padding: '16px 20px' }}>
                    <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>Métricas</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', columnGap: 16 }}>
                      {[
                        { v: a.visits, l: 'Completadas', c: C.accent, filtro: 'completadas' as FiltroEstado },
                        { v: a.canc,   l: 'Cancelaciones', c: a.canc > 0 ? C.amber : C.textDim, filtro: 'canceladas' as FiltroEstado },
                        { v: a.ns,     l: 'No-shows', c: a.ns > 0 ? C.red : C.textDim, filtro: 'no-show' as FiltroEstado },
                        { v: a.freq ? `~${a.freq}` : '—', l: 'Intervalo medio', c: C.blue, s: a.freq ? 'días' : '', filtro: 'todos' as FiltroEstado },
                        { v: a.total,  l: 'Total citas', c: C.textMid, filtro: 'todos' as FiltroEstado },
                        { v: a.daysSince !== null ? a.daysSince : '—', l: 'Desde última', c: a.daysSince !== null && a.daysSince > 60 ? C.red : a.daysSince !== null && a.daysSince > 30 ? C.amber : C.text, s: a.daysSince !== null ? 'días' : '', filtro: 'todos' as FiltroEstado },
                      ].map((k: any, i) => {
                        const isClickable = ['completadas','canceladas','no-show'].includes(k.filtro);
                        const isActive = filtroActivo === k.filtro && isClickable;
                        return (
                          <div key={i}
                            onClick={() => isClickable ? setFiltroActivo(isActive ? 'todos' : k.filtro) : undefined}
                            style={{
                              padding: '10px 0', borderBottom: `1px solid ${C.divider}`,
                              cursor: isClickable ? 'pointer' : 'default',
                              borderRadius: isActive ? 6 : 0,
                              background: isActive ? k.c + '10' : 'transparent',
                              outline: isActive ? `1px solid ${k.c}30` : 'none',
                              transition: 'background 0.15s',
                            }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                              <span style={{ fontSize: 24, fontWeight: 800, color: k.c, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{k.v}</span>
                              {k.s && <span style={{ fontSize: 10, color: C.textDim }}>{k.s}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>{k.l}</span>
                              {isClickable && <span style={{ fontSize: 8, color: isActive ? k.c : C.textDim }}>▼</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* FILA 2: Actividad + Historial filtrado */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, flex: 1 }}>

                  {/* Gráfico actividad */}
                  <div style={{ background: C.panel, padding: '14px 16px' }}>
                    <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>Actividad · 6 meses</p>
                    <ActivityChart citas={historialCitas} />
                  </div>

                  {/* Historial filtrado */}
                  <div style={{ background: C.panel, padding: '14px 16px', overflow: 'auto', maxHeight: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <p style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                        {filtroActivo === 'todos' ? 'Últimas citas' : filtros.find(f => f.key === filtroActivo)?.label}
                        {' '}
                        <span style={{ color: C.textDim, fontWeight: 400 }}>({citasFiltradas.length})</span>
                      </p>
                      {filtroActivo !== 'todos' && (
                        <button onClick={() => setFiltroActivo('todos')}
                          style={{ fontSize: 9, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, background: C.panelAlt } as any}>
                          Ver todas
                        </button>
                      )}
                    </div>

                    {/* Pills de filtro rápido */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                      {filtros.map(fl => (
                        <button key={fl.key} onClick={() => setFiltroActivo(fl.key)}
                          style={{
                            padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                            background: filtroActivo === fl.key ? fl.color + '22' : C.panelAlt,
                            color: filtroActivo === fl.key ? fl.color : C.textDim,
                            outline: filtroActivo === fl.key ? `1px solid ${fl.color}44` : 'none',
                          }}>
                          {fl.label} {fl.count > 0 && `(${fl.count})`}
                        </button>
                      ))}
                    </div>

                    {citasFiltradas.length > 0 ? (
                      <>
                        {citasFiltradas.slice(0, 15).map((c, i, arr) => <TDot key={c.id} cita={c} isLast={i === arr.length - 1} />)}
                        {citasFiltradas.length > 15 && <p style={{ fontSize: 10, color: C.textDim, marginTop: 6 }}>+{citasFiltradas.length - 15} más</p>}
                      </>
                    ) : (
                      <p style={{ fontSize: 11, color: C.textDim }}>
                        {filtroActivo === 'todos' ? 'Sin citas' : `Sin citas en este filtro`}
                      </p>
                    )}
                  </div>
                </div>

                {/* FILA 3: Rentabilidad (opcional) */}
                {mostrarImporte && a.citasConImporte > 0 && (
                  <div style={{
                    background: C.panel, padding: '14px 20px',
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
                      <div>
                        <span style={{ fontSize: 22, fontWeight: 800, color: C.textMid, fontVariantNumeric: 'tabular-nums' }}>{a.citasConImporte}/{a.total}</span>
                        <p style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase' }}>Con importe</p>
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
