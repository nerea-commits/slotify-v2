'use client';

import { useState, useEffect, useRef, forwardRef } from 'react';
import { supabase } from '@/lib/supabase';
import { X, AlertTriangle, Info, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Clock, Calendar, User } from 'lucide-react';
import { calcularFiabilidad, type FiabilidadResult } from '@/lib/fiabilidad';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  profesionalId: string;
  empresaId: string;
  selectedDate: Date;
  preselectedTime?: string;
  preselectedEndTime?: string;
  preselectedProfesionalId?: string; // para cuando se abre desde columna de equipo
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function normalizeTel(t: string): string {
  return t.replace(/\D/g, '');
}

function blocksTime(estado: string): boolean {
  const e = (estado || '').toLowerCase().trim();
  return !(e === 'cancelada' || e === 'no-show' || e === 'no_show' || e === 'completada');
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function fmtDuracion(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Tokens de diseño ────────────────────────────────────────────────────────

const C = {
  bg:         '#0F172A',
  surface:    '#111827',
  surfaceAlt: '#1A2332',
  border:     'rgba(148,163,184,0.08)',
  borderFocus:'rgba(34,197,94,0.45)',
  borderGreen:'rgba(34,197,94,0.3)',
  text:       '#F1F5F9',
  textSec:    '#64748B',
  textTer:    '#334155',
  green:      '#22C55E',
  greenBg:    'rgba(34,197,94,0.08)',
  yellow:     '#F59E0B',
  red:        '#EF4444',
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Field({ label, badge, children }: { label: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <label style={{ fontSize: 11, color: C.textSec, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' as const }}>
          {label}
        </label>
        {badge}
      </div>
      {children}
    </div>
  );
}

const InputBase = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function InputBase({ style, onFocus, onBlur, ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      style={{
        width: '100%',
        padding: '11px 14px',
        background: C.surfaceAlt,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        color: C.text,
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box' as const,
        transition: 'border-color 0.15s',
        ...style,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = C.borderFocus; if (onFocus) onFocus(e); }}
      onBlur={e => {
        const base = (style as any)?.borderColor || C.border;
        e.currentTarget.style.borderColor = base;
        if (onBlur) onBlur(e);
      }}
    />
  );
});
InputBase.displayName = 'InputBase';

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NuevaCitaModal({
  open, onClose, onCreated,
  profesionalId, empresaId,
  selectedDate, preselectedTime, preselectedEndTime,
  preselectedProfesionalId,
}: Props) {

  // ── Estado cliente ──
  const [nombre,           setNombre]           = useState('');
  const [telefono,         setTelefono]         = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState<any>(null);
  const [buscandoCliente,  setBuscandoCliente]  = useState(false);
  const [fiabilidad,       setFiabilidad]       = useState<FiabilidadResult | null>(null);
  // Búsqueda por nombre
  const [sugerenciasNombre, setSugerenciasNombre] = useState<any[]>([]);
  const [showSugNombre,    setShowSugNombre]    = useState(false);
  const [todosClientes,    setTodosClientes]    = useState<any[]>([]);

  // ── Estado servicio ──
  const [servicioId,       setServicioId]       = useState('');
  const [servicioTexto,    setServicioTexto]    = useState(''); // campo híbrido unificado
  const [servicios,        setServicios]        = useState<any[]>([]);
  const [showSugSvc,       setShowSugSvc]       = useState(false);
  const [svcSugerencias,   setSvcSugerencias]   = useState<any[]>([]);

  // ── Estado tiempo ──
  const [horaInicio,       setHoraInicio]       = useState('09:00');
  const [horaFin,          setHoraFin]          = useState('10:00');
  const [autoFilledFin,    setAutoFilledFin]    = useState(false);

  // ── Estado config ──
  const [mostrarImporte,   setMostrarImporte]   = useState(false);
  const [estadoDefault,    setEstadoDefault]    = useState('Programada');

  // ── Profesionales ──
  const [profesionales,    setProfesionales]    = useState<any[]>([]);
  const [profSeleccionado, setProfSeleccionado] = useState<string>('');

  // ── Estado secundarios (colapsados por defecto) ──
  const [showSecundarios,  setShowSecundarios]  = useState(false);
  const [notas,            setNotas]            = useState('');
  const [importe,          setImporte]          = useState('');
  const [autoFilledImporte, setAutoFilledImporte] = useState(false);

  // ── UI ──
  const [guardando,        setGuardando]        = useState(false);
  const [error,            setError]            = useState('');

  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceNombre = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svcInputRef    = useRef<HTMLInputElement>(null);
  const clienteNomRef  = useRef<HTMLInputElement>(null);

  // ── Init al abrir ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !empresaId) return;

    cargarServicios();
    cargarEstados();
    cargarConfigImporte();
    cargarClientes();
    cargarProfesionales();

    setNombre(''); setTelefono('');
    setServicioId(''); setServicioTexto('');
    setNotas(''); setImporte(''); setError('');
    setClienteEncontrado(null); setFiabilidad(null);
    setAutoFilledFin(false); setAutoFilledImporte(false);
    setShowSecundarios(false);
    setSugerenciasNombre([]); setShowSugNombre(false);
    setShowSugSvc(false);
    // Profesional: preseleccionado desde columna de equipo o el propio usuario
    setProfSeleccionado(preselectedProfesionalId || profesionalId || '');

    if (preselectedTime) {
      setHoraInicio(preselectedTime);
      setHoraFin(preselectedEndTime ? preselectedEndTime : addMinutes(preselectedTime, 60));
      setAutoFilledFin(true);
    } else {
      setHoraInicio('09:00'); setHoraFin('10:00');
    }
  }, [open, empresaId, preselectedTime, preselectedEndTime, profesionalId, preselectedProfesionalId]);

  // ── Carga datos ────────────────────────────────────────────────────────────
  async function cargarServicios() {
    const { data } = await supabase
      .from('servicios').select('*')
      .eq('empresa_id', empresaId).eq('activo', true)
      .order('orden').order('nombre');
    setServicios(data || []);
  }

  async function cargarEstados() {
    const { data } = await supabase
      .from('estados_cita').select('*')
      .eq('empresa_id', empresaId).eq('activo', true).order('orden');
    const programada = data?.find(e =>
      (e.nombre_defecto || '').toLowerCase() === 'programada' ||
      (e.nombre_personalizado || '').toLowerCase() === 'programada'
    );
    const def = programada
      ? (programada.nombre_personalizado || programada.nombre_defecto)
      : data?.[0] ? (data[0].nombre_personalizado || data[0].nombre_defecto) : 'Programada';
    setEstadoDefault(def);
  }

  async function cargarProfesionales() {
    const { data } = await supabase
      .from('profesionales').select('id, nombre, color, foto_url')
      .eq('empresa_id', empresaId).eq('activo', true).order('nombre');
    setProfesionales(data || []);
  }

  async function cargarConfigImporte() {
    const { data } = await supabase.from('empresas').select('mostrar_importe').eq('id', empresaId).single();
    setMostrarImporte(data?.mostrar_importe || false);
  }

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('*').eq('empresa_id', empresaId).limit(500);
    setTodosClientes(data || []);
  }

  // ── Búsqueda por teléfono ──────────────────────────────────────────────────
  useEffect(() => {
    const digits = normalizeTel(telefono);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (digits.length >= 6) {
      debounceRef.current = setTimeout(() => buscarClientePorTel(digits), 350);
    } else {
      if (!nombre.trim()) setClienteEncontrado(null);
      setFiabilidad(null);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [telefono]);

  async function buscarClientePorTel(digits: string) {
    setBuscandoCliente(true);
    try {
      const found = todosClientes.find(c => {
        const t = normalizeTel(c.telefono || '');
        return t === digits || t.endsWith(digits) || digits.endsWith(t);
      });
      if (found) {
        setClienteEncontrado(found);
        if (!nombre.trim()) setNombre(found.nombre);
        const { data: citas } = await supabase
          .from('citas').select('id, estado, estado_detallado, hora_inicio')
          .eq('cliente_id', found.id).limit(200);
        if (citas) setFiabilidad(calcularFiabilidad(citas));
      } else {
        setClienteEncontrado(null); setFiabilidad(null);
      }
    } finally { setBuscandoCliente(false); }
  }

  // ── Búsqueda por nombre ────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceNombre.current) clearTimeout(debounceNombre.current);
    if (clienteEncontrado) return; // ya está fijado
    if (nombre.trim().length >= 2) {
      debounceNombre.current = setTimeout(() => {
        const q = nombre.trim().toLowerCase();
        const matches = todosClientes.filter(c =>
          (c.nombre || '').toLowerCase().includes(q)
        ).slice(0, 5);
        setSugerenciasNombre(matches);
        setShowSugNombre(matches.length > 0);
      }, 200);
    } else {
      setSugerenciasNombre([]); setShowSugNombre(false);
    }
    return () => { if (debounceNombre.current) clearTimeout(debounceNombre.current); };
  }, [nombre, todosClientes, clienteEncontrado]);

  async function seleccionarClienteDeNombre(cliente: any) {
    setClienteEncontrado(cliente);
    setNombre(cliente.nombre);
    if (cliente.telefono && !telefono.trim()) setTelefono(cliente.telefono);
    setShowSugNombre(false);
    const { data: citas } = await supabase
      .from('citas').select('id, estado, estado_detallado, hora_inicio')
      .eq('cliente_id', cliente.id).limit(200);
    if (citas) setFiabilidad(calcularFiabilidad(citas));
  }

  function limpiarCliente() {
    setClienteEncontrado(null); setFiabilidad(null);
    setNombre(''); setTelefono('');
    setSugerenciasNombre([]); setShowSugNombre(false);
  }

  // ── Servicio híbrido ───────────────────────────────────────────────────────
  function handleServicioTexto(val: string) {
    setServicioTexto(val);
    setServicioId(''); // texto libre desvincula catálogo
    setAutoFilledFin(false); setAutoFilledImporte(false);

    if (val.trim().length >= 1 && servicios.length > 0) {
      const q = val.toLowerCase();
      const matches = servicios.filter(s => s.nombre.toLowerCase().includes(q)).slice(0, 6);
      setSvcSugerencias(matches);
      setShowSugSvc(matches.length > 0);
    } else {
      setShowSugSvc(false);
    }
  }

  function seleccionarServicio(svc: any) {
    setServicioId(svc.id);
    setServicioTexto(svc.nombre);
    setShowSugSvc(false);
    // Autocompleta duración
    setHoraFin(addMinutes(horaInicio, svc.duracion_minutos));
    setAutoFilledFin(true);
    // Autocompleta importe si aplica
    if (mostrarImporte && svc.precio != null && svc.precio > 0) {
      setImporte(String(svc.precio));
      setAutoFilledImporte(true);
      setShowSecundarios(true); // abre secundarios para que se vea el importe sugerido
    }
  }

  function handleHoraInicioChange(val: string) {
    setHoraInicio(val);
    if (servicioId && autoFilledFin) {
      const svc = servicios.find(s => s.id === servicioId);
      if (svc) setHoraFin(addMinutes(val, svc.duracion_minutos));
    }
  }

  // ── Validación y guardado ─────────────────────────────────────────────────
  async function validarSolapamiento(fecha: string, inicio: string, fin: string): Promise<string | null> {
    const { data } = await supabase
      .from('citas').select('id, hora_inicio')
      .eq('empresa_id', empresaId).eq('profesional_id', profesionalId)
      .eq('blocks_time', true)
      .lt('hora_inicio', `${fecha}T${fin}:00`)
      .gt('hora_fin', `${fecha}T${inicio}:00`);
    if (data && data.length > 0) {
      return `Conflicto: ya hay una cita a las ${data[0].hora_inicio?.substring(11, 16)}`;
    }
    return null;
  }

  async function guardar() {
    if (!nombre.trim()) { setError('El nombre del cliente es obligatorio'); return; }
    if (!horaInicio || !horaFin) { setError('Indica hora inicio y fin'); return; }
    if (horaFin <= horaInicio) { setError('La hora de fin debe ser posterior al inicio'); return; }

    setGuardando(true); setError('');
    const fecha = selectedDate.toISOString().split('T')[0];
    const conflicto = await validarSolapamiento(fecha, horaInicio, horaFin);
    if (conflicto) { setError(conflicto); setGuardando(false); return; }

    let clienteId = clienteEncontrado?.id;
    if (!clienteId) {
      const tel = normalizeTel(telefono);
      const insertData: any = { empresa_id: empresaId, nombre: nombre.trim() };
      if (tel) insertData.telefono = telefono.trim();
      const { data: nuevo, error: errCl } = await supabase.from('clientes').insert(insertData).select().single();
      if (errCl || !nuevo) { setError('Error al crear cliente'); setGuardando(false); return; }
      clienteId = nuevo.id;
    }

    const estadoFinal = estadoDefault;
    const svcObj = servicios.find(s => s.id === servicioId);
    const profId = profSeleccionado || profesionalId;

    const citaData: any = {
      empresa_id:     empresaId,
      profesional_id: profId,
      cliente_id:     clienteId,
      hora_inicio:    `${fecha}T${horaInicio}:00`,
      hora_fin:       `${fecha}T${horaFin}:00`,
      estado:         estadoFinal,
      blocks_time:    blocksTime(estadoFinal),
      notas:          notas.trim() || null,
    };

    if (svcObj) {
      citaData.servicio_id = svcObj.id;
      citaData.servicio_nombre_libre = svcObj.nombre;
    } else if (servicioTexto.trim()) {
      citaData.servicio_nombre_libre = servicioTexto.trim();
    }

    if (mostrarImporte && importe.trim()) {
      const num = parseFloat(importe.replace(',', '.'));
      if (!isNaN(num) && num >= 0) citaData.importe = num;
    }

    const { error: errCita } = await supabase.from('citas').insert(citaData);
    if (errCita) { setError('Error al crear cita: ' + errCita.message); setGuardando(false); return; }

    setGuardando(false); onCreated(); onClose();
  }

  if (!open) return null;

  // ── Datos derivados ────────────────────────────────────────────────────────
  const alertInfo = fiabilidad && fiabilidad.alertLevel !== 'none' && fiabilidad.alertMessage ? {
    level:       fiabilidad.alertLevel,
    color:       fiabilidad.alertLevel === 'danger' ? C.red : fiabilidad.alertLevel === 'warn' ? C.yellow : '#60A5FA',
    bgColor:     fiabilidad.alertLevel === 'danger' ? 'rgba(239,68,68,0.08)' : fiabilidad.alertLevel === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.06)',
    borderColor: fiabilidad.alertLevel === 'danger' ? 'rgba(239,68,68,0.2)' : fiabilidad.alertLevel === 'warn' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.15)',
    message:     fiabilidad.alertMessage,
    detail: (() => {
      const parts: string[] = [];
      if ((fiabilidad as any).noShowsReales > 0) parts.push(`${(fiabilidad as any).noShowsReales} no-show${(fiabilidad as any).noShowsReales !== 1 ? 's' : ''}`);
      if ((fiabilidad as any).cancelacionesTardias > 0) parts.push(`${(fiabilidad as any).cancelacionesTardias} cancel. tardía${(fiabilidad as any).cancelacionesTardias !== 1 ? 's' : ''}`);
      return parts.length ? parts.join(' · ') + ` · ${fiabilidad.completadas}/${fiabilidad.totalCitas}` : `${fiabilidad.completadas} completadas de ${fiabilidad.totalCitas}`;
    })(),
  } : null;

  const selectedSvc    = servicios.find(s => s.id === servicioId);
  const durMin         = selectedSvc?.duracion_minutos;
  const hasSecundarios = mostrarImporte || notas.length > 0;
  // Mostrar selector de profesional solo si hay más de uno
  const mostrarSelectorProf = profesionales.length > 1;
  const profActual     = profesionales.find(p => p.id === profSeleccionado);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}
      onClick={onClose}
    >
      <div
        style={{ background: C.surface, borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Cabecera ──────────────────────────────────────────────────── */}
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid rgba(148,163,184,0.07)`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.2, margin: 0 }}>Nueva cita</h3>
              {/* Contexto: fecha + hora */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7, flexWrap: 'wrap' as const }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(148,163,184,0.06)', borderRadius: 7, padding: '4px 9px' }}>
                  <Calendar size={11} color={C.textSec} />
                  <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>
                    {fmtFecha(selectedDate)}
                  </span>
                </div>
                {preselectedTime && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 7, padding: '4px 9px' }}>
                    <Clock size={11} color={C.green} />
                    <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>
                      {horaInicio}{preselectedEndTime ? ` – ${horaFin}` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'rgba(148,163,184,0.06)', border: 'none', borderRadius: 8, cursor: 'pointer', color: C.textSec, padding: 7, display: 'flex', flexShrink: 0, marginLeft: 8 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)'; }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Cuerpo scrollable ─────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── ZONA CLIENTE ────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Cliente encontrado — modo compacto */}
            {clienteEncontrado ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.greenBg, border: `1px solid ${C.borderGreen}`, borderRadius: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={14} color={C.green} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.2 }}>{clienteEncontrado.nombre}</p>
                  {clienteEncontrado.telefono && (
                    <p style={{ fontSize: 11, color: C.textSec, margin: '2px 0 0' }}>{clienteEncontrado.telefono}</p>
                  )}
                </div>
                <button
                  onClick={limpiarCliente}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, padding: 4, display: 'flex' }}
                  title="Cambiar cliente"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              /* Inputs nombre + teléfono en fila */
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Nombre con sugerencias */}
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <label style={{ fontSize: 11, color: C.textSec, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Nombre</label>
                    <span style={{ fontSize: 10, color: C.textTer }}>*</span>
                  </div>
                  <InputBase
                    ref={clienteNomRef}
                    type="text"
                    placeholder="Nombre cliente"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    autoComplete="off"
                  />
                  {/* Dropdown sugerencias por nombre */}
                  {showSugNombre && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#1E2D40', border: `1px solid rgba(148,163,184,0.15)`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 3 }}>
                      {sugerenciasNombre.map(c => (
                        <button
                          key={c.id}
                          onMouseDown={() => seleccionarClienteDeNombre(c)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `1px solid rgba(148,163,184,0.07)`, textAlign: 'left' as const }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.06)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                        >
                          <User size={12} color={C.textSec} style={{ flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{c.nombre}</p>
                            {c.telefono && <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>{c.telefono}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Teléfono */}
                <div style={{ width: 130, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                    <label style={{ fontSize: 11, color: C.textSec, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Teléfono</label>
                  </div>
                  <InputBase
                    type="tel"
                    placeholder="600 000 000"
                    value={telefono}
                    inputMode="tel"
                    onChange={e => setTelefono(e.target.value)}
                    style={{ borderColor: buscandoCliente ? 'rgba(148,163,184,0.2)' : C.border }}
                  />
                </div>
              </div>
            )}

            {/* Estado búsqueda */}
            {!clienteEncontrado && buscandoCliente && (
              <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>Buscando...</p>
            )}
            {!clienteEncontrado && !buscandoCliente && normalizeTel(telefono).length >= 6 && (
              <p style={{ fontSize: 11, color: C.textTer, margin: 0 }}>Nuevo cliente · se creará al guardar</p>
            )}

            {/* Alerta fiabilidad */}
            {alertInfo && (
              <div style={{ padding: '9px 12px', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 9, background: alertInfo.bgColor, border: `1px solid ${alertInfo.borderColor}` }}>
                {alertInfo.level === 'danger' && <AlertCircle size={13} color={alertInfo.color} style={{ flexShrink: 0, marginTop: 1 }} />}
                {alertInfo.level === 'warn'   && <AlertTriangle size={13} color={alertInfo.color} style={{ flexShrink: 0, marginTop: 1 }} />}
                {alertInfo.level === 'info'   && <Info size={13} color={alertInfo.color} style={{ flexShrink: 0, marginTop: 1 }} />}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: alertInfo.color, lineHeight: 1.4, margin: 0 }}>{alertInfo.message}</p>
                  <p style={{ fontSize: 11, color: C.textSec, margin: '2px 0 0' }}>{alertInfo.detail}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── SELECTOR PROFESIONAL (flujo principal, solo si hay >1) ──── */}
          {mostrarSelectorProf && (
            <>
              <div style={{ height: 1, background: 'rgba(148,163,184,0.06)' }} />
              <div>
                <label style={{ fontSize: 11, color: C.textSec, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const, display: 'block', marginBottom: 7 }}>
                  Profesional
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  {profesionales.map(p => {
                    const sel = profSeleccionado === p.id;
                    const color = p.color || C.green;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setProfSeleccionado(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '6px 11px 6px 7px',
                          borderRadius: 9,
                          border: sel ? `1.5px solid ${color}55` : `1px solid ${C.border}`,
                          background: sel ? color + '14' : C.surfaceAlt,
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,0.2)'; }}
                        onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          background: p.foto_url ? 'transparent' : color + '25',
                          border: `1.5px solid ${color}50`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', fontSize: 10, fontWeight: 800, color,
                        }}>
                          {p.foto_url
                            ? <img src={p.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : (p.nombre?.[0] || '?').toUpperCase()
                          }
                        </div>
                        <span style={{ fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? C.text : C.textSec, whiteSpace: 'nowrap' as const }}>
                          {p.nombre}
                        </span>
                        {sel && <CheckCircle size={11} color={color} style={{ flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── SEPARADOR ───────────────────────────────────────────────── */}
          <div style={{ height: 1, background: 'rgba(148,163,184,0.06)' }} />

          {/* ── ZONA SERVICIO + TIEMPO ───────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Servicio híbrido */}
            <Field label="Servicio">
              <div style={{ position: 'relative' }}>
                <InputBase
                  ref={svcInputRef}
                  type="text"
                  placeholder={servicios.length > 0 ? 'Escribe o elige de tu catálogo…' : 'Ej: Corte de pelo, revisión…'}
                  value={servicioTexto}
                  onChange={e => handleServicioTexto(e.target.value)}
                  autoComplete="off"
                  style={{
                    borderColor: servicioId ? C.borderGreen : C.border,
                    paddingRight: servicioId ? 36 : 14,
                  }}
                />
                {/* Indicador servicio de catálogo */}
                {servicioId && (
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <CheckCircle size={13} color={C.green} />
                  </div>
                )}
                {/* Dropdown sugerencias servicio */}
                {showSugSvc && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#1E2D40', border: `1px solid rgba(148,163,184,0.15)`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 3 }}>
                    {svcSugerencias.map(svc => (
                      <button
                        key={svc.id}
                        onMouseDown={() => seleccionarServicio(svc)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `1px solid rgba(148,163,184,0.06)`, textAlign: 'left' as const }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.06)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{svc.nombre}</span>
                        <span style={{ fontSize: 11, color: C.textSec, whiteSpace: 'nowrap' as const, marginLeft: 8 }}>
                          {fmtDuracion(svc.duracion_minutos)}{svc.precio ? ` · ${svc.precio}€` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Confirmación de autocompletado */}
              {selectedSvc && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 11, color: C.green }}>⏱ {fmtDuracion(durMin!)} autocompletado</span>
                  {selectedSvc.precio && mostrarImporte && <span style={{ fontSize: 11, color: C.green }}>· {selectedSvc.precio}€ sugerido</span>}
                  <span style={{ fontSize: 11, color: C.textTer }}>(puedes editar)</span>
                </div>
              )}
            </Field>

            {/* Tiempo — fila inicio + fin + duración visual */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: C.textSec, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const, display: 'block', marginBottom: 5 }}>Inicio</label>
                <InputBase
                  type="time"
                  value={horaInicio}
                  onChange={e => handleHoraInicioChange(e.target.value)}
                />
              </div>
              <div style={{ paddingBottom: 11, color: C.textTer, fontSize: 14, flexShrink: 0 }}>–</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <label style={{ fontSize: 11, color: C.textSec, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Fin</label>
                  {autoFilledFin && <span style={{ fontSize: 10, color: C.green, fontWeight: 500 }}>auto</span>}
                </div>
                <InputBase
                  type="time"
                  value={horaFin}
                  onChange={e => { setHoraFin(e.target.value); setAutoFilledFin(false); }}
                  style={{ borderColor: autoFilledFin ? C.borderGreen : C.border }}
                />
              </div>
              {/* Duración calculada */}
              {horaInicio && horaFin && horaFin > horaInicio && (() => {
                const [h1, m1] = horaInicio.split(':').map(Number);
                const [h2, m2] = horaFin.split(':').map(Number);
                const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (diff <= 0) return null;
                return (
                  <div style={{ paddingBottom: 10, flexShrink: 0 }}>
                    <div style={{ background: 'rgba(148,163,184,0.06)', borderRadius: 7, padding: '5px 9px' }}>
                      <span style={{ fontSize: 11, color: C.textSec, fontWeight: 500 }}>{fmtDuracion(diff)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── CAMPOS SECUNDARIOS (colapsable) ─────────────────────────── */}
          {hasSecundarios && (
            <>
              <div style={{ height: 1, background: 'rgba(148,163,184,0.06)' }} />
              <button
                onClick={() => setShowSecundarios(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', width: 'fit-content' }}
              >
                <ChevronRight
                  size={13}
                  color={C.textSec}
                  style={{ transform: showSecundarios ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>
                  {showSecundarios ? 'Menos opciones' : 'Más opciones'}
                  {(autoFilledImporte || notas) && !showSecundarios && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: C.green }}>
                      {[autoFilledImporte && '€', notas && 'nota'].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              </button>

              {showSecundarios && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* Importe */}
                  {mostrarImporte && (
                    <Field
                      label="Importe"
                      badge={
                        autoFilledImporte
                          ? <span style={{ fontSize: 10, color: C.green, fontWeight: 500 }}>sugerido</span>
                          : <span style={{ fontSize: 10, color: C.textTer }}>opcional</span>
                      }
                    >
                      <div style={{ position: 'relative' }}>
                        <InputBase
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={importe}
                          onChange={e => { setImporte(e.target.value); setAutoFilledImporte(false); }}
                          style={{ paddingRight: 36, borderColor: autoFilledImporte ? C.borderGreen : C.border }}
                        />
                        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: C.textTer, fontSize: 13, fontWeight: 600 }}>€</span>
                      </div>
                    </Field>
                  )}

                  {/* Notas */}
                  <Field label="Notas">
                    <textarea
                      placeholder="Observaciones, preferencias..."
                      value={notas}
                      onChange={e => setNotas(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '11px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
                    />
                  </Field>

                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
              <AlertCircle size={13} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: C.red, fontSize: 13, lineHeight: 1.4, margin: 0 }}>{error}</p>
            </div>
          )}

        </div>

        {/* ── Footer fijo ──────────────────────────────────────────────── */}
        <div style={{ padding: '14px 20px 18px', borderTop: `1px solid rgba(148,163,184,0.07)`, flexShrink: 0, background: C.surface }}>
          <button
            onClick={guardar}
            disabled={guardando}
            style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: guardando ? '#15803D' : C.green, color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: guardando ? 0.75 : 1, transition: 'background 0.15s', letterSpacing: 0.2 }}
            onMouseEnter={e => { if (!guardando) (e.currentTarget as HTMLElement).style.background = '#16A34A'; }}
            onMouseLeave={e => { if (!guardando) (e.currentTarget as HTMLElement).style.background = C.green; }}
          >
            {guardando ? 'Guardando...' : 'Crear cita'}
          </button>
        </div>

      </div>
    </div>
  );
}
