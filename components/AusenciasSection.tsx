'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, Edit2, Trash2, AlertTriangle, Palmtree, Ban } from 'lucide-react';

interface Props {
  empresaId: string;
  isAdmin: boolean;
}

const C = {
  bg: '#0F172A', surface: '#1E293B', surfaceAlt: '#243247',
  green: '#22C55E', yellow: '#F59E0B', orange: '#FB923C', red: '#EF4444',
  text: '#F1F5F9', textSec: '#94A3B8',
};

const TYPE_OPTIONS = [
  { value: 'vacation', label: 'Vacaciones', icon: '🌴' },
  { value: 'sick', label: 'Baja médica', icon: '🏥' },
  { value: 'personal', label: 'Personal', icon: '👤' },
  { value: 'closure', label: 'Cierre empresa', icon: '⛔' },
  { value: 'other', label: 'Otro', icon: '📌' },
];

const STATUS_OPTIONS = [
  { value: 'approved', label: 'Aprobada', color: C.green },
  { value: 'pending', label: 'Pendiente', color: C.yellow },
];

function formatDateES(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTimeES(iso: string, allDay: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (allDay) return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function toInputDate(iso: string): string {
  if (!iso) return '';
  return iso.substring(0, 10);
}

function toInputTime(iso: string): string {
  if (!iso) return '09:00';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AusenciasSection({ empresaId, isAdmin }: Props) {
  const [absences, setAbsences] = useState<any[]>([]);
  const [profesionales, setProfesionales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formScope, setFormScope] = useState<'employee' | 'company'>('employee');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formType, setFormType] = useState('vacation');
  const [formAllDay, setFormAllDay] = useState(true);
  const [formDateStart, setFormDateStart] = useState('');
  const [formDateEnd, setFormDateEnd] = useState('');
  const [formTimeStart, setFormTimeStart] = useState('09:00');
  const [formTimeEnd, setFormTimeEnd] = useState('14:00');
  const [formStatus, setFormStatus] = useState('approved');
  const [formNote, setFormNote] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Affected appointments
  const [affectedCitas, setAffectedCitas] = useState<any[]>([]);
  const [showAffected, setShowAffected] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filter
  const [filterScope, setFilterScope] = useState<'all' | 'employee' | 'company'>('all');

  useEffect(() => {
    if (empresaId) {
      loadAbsences();
      loadProfesionales();
    }
  }, [empresaId]);

  async function loadAbsences() {
    setLoading(true);
    const { data, error } = await supabase
      .from('absences')
      .select('*, profesionales(nombre, color)')
      .eq('empresa_id', empresaId)
      .neq('status', 'rejected')
      .order('start_dt', { ascending: false });
    if (error) console.error('loadAbsences error:', error);
    setAbsences(data || []);
    setLoading(false);
  }

  async function loadProfesionales() {
    const { data } = await supabase
      .from('profesionales')
      .select('id, nombre, color')
      .eq('empresa_id', empresaId)
      .order('nombre');
    setProfesionales(data || []);
    if (data && data.length > 0 && !formEmployeeId) {
      setFormEmployeeId(data[0].id);
    }
  }

  function resetForm() {
    setEditingId(null);
    setFormScope('employee');
    setFormEmployeeId(profesionales[0]?.id || '');
    setFormType('vacation');
    setFormAllDay(true);
    setFormDateStart('');
    setFormDateEnd('');
    setFormTimeStart('09:00');
    setFormTimeEnd('14:00');
    setFormStatus('approved');
    setFormNote('');
    setFormError('');
    setAffectedCitas([]);
    setShowAffected(false);
  }

  function openCreate() {
    resetForm();
    // Set default dates to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.toISOString().substring(0, 10);
    setFormDateStart(tStr);
    setFormDateEnd(tStr);
    setFormOpen(true);
  }

  function openEdit(abs: any) {
    setEditingId(abs.id);
    setFormScope(abs.scope);
    setFormEmployeeId(abs.employee_id || '');
    setFormType(abs.type);
    setFormAllDay(abs.all_day);
    setFormDateStart(toInputDate(abs.start_dt));
    setFormDateEnd(toInputDate(abs.end_dt));
    setFormTimeStart(abs.all_day ? '09:00' : toInputTime(abs.start_dt));
    setFormTimeEnd(abs.all_day ? '14:00' : toInputTime(abs.end_dt));
    setFormStatus(abs.status);
    setFormNote(abs.note || '');
    setFormError('');
    setAffectedCitas([]);
    setShowAffected(false);
    setFormOpen(true);
  }

  function buildDatetimes(): { startDt: string; endDt: string } | null {
    if (!formDateStart || !formDateEnd) {
      setFormError('Selecciona las fechas');
      return null;
    }
    if (formDateEnd < formDateStart) {
      setFormError('La fecha de fin debe ser igual o posterior a la de inicio');
      return null;
    }
    let startDt: string;
    let endDt: string;
    if (formAllDay) {
      startDt = `${formDateStart}T00:00:00`;
      endDt = `${formDateEnd}T23:59:59`;
    } else {
      if (!formTimeStart || !formTimeEnd) {
        setFormError('Selecciona las horas');
        return null;
      }
      startDt = `${formDateStart}T${formTimeStart}:00`;
      endDt = `${formDateEnd}T${formTimeEnd}:00`;
      if (startDt >= endDt) {
        setFormError('La hora de fin debe ser posterior a la de inicio');
        return null;
      }
    }
    return { startDt, endDt };
  }

  async function checkAffectedCitas(startDt: string, endDt: string, scope: string, employeeId: string | null) {
    let q = supabase
      .from('citas')
      .select('*, clientes(nombre), servicios(nombre), profesionales(nombre)')
      .eq('empresa_id', empresaId)
      .lt('hora_inicio', endDt)
      .gt('hora_fin', startDt)
      .neq('estado', 'cancelada');
    if (scope === 'employee' && employeeId) {
      q = q.eq('profesional_id', employeeId);
    }
    const { data } = await q.order('hora_inicio');
    return data || [];
  }

  async function guardar() {
    setFormError('');
    const dts = buildDatetimes();
    if (!dts) return;

    if (formScope === 'employee' && !formEmployeeId) {
      setFormError('Selecciona un profesional');
      return;
    }

    setSaving(true);

    // Check affected appointments
    const affected = await checkAffectedCitas(
      dts.startDt, dts.endDt, formScope, formScope === 'employee' ? formEmployeeId : null
    );

    if (affected.length > 0 && !showAffected) {
      setAffectedCitas(affected);
      setShowAffected(true);
      setSaving(false);
      return;
    }

    const payload = {
      empresa_id: empresaId,
      scope: formScope,
      employee_id: formScope === 'employee' ? formEmployeeId : null,
      start_dt: dts.startDt,
      end_dt: dts.endDt,
      all_day: formAllDay,
      type: formScope === 'company' ? 'closure' : formType,
      status: formStatus,
      note: formNote.trim() || null,
    };

    let error: any;
    if (editingId) {
      ({ error } = await supabase.from('absences').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('absences').insert(payload));
    }

    if (error) {
      setFormError('Error al guardar: ' + error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setFormOpen(false);
    resetForm();
    loadAbsences();
  }

  async function eliminar(id: string) {
    await supabase.from('absences').delete().eq('id', id);
    setDeleteId(null);
    loadAbsences();
  }

  // Filtered absences
  const filtered = absences.filter(a => {
    if (filterScope === 'all') return true;
    return a.scope === filterScope;
  });

  // Group: active (end_dt >= now) vs past
  const now = new Date().toISOString();
  const active = filtered.filter(a => a.end_dt >= now);
  const past = filtered.filter(a => a.end_dt < now);

  return (
    <div style={{ padding: '20px 16px 80px', maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Ausencias</h2>
          <p style={{ fontSize: 13, color: C.textSec, marginTop: 2 }}>Vacaciones, bajas y cierres de empresa</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 10, border: 'none', cursor: 'pointer',
            background: C.green, color: '#fff', fontSize: 13, fontWeight: 600,
          }}>
            <Plus size={16} /> Nueva ausencia
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['all', 'employee', 'company'] as const).map(f => (
          <button key={f} onClick={() => setFilterScope(f)} style={{
            padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: filterScope === f ? 600 : 400,
            background: filterScope === f ? `${C.green}22` : C.surfaceAlt,
            color: filterScope === f ? C.green : C.textSec,
          }}>
            {f === 'all' ? 'Todas' : f === 'employee' ? 'Empleados' : 'Empresa'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <p style={{ color: C.textSec, fontSize: 13 }}>Cargando...</p>}

      {/* Empty state */}
      {!loading && absences.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: C.surface, borderRadius: 16 }}>
          <Palmtree size={40} style={{ color: C.textSec, margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Sin ausencias registradas</p>
          <p style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>Crea tu primera ausencia para gestionar vacaciones y cierres</p>
        </div>
      )}

      {/* Active absences */}
      {active.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textSec, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Activas y futuras ({active.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.map(abs => <AbsenceCard key={abs.id} abs={abs} onEdit={() => openEdit(abs)} onDelete={() => setDeleteId(abs.id)} isAdmin={isAdmin} />)}
          </div>
        </div>
      )}

      {/* Past absences */}
      {past.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textSec, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Pasadas ({past.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.map(abs => <AbsenceCard key={abs.id} abs={abs} onEdit={() => openEdit(abs)} onDelete={() => setDeleteId(abs.id)} isAdmin={isAdmin} dimmed />)}
          </div>
        </div>
      )}

      {/* ─── FORM MODAL ─── */}
      {formOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => { setFormOpen(false); resetForm(); }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{editingId ? 'Editar ausencia' : 'Nueva ausencia'}</h3>
              <button onClick={() => { setFormOpen(false); resetForm(); }} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Scope */}
              <div>
                <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Tipo de ausencia</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setFormScope('employee'); setFormType('vacation'); }} style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${formScope === 'employee' ? C.green : C.surfaceAlt}`,
                    background: formScope === 'employee' ? `${C.green}15` : C.surfaceAlt,
                    color: formScope === 'employee' ? C.green : C.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                  }}>
                    🌴 Empleado
                  </button>
                  <button onClick={() => { setFormScope('company'); setFormType('closure'); }} style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${formScope === 'company' ? C.red : C.surfaceAlt}`,
                    background: formScope === 'company' ? `${C.red}15` : C.surfaceAlt,
                    color: formScope === 'company' ? C.red : C.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                  }}>
                    ⛔ Cierre empresa
                  </button>
                </div>
              </div>

              {/* Employee selector */}
              {formScope === 'employee' && (
                <div>
                  <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Profesional</label>
                  <select value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)} style={{
                    width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12,
                    padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none',
                    appearance: 'none' as const, cursor: 'pointer',
                  }}>
                    {profesionales.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Motivo */}
              {formScope === 'employee' && (
                <div>
                  <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Motivo</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {TYPE_OPTIONS.filter(t => t.value !== 'closure').map(t => (
                      <button key={t.value} onClick={() => setFormType(t.value)} style={{
                        padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${formType === t.value ? C.green : 'rgba(255,255,255,0.08)'}`,
                        background: formType === t.value ? `${C.green}15` : 'rgba(255,255,255,0.03)',
                        color: formType === t.value ? C.green : C.textSec, fontSize: 12, fontWeight: formType === t.value ? 600 : 400, cursor: 'pointer',
                      }}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All day toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setFormAllDay(!formAllDay)} style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: formAllDay ? C.green : C.surfaceAlt, position: 'relative', transition: 'background 0.15s',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3,
                    left: formAllDay ? 21 : 3, transition: 'left 0.15s',
                  }} />
                </button>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>Todo el día</span>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Desde</label>
                  <input type="date" value={formDateStart} onChange={e => { setFormDateStart(e.target.value); if (!formDateEnd || e.target.value > formDateEnd) setFormDateEnd(e.target.value); setShowAffected(false); }} style={{
                    width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12,
                    padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box',
                  }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Hasta</label>
                  <input type="date" value={formDateEnd} onChange={e => { setFormDateEnd(e.target.value); setShowAffected(false); }} min={formDateStart} style={{
                    width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12,
                    padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box',
                  }} />
                </div>
              </div>

              {/* Times (if not all day) */}
              {!formAllDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Hora inicio</label>
                    <input type="time" value={formTimeStart} onChange={e => { setFormTimeStart(e.target.value); setShowAffected(false); }} style={{
                      width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12,
                      padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Hora fin</label>
                    <input type="time" value={formTimeEnd} onChange={e => { setFormTimeEnd(e.target.value); setShowAffected(false); }} style={{
                      width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12,
                      padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }} />
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Estado</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STATUS_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setFormStatus(s.value)} style={{
                      padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${formStatus === s.value ? s.color : 'rgba(255,255,255,0.08)'}`,
                      background: formStatus === s.value ? `${s.color}15` : 'rgba(255,255,255,0.03)',
                      color: formStatus === s.value ? s.color : C.textSec, fontSize: 12, fontWeight: formStatus === s.value ? 600 : 400, cursor: 'pointer',
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label style={{ fontSize: 12, color: C.textSec, display: 'block', marginBottom: 6 }}>Nota (opcional)</label>
                <textarea value={formNote} onChange={e => setFormNote(e.target.value)} rows={2} style={{
                  width: '100%', background: C.surfaceAlt, border: 'none', borderRadius: 12,
                  padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box',
                }} placeholder="Ej: Viaje familiar, recuperación operación..." />
              </div>

              {/* Error */}
              {formError && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: `${C.red}15`, border: `1px solid ${C.red}33`, color: C.red, fontSize: 12, fontWeight: 500 }}>
                  {formError}
                </div>
              )}

              {/* Affected appointments warning */}
              {showAffected && affectedCitas.length > 0 && (
                <div style={{ background: `${C.yellow}10`, border: `1px solid ${C.yellow}33`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <AlertTriangle size={16} style={{ color: C.yellow, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.yellow }}>
                      {affectedCitas.length} cita{affectedCitas.length !== 1 ? 's' : ''} afectada{affectedCitas.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {affectedCitas.map((cita: any) => (
                      <div key={cita.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, fontSize: 12 }}>
                        <span style={{ color: C.text, fontWeight: 600 }}>{cita.clientes?.nombre || 'Cliente'}</span>
                        <span style={{ color: C.textSec }}>·</span>
                        <span style={{ color: C.textSec }}>{new Date(cita.hora_inicio).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                        <span style={{ color: C.textSec }}>{cita.hora_inicio?.substring(11, 16)}</span>
                        <span style={{ color: C.textSec }}>·</span>
                        <span style={{ color: C.textSec }}>{cita.servicios?.nombre || cita.servicio_nombre_libre || ''}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: C.textSec, marginTop: 8 }}>
                    Estas citas se marcarán como conflicto en el calendario. Podrás reubicarlas después.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => { setFormOpen(false); resetForm(); }} style={{
                  flex: 1, padding: '10px 0', borderRadius: 12, border: `1px solid ${C.surfaceAlt}`,
                  background: 'transparent', color: C.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  Cancelar
                </button>
                <button onClick={guardar} disabled={saving} style={{
                  flex: 2, padding: '10px 0', borderRadius: 12, border: 'none',
                  background: showAffected && affectedCitas.length > 0 ? C.yellow : C.green,
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}>
                  {saving ? 'Guardando...' : showAffected && affectedCitas.length > 0 ? `Guardar igualmente (${affectedCitas.length} conflictos)` : editingId ? 'Guardar cambios' : 'Crear ausencia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM ─── */}
      {deleteId && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setDeleteId(null)}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Trash2 size={32} style={{ color: C.red, margin: '0 auto 8px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Eliminar ausencia</h3>
              <p style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>Las citas que estaban en conflicto volverán a su estado normal automáticamente.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{
                flex: 1, padding: '10px 0', borderRadius: 12, border: `1px solid ${C.surfaceAlt}`,
                background: 'transparent', color: C.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Cancelar
              </button>
              <button onClick={() => eliminar(deleteId)} style={{
                flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
                background: C.red, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AbsenceCard component ───
function AbsenceCard({ abs, onEdit, onDelete, isAdmin, dimmed }: { abs: any; onEdit: () => void; onDelete: () => void; isAdmin: boolean; dimmed?: boolean }) {
  const isCompany = abs.scope === 'company';
  const accentColor = isCompany ? C.red : C.yellow;
  const typeLabels: Record<string, string> = { vacation: 'Vacaciones', sick: 'Baja médica', personal: 'Personal', closure: 'Cierre empresa', other: 'Otro' };
  const typeIcons: Record<string, string> = { vacation: '🌴', sick: '🏥', personal: '👤', closure: '⛔', other: '📌' };

  return (
    <div style={{
      background: C.surface, borderRadius: 12, padding: '14px 16px',
      borderLeft: `3px solid ${accentColor}`,
      opacity: dimmed ? 0.55 : 1,
      transition: 'opacity 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Type + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14 }}>{typeIcons[abs.type] || '📌'}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              {isCompany ? 'Cierre empresa' : (abs.profesionales?.nombre || 'Empleado')}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 10,
              background: `${accentColor}18`, color: accentColor,
            }}>
              {typeLabels[abs.type] || abs.type}
            </span>
            {abs.status === 'pending' && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 10, background: `${C.yellow}18`, color: C.yellow }}>
                Pendiente
              </span>
            )}
          </div>
          {/* Dates */}
          <p style={{ fontSize: 12, color: C.textSec }}>
            {formatDateTimeES(abs.start_dt, abs.all_day)} → {formatDateTimeES(abs.end_dt, abs.all_day)}
            {abs.all_day && <span style={{ marginLeft: 6, fontSize: 10, color: C.textSec, opacity: 0.7 }}>· Todo el día</span>}
          </p>
          {/* Note */}
          {abs.note && <p style={{ fontSize: 12, color: C.textSec, marginTop: 4, fontStyle: 'italic' }}>"{abs.note}"</p>}
        </div>
        {/* Actions */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={onEdit} style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: C.surfaceAlt, color: C.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Edit2 size={13} />
            </button>
            <button onClick={onDelete} style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: `${C.red}15`, color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
