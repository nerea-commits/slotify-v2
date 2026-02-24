'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  profesionalId: string;
  empresaId: string;
  selectedDate: Date;
  preselectedTime?: string;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const mo = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${y}-${mo}-${dd}`;
}

export default function NuevaCitaModal({
  open, onClose, onCreated, profesionalId, empresaId, selectedDate, preselectedTime,
}: Props) {
  const [clienteQuery, setClienteQuery] = useState('');
  const [clientesSugeridos, setClientesSugeridos] = useState<any[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [servicioQuery, setServicioQuery] = useState('');
  const [serviciosSugeridos, setServiciosSugeridos] = useState<any[]>([]);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<any>(null);
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('09:30');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modoNuevoCliente, setModoNuevoCliente] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('');
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState('');
  const [noEnviarMensaje, setNoEnviarMensaje] = useState(false);

  useEffect(() => {
    if (!open) {
      setClienteQuery(''); setClientesSugeridos([]); setClienteSeleccionado(null);
      setServicioQuery(''); setServiciosSugeridos([]); setServicioSeleccionado(null);
      setHoraInicio('09:00'); setHoraFin('09:30');
      setNotas(''); setError('');
      setModoNuevoCliente(false); setNuevoClienteNombre(''); setNuevoClienteTelefono('');
      setNoEnviarMensaje(false);
    } else if (preselectedTime) {
      setHoraInicio(preselectedTime);
      const [h, m] = preselectedTime.split(':').map(Number);
      const totalMin = h * 60 + m + 30;
      setHoraFin(`${Math.floor(totalMin / 60).toString().padStart(2, '0')}:${(totalMin % 60).toString().padStart(2, '0')}`);
    }
  }, [open, preselectedTime]);

  async function buscarClientes(q: string) {
    setClienteQuery(q);
    if (q.length < 2) { setClientesSugeridos([]); return; }
    const eid = empresaId || localStorage.getItem('slotify_empresa_id') || '';
    let query = supabase.from('clientes').select('*').or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`).limit(5);
    if (eid) query = query.eq('empresa_id', eid);
    const { data } = await query;
    setClientesSugeridos(data || []);
  }

  async function buscarServicios(q: string) {
    setServicioQuery(q); setServicioSeleccionado(null);
    if (q.length < 1) { setServiciosSugeridos([]); return; }
    const eid = empresaId || localStorage.getItem('slotify_empresa_id') || '';
    let query = supabase.from('servicios').select('*').ilike('nombre', `%${q}%`).limit(5);
    if (eid) query = query.eq('empresa_id', eid);
    const { data } = await query;
    setServiciosSugeridos(data || []);
  }

  function seleccionarServicio(s: any) {
    setServicioSeleccionado(s); setServicioQuery(s.nombre); setServiciosSugeridos([]);
    if (s.duracion_minutos) {
      const [h, m] = horaInicio.split(':').map(Number);
      const totalMin = h * 60 + m + s.duracion_minutos;
      setHoraFin(`${Math.floor(totalMin / 60).toString().padStart(2, '0')}:${(totalMin % 60).toString().padStart(2, '0')}`);
    }
  }

  async function guardar() {
    setError('');
    if (!clienteSeleccionado && !modoNuevoCliente) { setError('Selecciona o crea un cliente'); return; }
    if (modoNuevoCliente && !nuevoClienteNombre.trim()) { setError('Escribe el nombre del cliente'); return; }
    if (modoNuevoCliente && !nuevoClienteTelefono.trim()) { setError('El teléfono es obligatorio'); return; }
    if (!horaInicio || !horaFin) { setError('Indica hora de inicio y fin'); return; }

    setLoading(true);
    try {
      const dateStr = toLocalDateStr(selectedDate);
      const horaInicioFull = `${dateStr}T${horaInicio}:00`;
      const horaFinFull = `${dateStr}T${horaFin}:00`;

      let realEmpresaId = empresaId || localStorage.getItem('slotify_empresa_id') || '';
      if (!realEmpresaId) {
        const { data: emp } = await supabase.from('empresas').select('id').limit(1).single();
        if (emp) realEmpresaId = emp.id;
      }
      const realProfesionalId = profesionalId || localStorage.getItem('slotify_profesional_id') || '';

      let clienteId = clienteSeleccionado?.id;
      if (modoNuevoCliente) {
        const ins: any = { nombre: nuevoClienteNombre, telefono: nuevoClienteTelefono };
        if (realEmpresaId) ins.empresa_id = realEmpresaId;
        const { data: nc, error: ec } = await supabase.from('clientes').insert(ins).select().single();
        if (ec) throw ec;
        clienteId = nc.id;
      }

      const citaData: any = {
        hora_inicio: horaInicioFull,
        hora_fin: horaFinFull,
        estado: 'confirmada',
        notas: notas || null,
        enviar_notificacion: !noEnviarMensaje,
      };
      if (realEmpresaId) citaData.empresa_id = realEmpresaId;
      if (realProfesionalId) citaData.profesional_id = realProfesionalId;
      if (clienteId) citaData.cliente_id = clienteId;

      if (servicioSeleccionado?.id) {
        citaData.servicio_id = servicioSeleccionado.id;
        citaData.servicio_nombre_libre = servicioSeleccionado.nombre;
      } else if (servicioQuery.trim()) {
        citaData.servicio_id = null;
        citaData.servicio_nombre_libre = servicioQuery.trim();
      }

      const { error: errCita } = await supabase.from('citas').insert(citaData);
      if (errCita) throw errCita;
      onCreated();
    } catch (e: any) {
      console.error('Error guardando cita:', e);
      setError(e.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold">Nueva cita</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              {preselectedTime ? ` · ${preselectedTime}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cliente */}
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Cliente</label>
            {!modoNuevoCliente ? (
              <>
                <input
                  className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Buscar por nombre o teléfono..."
                  value={clienteSeleccionado ? clienteSeleccionado.nombre : clienteQuery}
                  onChange={e => { setClienteSeleccionado(null); buscarClientes(e.target.value); }}
                />
                {clientesSugeridos.length > 0 && (
                  <div className="mt-1 bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                    {clientesSugeridos.map(c => (
                      <button key={c.id} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 border-b border-gray-700 last:border-0"
                        onClick={() => { setClienteSeleccionado(c); setClienteQuery(c.nombre); setClientesSugeridos([]); }}>
                        <span className="font-medium">{c.nombre}</span>
                        {c.telefono && <span className="text-gray-400 ml-2">· {c.telefono}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <button className="text-xs text-green-400 mt-2 hover:underline" onClick={() => setModoNuevoCliente(true)}>
                  + Crear cliente nuevo
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Nombre del cliente" value={nuevoClienteNombre}
                  onChange={e => setNuevoClienteNombre(e.target.value)} />
                <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Teléfono *" value={nuevoClienteTelefono}
                  onChange={e => setNuevoClienteTelefono(e.target.value)} />
                <button className="text-xs text-gray-400 hover:underline" onClick={() => setModoNuevoCliente(false)}>
                  ← Buscar cliente existente
                </button>
              </div>
            )}
          </div>

          {/* Servicio */}
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Servicio</label>
            <input
              className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Escribe o busca un servicio..."
              value={servicioQuery}
              onChange={e => buscarServicios(e.target.value)}
            />
            {serviciosSugeridos.length > 0 && (
              <div className="mt-1 bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                {serviciosSugeridos.map(s => (
                  <button key={s.id} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 border-b border-gray-700 last:border-0"
                    onClick={() => seleccionarServicio(s)}>
                    <span className="font-medium">{s.nombre}</span>
                    {s.duracion_minutos && <span className="text-gray-400"> · {s.duracion_minutos}min</span>}
                    {s.precio && <span className="text-gray-400"> · {s.precio}€</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Horas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Hora inicio</label>
              <input type="time" className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Hora fin</label>
              <input type="time" className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                value={horaFin} onChange={e => setHoraFin(e.target.value)} />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Observaciones (opcional)</label>
            <textarea className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none"
              rows={2} placeholder="Alergias, preferencias, notas..."
              value={notas} onChange={e => setNotas(e.target.value)} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={noEnviarMensaje} onChange={e => setNoEnviarMensaje(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500" />
            <span className="text-sm text-gray-400">No enviar recordatorio por WhatsApp</span>
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={guardar} disabled={loading}
            className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors">
            {loading ? 'Guardando...' : 'Crear cita'}
          </button>
        </div>
      </div>
    </div>
  );
}
