'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, X, Phone, Mail, FileText, ChevronRight, ArrowLeft, Trash2, Edit2, Check, Calendar, TrendingUp, XCircle, AlertTriangle, Clock, Star } from 'lucide-react';

const C = {
  bg: '#0F172A', surface: '#1E293B', surfaceAlt: '#243247',
  green: '#22C55E', greenBg: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redBg: 'rgba(239,68,68,0.1)',
  amber: '#F59E0B', amberBg: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6', blueBg: 'rgba(59,130,246,0.12)',
  purple: '#A855F7', purpleBg: 'rgba(168,85,247,0.12)',
  text: '#F1F5F9', textSec: '#94A3B8', border: 'rgba(148,163,184,0.1)',
};

interface Cliente {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  notas?: string;
  created_at?: string;
}

interface FormCliente {
  nombre: string;
  telefono: string;
  email: string;
  notas: string;
}

// ─── MODAL FUERA DEL COMPONENTE PRINCIPAL (evita re-render en cada tecla) ───
interface ModalClienteProps {
  editando: boolean;
  form: FormCliente;
  setForm: React.Dispatch<React.SetStateAction<FormCliente>>;
  guardando: boolean;
  error: string;
  onGuardar: () => void;
  onCerrar: () => void;
}

function ModalCliente({ editando, form, setForm, guardando, error, onGuardar, onCerrar }: ModalClienteProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCerrar}
    >
      <div
        style={{ background: C.surface, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 500, paddingBottom: 32 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editando ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: C.textSec, fontWeight: 600, display: 'block', marginBottom: 6 }}>NOMBRE *</label>
            <input
              type="text"
              placeholder="Nombre del cliente"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              style={{ width: '100%', padding: '12px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.textSec, fontWeight: 600, display: 'block', marginBottom: 6 }}>TELÉFONO</label>
            <input
              type="tel"
              placeholder="600 000 000"
              value={form.telefono}
              onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
              style={{ width: '100%', padding: '12px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.textSec, fontWeight: 600, display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input
              type="email"
              placeholder="email@ejemplo.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%', padding: '12px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.textSec, fontWeight: 600, display: 'block', marginBottom: 6 }}>NOTAS</label>
            <textarea
              placeholder="Alergias, preferencias, observaciones..."
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '12px 14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 15, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {error && <p style={{ color: C.red, fontSize: 13 }}>{error}</p>}

          <button
            onClick={onGuardar}
            disabled={guardando}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: C.green, color: '#fff', cursor: guardando ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 700, opacity: guardando ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {guardando ? 'Guardando...' : (<><Check className="w-4 h-4" />{editando ? 'Guardar cambios' : 'Crear cliente'}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TARJETA DE ESTADÍSTICA ───
function StatCard({ icon, label, value, color, colorBg }: { icon: React.ReactNode; label: string; value: string | number; color: string; colorBg: string }) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${C.border}` }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: colorBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{value}</p>
        <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500 }}>{label}</p>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ───
interface ClientesSectionProps {
  empresaId: string;
}

export default function ClientesSection({ empresaId }: ClientesSectionProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [vistaDetalle, setVistaDetalle] = useState<Cliente | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historialCitas, setHistorialCitas] = useState<any[]>([]);
  const [loadingCitas, setLoadingCitas] = useState(false);

  const [form, setForm] = useState<FormCliente>({
    nombre: '',
    telefono: '',
    email: '',
    notas: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // ─── ESTADÍSTICAS CALCULADAS ───
  const stats = useMemo(() => {
    if (historialCitas.length === 0) return null;

    const confirmadas = historialCitas.filter(c => c.estado === 'confirmada' || c.estado === 'completada');
    const canceladas = historialCitas.filter(c => c.estado === 'cancelada');
    const noShows = historialCitas.filter(c => c.estado === 'no-show' || c.estado === 'no_show');

    // Última visita (la cita confirmada más reciente en el pasado)
    const ahora = new Date();
    const pasadas = confirmadas.filter(c => new Date(c.hora_inicio) <= ahora);
    const ultimaVisita = pasadas.length > 0 ? pasadas[0].hora_inicio : null; // ya están ordenadas desc

    // Servicio más frecuente
    const conteoServicios: Record<string, number> = {};
    historialCitas.forEach(c => {
      const nombre = c.servicios?.nombre || c.servicio_nombre_libre;
      if (nombre) conteoServicios[nombre] = (conteoServicios[nombre] || 0) + 1;
    });
    const servicioTop = Object.entries(conteoServicios).sort((a, b) => b[1] - a[1])[0];

    return {
      totalVisitas: confirmadas.length,
      cancelaciones: canceladas.length,
      noShows: noShows.length,
      ultimaVisita,
      servicioTop: servicioTop ? { nombre: servicioTop[0], veces: servicioTop[1] } : null,
      totalCitas: historialCitas.length,
    };
  }, [historialCitas]);

  useEffect(() => {
    if (empresaId) cargarClientes();
  }, [empresaId]);

  useEffect(() => {
    if (vistaDetalle) cargarHistorialCitas(vistaDetalle.id);
  }, [vistaDetalle]);

  async function cargarClientes() {
    setLoading(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nombre');
    if (!error) setClientes(data || []);
    setLoading(false);
  }

  async function cargarHistorialCitas(clienteId: string) {
    setLoadingCitas(true);
    const { data } = await supabase
      .from('citas')
      .select('*, servicios(nombre)')
      .eq('cliente_id', clienteId)
      .order('hora_inicio', { ascending: false })
      .limit(100);
    setHistorialCitas(data || []);
    setLoadingCitas(false);
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.telefono || '').includes(busqueda) ||
    (c.email || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  function abrirNuevoCliente() {
    setForm({ nombre: '', telefono: '', email: '', notas: '' });
    setError('');
    setEditando(false);
    setModalAbierto(true);
  }

  function abrirEditarCliente(cliente: Cliente) {
    setForm({
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      notas: cliente.notas || '',
    });
    setError('');
    setEditando(true);
    setModalAbierto(true);
  }

  async function guardarCliente() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setGuardando(true);
    setError('');

    if (editando && vistaDetalle) {
      const { error } = await supabase
        .from('clientes')
        .update({
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim() || null,
          email: form.email.trim() || null,
          notas: form.notas.trim() || null,
        })
        .eq('id', vistaDetalle.id);

      if (error) { setError('Error al guardar'); setGuardando(false); return; }
      setVistaDetalle(prev => prev ? { ...prev, ...form } : prev);
    } else {
      const { error } = await supabase
        .from('clientes')
        .insert({
          empresa_id: empresaId,
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim() || null,
          email: form.email.trim() || null,
          notas: form.notas.trim() || null,
        });

      if (error) { setError('Error al guardar'); setGuardando(false); return; }
    }

    await cargarClientes();
    setModalAbierto(false);
    setGuardando(false);
  }

  async function eliminarCliente() {
    if (!vistaDetalle) return;
    const { error } = await supabase.from('clientes').delete().eq('id', vistaDetalle.id);
    if (!error) {
      await cargarClientes();
      setVistaDetalle(null);
      setConfirmDelete(false);
    }
  }

  function formatFecha(s?: string) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatFechaCorta(s?: string) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  function estadoColor(estado: string) {
    if (estado === 'cancelada') return C.textSec;
    if (estado === 'pendiente') return C.amber;
    if (estado === 'no-show' || estado === 'no_show') return C.red;
    return C.green;
  }

  function estadoLabel(estado: string) {
    if (estado === 'no-show' || estado === 'no_show') return 'No-show';
    return estado;
  }

  // ─── VISTA DETALLE ───
  if (vistaDetalle) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
        {/* HEADER */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => { setVistaDetalle(null); setConfirmDelete(false); }}
            style={{ color: C.textSec, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: C.green, flexShrink: 0 }}>
            {vistaDetalle.nombre[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{vistaDetalle.nombre}</h2>
            <p style={{ fontSize: 12, color: C.textSec }}>Cliente desde {formatFecha(vistaDetalle.created_at)}</p>
          </div>
          <button
            onClick={() => abrirEditarCliente(vistaDetalle)}
            style={{ color: C.green, background: C.greenBg, border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Edit2 className="w-4 h-4" /> Editar
          </button>
        </div>

        <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>

          {/* ─── ESTADÍSTICAS ─── */}
          {loadingCitas ? (
            <div style={{ background: C.surface, borderRadius: 16, padding: 20, marginBottom: 16, textAlign: 'center' }}>
              <p style={{ color: C.textSec, fontSize: 14 }}>Cargando estadísticas...</p>
            </div>
          ) : stats ? (
            <div style={{ marginBottom: 16 }}>
              {/* Grid 2x2 de stats principales */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <StatCard
                  icon={<Calendar className="w-5 h-5" style={{ color: C.green }} />}
                  label="Visitas"
                  value={stats.totalVisitas}
                  color={C.green}
                  colorBg={C.greenBg}
                />
                <StatCard
                  icon={<XCircle className="w-5 h-5" style={{ color: C.textSec }} />}
                  label="Cancelaciones"
                  value={stats.cancelaciones}
                  color={C.textSec}
                  colorBg={C.surfaceAlt}
                />
                <StatCard
                  icon={<AlertTriangle className="w-5 h-5" style={{ color: C.red }} />}
                  label="No-shows"
                  value={stats.noShows}
                  color={C.red}
                  colorBg={C.redBg}
                />
                <StatCard
                  icon={<Clock className="w-5 h-5" style={{ color: C.blue }} />}
                  label="Última visita"
                  value={stats.ultimaVisita ? formatFechaCorta(stats.ultimaVisita) : '—'}
                  color={C.blue}
                  colorBg={C.blueBg}
                />
              </div>

              {/* Servicio favorito (tarjeta ancha) */}
              {stats.servicioTop && (
                <div style={{ background: C.surface, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${C.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: C.purpleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Star className="w-5 h-5" style={{ color: C.purple }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stats.servicioTop.nombre}</p>
                    <p style={{ fontSize: 11, color: C.textSec, fontWeight: 500 }}>Servicio favorito · {stats.servicioTop.veces} {stats.servicioTop.veces === 1 ? 'vez' : 'veces'}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: C.surface, borderRadius: 16, padding: 20, marginBottom: 16, textAlign: 'center' }}>
              <p style={{ color: C.textSec, fontSize: 14 }}>Sin citas registradas aún</p>
            </div>
          )}

          {/* ─── CONTACTO ─── */}
          <div style={{ background: C.surface, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.8 }}>Contacto</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {vistaDetalle.telefono ? (
                <a href={`tel:${vistaDetalle.telefono}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: C.text }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Phone className="w-4 h-4" style={{ color: C.green }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600 }}>{vistaDetalle.telefono}</p>
                    <p style={{ fontSize: 11, color: C.textSec }}>Teléfono</p>
                  </div>
                </a>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Phone className="w-4 h-4" style={{ color: C.textSec }} />
                  </div>
                  <p style={{ fontSize: 14, color: C.textSec }}>Sin teléfono</p>
                </div>
              )}

              {vistaDetalle.email ? (
                <a href={`mailto:${vistaDetalle.email}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: C.text }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail className="w-4 h-4" style={{ color: C.green }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600 }}>{vistaDetalle.email}</p>
                    <p style={{ fontSize: 11, color: C.textSec }}>Email</p>
                  </div>
                </a>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail className="w-4 h-4" style={{ color: C.textSec }} />
                  </div>
                  <p style={{ fontSize: 14, color: C.textSec }}>Sin email</p>
                </div>
              )}

              {vistaDetalle.notas && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText className="w-4 h-4" style={{ color: C.textSec }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14 }}>{vistaDetalle.notas}</p>
                    <p style={{ fontSize: 11, color: C.textSec }}>Notas</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── HISTORIAL DE CITAS ─── */}
          <div style={{ background: C.surface, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8 }}>Historial de citas</h3>
              {historialCitas.length > 0 && (
                <span style={{ fontSize: 12, color: C.textSec, background: C.surfaceAlt, padding: '3px 10px', borderRadius: 8 }}>
                  {historialCitas.length} total
                </span>
              )}
            </div>
            {loadingCitas ? (
              <p style={{ color: C.textSec, fontSize: 14 }}>Cargando...</p>
            ) : historialCitas.length === 0 ? (
              <p style={{ color: C.textSec, fontSize: 14 }}>Sin citas registradas</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {historialCitas.map(cita => (
                  <div key={cita.id} style={{ background: C.surfaceAlt, borderRadius: 12, padding: '12px 14px', borderLeft: `3px solid ${estadoColor(cita.estado)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{cita.servicios?.nombre || cita.servicio_nombre_libre || 'Servicio'}</p>
                      <p style={{ fontSize: 12, color: C.textSec }}>{formatFecha(cita.hora_inicio)} · {cita.hora_inicio?.substring(11, 16)}</p>
                    </div>
                    <span style={{ fontSize: 11, color: estadoColor(cita.estado), fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                      {estadoLabel(cita.estado)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── ELIMINAR ─── */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${C.red}`, background: 'transparent', color: C.red, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Trash2 className="w-4 h-4" /> Eliminar cliente
            </button>
          ) : (
            <div style={{ background: C.redBg, borderRadius: 12, padding: 16, border: `1px solid ${C.red}` }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>¿Eliminar a {vistaDetalle.nombre}?</p>
              <p style={{ fontSize: 12, color: C.textSec, marginBottom: 14 }}>Esta acción no se puede deshacer.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: C.surfaceAlt, color: C.text, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                <button onClick={eliminarCliente} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: C.red, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Sí, eliminar</button>
              </div>
            </div>
          )}
        </div>

        {modalAbierto && (
          <ModalCliente
            editando={editando}
            form={form}
            setForm={setForm}
            guardando={guardando}
            error={error}
            onGuardar={guardarCliente}
            onCerrar={() => setModalAbierto(false)}
          />
        )}
      </div>
    );
  }

  // ─── VISTA LISTA ───
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Clientes</h2>
          <button
            onClick={abrirNuevoCliente}
            style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <Search className="w-4 h-4" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textSec }} />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textSec }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 16px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textSec }}>Cargando clientes...</div>
        ) : clientesFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p style={{ color: C.textSec, fontSize: 15 }}>
              {busqueda ? 'No hay resultados para esa búsqueda' : 'Aún no tienes clientes'}
            </p>
            {!busqueda && (
              <button
                onClick={abrirNuevoCliente}
                style={{ marginTop: 16, background: C.green, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Añadir primer cliente
              </button>
            )}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>
              {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clientesFiltrados.map(cliente => (
                <button
                  key={cliente.id}
                  onClick={() => setVistaDetalle(cliente)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.surface)}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: C.green, flexShrink: 0 }}>
                    {cliente.nombre[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{cliente.nombre}</p>
                    <p style={{ fontSize: 12, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cliente.telefono || cliente.email || 'Sin contacto'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: C.textSec, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {modalAbierto && (
        <ModalCliente
          editando={editando}
          form={form}
          setForm={setForm}
          guardando={guardando}
          error={error}
          onGuardar={guardarCliente}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  );
}
