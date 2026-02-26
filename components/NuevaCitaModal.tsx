'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { X, AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { calcularFiabilidad, type FiabilidadResult } from '@/lib/fiabilidad';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  profesionalId: string;
  empresaId: string;
  selectedDate: Date;
  preselectedTime?: string;
}

// Normaliza un teléfono: solo dígitos
function normalizeTel(t: string): string {
  return t.replace(/\D/g, '');
}

// ═══ HELPER: ¿Este estado ocupa hueco? ═══
function blocksTime(estado: string): boolean {
  const e = (estado || '').toLowerCase().trim();
  if (e === 'cancelada' || e === 'no-show' || e === 'no_show' || e === 'completada') return false;
  return true; // confirmada, pendiente, en proceso, lista de espera, desconocido → bloquea
}

export default function NuevaCitaModal({
  open, onClose, onCreated, profesionalId, empresaId, selectedDate, preselectedTime
}: Props) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [servicio, setServicio] = useState('');
  const [servicios, setServicios] = useState<any[]>([]);
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('10:00');
  const [notas, setNotas] = useState('');
  const [importe, setImporte] = useState('');
  const [mostrarImporte, setMostrarImporte] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Estados de cita
  const [estadosCita, setEstadosCita] = useState<any[]>([]);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('');

  // Cliente encontrado y fiabilidad
  const [clienteEncontrado, setClienteEncontrado] = useState<any>(null);
  const [fiabilidad, setFiabilidad] = useState<FiabilidadResult | null>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar datos al abrir
  useEffect(() => {
    if (open && empresaId) {
      cargarServicios();
      cargarEstados();
      cargarConfigImporte();
      // Reset form
      setNombre('');
      setTelefono('');
      setServicio('');
      setNotas('');
      setImporte('');
      setError('');
      setClienteEncontrado(null);
      setFiabilidad(null);

      if (preselectedTime) {
        setHoraInicio(preselectedTime);
        const [h, m] = preselectedTime.split(':').map(Number);
        const totalMin = h * 60 + m + 60;
        const hFin = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
        const mFin = String(totalMin % 60).padStart(2, '0');
        setHoraFin(`${hFin}:${mFin}`);
      } else {
        setHoraInicio('09:00');
        setHoraFin('10:00');
      }
    }
  }, [open, empresaId, preselectedTime]);

  async function cargarServicios() {
    const { data } = await supabase.from('servicios').select('*').eq('empresa_id', empresaId).order('nombre');
    setServicios(data || []);
  }

  async function cargarEstados() {
    const { data } = await supabase
      .from('estados_cita').select('*')
      .eq('empresa_id', empresaId).eq('activo', true)
      .order('orden');
    setEstadosCita(data || []);
    const confirmada = data?.find(e =>
      (e.nombre_defecto || '').toLowerCase() === 'confirmada' ||
      (e.nombre_personalizado || '').toLowerCase() === 'confirmada'
    );
    if (confirmada) setEstadoSeleccionado(confirmada.nombre_personalizado || confirmada.nombre_defecto);
    else if (data && data.length > 0) setEstadoSeleccionado(data[0].nombre_personalizado || data[0].nombre_defecto);
  }

  async function cargarConfigImporte() {
    const { data } = await supabase.from('empresas').select('mostrar_importe').eq('id', empresaId).single();
    setMostrarImporte(data?.mostrar_importe || false);
  }

  // ═══ BUSCAR CLIENTE POR TELÉFONO con debounce ═══
  useEffect(() => {
    const digits = normalizeTel(telefono);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (digits.length >= 6) {
      debounceRef.current = setTimeout(() => {
        buscarClientePorTelefono(digits);
      }, 400);
    } else {
      setClienteEncontrado(null);
      setFiabilidad(null);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [telefono]);

  async function buscarClientePorTelefono(digits: string) {
    setBuscandoCliente(true);
    try {
      const { data: clientes } = await supabase
        .from('clientes')
        .select('*')
        .eq('empresa_id', empresaId);

      if (clientes && clientes.length > 0) {
        const found = clientes.find(c => {
          const telNorm = normalizeTel(c.telefono || '');
          return telNorm === digits || telNorm.endsWith(digits) || digits.endsWith(telNorm);
        });

        if (found) {
          setClienteEncontrado(found);
          if (!nombre.trim()) setNombre(found.nombre);

          const { data: citas } = await supabase
            .from('citas').select('id, estado')
            .eq('cliente_id', found.id)
            .limit(200);

          if (citas) setFiabilidad(calcularFiabilidad(citas));
        } else {
          setClienteEncontrado(null);
          setFiabilidad(null);
        }
      } else {
        setClienteEncontrado(null);
        setFiabilidad(null);
      }
    } catch (e) {
      console.error('Error buscando cliente:', e);
    } finally {
      setBuscandoCliente(false);
    }
  }

  // ═══ VALIDAR SOLAPAMIENTO — filtra por blocks_time = true ═══
  async function validarSolapamiento(fecha: string, inicio: string, fin: string, excludeId?: string): Promise<string | null> {
    const hInicioISO = `${fecha}T${inicio}:00`;
    const hFinISO = `${fecha}T${fin}:00`;

    let query = supabase
      .from('citas')
      .select('id, hora_inicio, hora_fin, estado')
      .eq('empresa_id', empresaId)
      .eq('profesional_id', profesionalId)
      .eq('blocks_time', true)          // ← solo citas que realmente bloquean
      .lt('hora_inicio', hFinISO)
      .gt('hora_fin', hInicioISO);

    if (excludeId) query = query.neq('id', excludeId);

    const { data, error } = await query;
    if (error) { console.error('Error validando solapamiento:', error); return null; }

    if (data && data.length > 0) {
      const conflicto = data[0];
      const horaConflicto = conflicto.hora_inicio?.substring(11, 16) || '';
      return `Conflicto de horario: ya hay una cita a las ${horaConflicto}. Elige otro horario.`;
    }
    return null;
  }

  // ═══ GUARDAR CITA ═══
  async function guardar() {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!horaInicio || !horaFin) { setError('Indica hora inicio y fin'); return; }
    if (horaFin <= horaInicio) { setError('La hora de fin debe ser posterior a la de inicio'); return; }

    setGuardando(true);
    setError('');

    const fecha = selectedDate.toISOString().split('T')[0];

    const conflicto = await validarSolapamiento(fecha, horaInicio, horaFin);
    if (conflicto) { setError(conflicto); setGuardando(false); return; }

    const hInicio = `${fecha}T${horaInicio}:00`;
    const hFin = `${fecha}T${horaFin}:00`;

    // Buscar o crear cliente
    let clienteId = clienteEncontrado?.id;
    if (!clienteId) {
      const telNorm = normalizeTel(telefono);
      const insertData: any = { empresa_id: empresaId, nombre: nombre.trim() };
      if (telNorm) insertData.telefono = telefono.trim();
      const { data: nuevo, error: errCl } = await supabase.from('clientes').insert(insertData).select().single();
      if (errCl || !nuevo) { setError('Error al crear cliente'); setGuardando(false); return; }
      clienteId = nuevo.id;
    }

    // Preparar datos de cita — blocks_time calculado desde el estado
    const estadoFinal = estadoSeleccionado || 'Confirmada';
    const citaData: any = {
      empresa_id: empresaId,
      profesional_id: profesionalId,
      cliente_id: clienteId,
      hora_inicio: hInicio,
      hora_fin: hFin,
      estado: estadoFinal,
      blocks_time: blocksTime(estadoFinal),  // ← calculado automáticamente
      notas: notas.trim() || null,
    };

    const svcObj = servicios.find(s => s.id === servicio);
    if (svcObj) {
      citaData.servicio_id = svcObj.id;
    } else if (servicio.trim()) {
      citaData.servicio_nombre_libre = servicio.trim();
    }

    if (mostrarImporte && importe.trim()) {
      const num = parseFloat(importe.replace(',', '.'));
      if (!isNaN(num) && num >= 0) citaData.importe = num;
    }

    const { error: errCita } = await supabase.from('citas').insert(citaData);
    if (errCita) { setError('Error al crear cita: ' + errCita.message); setGuardando(false); return; }

    setGuardando(false);
    onCreated();
    onClose();
  }

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#111827', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 500, maxHeight: '92vh', overflow: 'auto', paddingBottom: 32 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>Nueva cita</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Teléfono */}
          <div>
            <label style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: 6 }}>TELÉFONO</label>
            <input
              type="tel" placeholder="600 000 000" value={telefono}
              onChange={e => setTelefono(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', background: '#1A2332', border: `1px solid ${clienteEncontrado ? 'rgba(34,197,94,0.4)' : 'rgba(148,163,184,0.06)'}`, borderRadius: 12, color: '#F1F5F9', fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
            />
            {buscandoCliente && <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 5 }}>Buscando cliente...</p>}
            {clienteEncontrado && !buscandoCliente && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <CheckCircle style={{ width: 13, height: 13, color: '#22C55E' }} />
                <p style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>Cliente existente: {clienteEncontrado.nombre}</p>
              </div>
            )}
            {!clienteEncontrado && !buscandoCliente && normalizeTel(telefono).length >= 6 && (
              <p style={{ fontSize: 11, color: '#4B5563', marginTop: 5 }}>Cliente nuevo</p>
            )}
          </div>

          {/* Alerta fiabilidad */}
          {fiabilidad && fiabilidad.alertLevel !== 'none' && fiabilidad.alertMessage && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10,
              background: fiabilidad.alertLevel === 'danger' ? 'rgba(239,68,68,0.08)' : fiabilidad.alertLevel === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.06)',
              border: `1px solid ${fiabilidad.alertLevel === 'danger' ? 'rgba(239,68,68,0.25)' : fiabilidad.alertLevel === 'warn' ? 'rgba(245,158,11,0.25)' : 'rgba(59,130,246,0.15)'}`,
            }}>
              {fiabilidad.alertLevel === 'danger' && <AlertCircle style={{ width: 15, height: 15, color: '#EF4444', flexShrink: 0, marginTop: 1 }} />}
              {fiabilidad.alertLevel === 'warn' && <AlertTriangle style={{ width: 15, height: 15, color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />}
              {fiabilidad.alertLevel === 'info' && <Info style={{ width: 15, height: 15, color: '#3B82F6', flexShrink: 0, marginTop: 1 }} />}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, color: fiabilidad.alertLevel === 'danger' ? '#EF4444' : fiabilidad.alertLevel === 'warn' ? '#F59E0B' : '#60A5FA' }}>
                  {fiabilidad.alertMessage}
                </p>
                <p style={{ fontSize: 11, color: '#4B5563', marginTop: 3 }}>
                  Fiabilidad: {fiabilidad.score}% · {fiabilidad.completadas} completadas de {fiabilidad.totalCitas}
                </p>
              </div>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: 6 }}>NOMBRE *</label>
            <input type="text" placeholder="Nombre del cliente" value={nombre} onChange={e => setNombre(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', background: '#1A2332', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 12, color: '#F1F5F9', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Servicio */}
          <div>
            <label style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: 6 }}>SERVICIO</label>
            {servicios.length > 0 ? (
              <select value={servicio} onChange={e => setServicio(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', background: '#1A2332', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 12, color: servicio ? '#F1F5F9' : '#4B5563', fontSize: 15, outline: 'none', boxSizing: 'border-box', appearance: 'none' }}>
                <option value="">Seleccionar servicio</option>
                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            ) : (
              <input type="text" placeholder="Ej: Corte de pelo" value={servicio} onChange={e => setServicio(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', background: '#1A2332', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 12, color: '#F1F5F9', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
              />
            )}
          </div>

          {/* Horario */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: 6 }}>INICIO</label>
              <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', background: '#1A2332', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 12, color: '#F1F5F9', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: 6 }}>FIN</label>
              <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', background: '#1A2332', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 12, color: '#F1F5F9', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Estado */}
          {estadosCita.length > 0 && (
            <div>
              <label style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: 8 }}>ESTADO</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {estadosCita.map(e => {
                  const nom = e.nombre_personalizado || e.nombre_defecto;
                  const selected = estadoSeleccionado === nom;
                  return (
                    <button key={e.id} onClick={() => setEstadoSeleccionado(nom)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: selected ? e.color + '22' : '#1A2332', color: selected ? e.color : '#94A3B8', outline: selected ? `2px solid ${e.color}` : 'none', transition: 'all 0.15s' }}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: e.color, marginRight: 6 }} />
                      {nom}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Importe */}
          {mostrarImporte && (
            <div>
              <label style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                IMPORTE ESTIMADO <span style={{ fontWeight: 400, color: '#4B5563' }}>(opcional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input type="text" inputMode="decimal" placeholder="0.00" value={importe} onChange={e => setImporte(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', paddingRight: 36, background: '#1A2332', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 12, color: '#F1F5F9', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#4B5563', fontSize: 14, fontWeight: 600 }}>€</span>
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: 6 }}>NOTAS</label>
            <textarea placeholder="Observaciones, preferencias..." value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              style={{ width: '100%', padding: '12px 14px', background: '#1A2332', border: '1px solid rgba(148,163,184,0.06)', borderRadius: 12, color: '#F1F5F9', fontSize: 15, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
              <AlertCircle style={{ width: 14, height: 14, color: '#EF4444', flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: '#EF4444', fontSize: 13, lineHeight: 1.4 }}>{error}</p>
            </div>
          )}

          {/* Guardar */}
          <button onClick={guardar} disabled={guardando}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: guardando ? '#15803D' : '#22C55E', color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, opacity: guardando ? 0.7 : 1, transition: 'background 0.2s' }}>
            {guardando ? 'Comprobando y guardando...' : 'Crear cita'}
          </button>
        </div>
      </div>
    </div>
  );
}
