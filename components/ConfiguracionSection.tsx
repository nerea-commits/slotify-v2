'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Building2, Clock, Calendar, Users, Check, X, AlertTriangle,
  Plus, Trash2, RefreshCw, Shield, UserCircle, Mail, ChevronDown, ChevronUp, Upload
} from 'lucide-react';

const C = {
  bg: '#0B0F1A', panel: '#111827', panelAlt: '#1A2332',
  green: '#22C55E', greenDim: 'rgba(34,197,94,0.1)',
  red: '#EF4444', redDim: 'rgba(239,68,68,0.08)',
  amber: '#F59E0B',
  text: '#F1F5F9', textMid: '#94A3B8', textDim: '#4B5563',
  border: 'rgba(148,163,184,0.08)',
  borderHover: 'rgba(148,163,184,0.18)',
};

const TABS = [
  { id: 'empresa',   label: 'Empresa',        icon: Building2 },
  { id: 'horario',   label: 'Horario',         icon: Clock     },
  { id: 'dias',      label: 'Días laborables', icon: Calendar  },
  { id: 'empleados', label: 'Empleados',       icon: Users     },
];

const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DIAS_IDX    = [1, 2, 3, 4, 5, 6, 0]; // JS getDay() values

const TIMEZONES = [
  'Europe/Madrid','Europe/London','Europe/Paris','Europe/Berlin',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Bogota','America/Lima','America/Santiago','America/Buenos_Aires',
  'Asia/Tokyo','Asia/Shanghai','Australia/Sydney',
];

const MONEDAS = [
  { code:'EUR', label:'€ Euro' },
  { code:'USD', label:'$ Dólar' },
  { code:'GBP', label:'£ Libra' },
  { code:'MXN', label:'$ Peso MX' },
  { code:'COP', label:'$ Peso CO' },
  { code:'CLP', label:'$ Peso CL' },
  { code:'ARS', label:'$ Peso AR' },
];

const BUFFERS = [0, 5, 10, 15];
const DURACIONES_DEF = [15, 20, 30, 45, 60, 90, 120];

// ── Helpers ────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase', marginBottom:7 }}>{children}</p>;
}

function Field({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {children}
      {hint && <p style={{ fontSize:11, color: C.textDim, lineHeight:1.5 }}>{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled}
      style={{ width:'100%', padding:'11px 13px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:10, color: disabled ? C.textDim : C.text, fontSize:14, outline:'none', boxSizing:'border-box' as const, opacity: disabled ? 0.6 : 1 }}
      onFocus={e => { (e.target as HTMLElement).style.borderColor = C.green + '55'; }}
      onBlur={e => { (e.target as HTMLElement).style.borderColor = C.border; }}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ position:'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width:'100%', padding:'11px 36px 11px 13px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:10, color: C.text, fontSize:14, outline:'none', boxSizing:'border-box' as const, appearance:'none' as const }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color: C.textDim, pointerEvents:'none' }}/>
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="time" value={value} onChange={e => onChange(e.target.value)}
      style={{ width:'100%', padding:'11px 13px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:10, color: C.text, fontSize:14, outline:'none', boxSizing:'border-box' as const }}
      onFocus={e => { (e.target as HTMLElement).style.borderColor = C.green + '55'; }}
      onBlur={e => { (e.target as HTMLElement).style.borderColor = C.border; }}
    />
  );
}

function SaveBtn({ onClick, loading, disabled }: { onClick: () => void; loading: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 20px', borderRadius:10, border:'none', background: disabled ? C.panelAlt : C.green, color: disabled ? C.textDim : '#fff', cursor: disabled ? 'default' : 'pointer', fontSize:13, fontWeight:700, transition:'all 0.15s' }}>
      {loading ? <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> : <Check size={14}/>}
      {loading ? 'Guardando...' : 'Guardar'}
    </button>
  );
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position:'fixed', bottom:88, left:'50%', transform:'translateX(-50%)', background:'#1E293B', border:`1px solid ${C.green}44`, borderRadius:12, padding:'11px 18px', zIndex:80, display:'flex', alignItems:'center', gap:10, boxShadow:'0 4px 20px rgba(0,0,0,0.5)', whiteSpace:'nowrap' }}>
      <Check size={15} style={{ color: C.green }}/>
      <p style={{ fontSize:13, color: C.text, fontWeight:500 }}>{msg}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// TAB: EMPRESA
// ══════════════════════════════════════════════════════
function TabEmpresa({ empresa, onSaved }: { empresa: any; onSaved: (data: any) => void }) {
  const [nombre, setNombre] = useState(empresa?.nombre || '');
  const [telefono, setTelefono] = useState(empresa?.telefono || '');
  const [email, setEmail] = useState(empresa?.email || '');
  const [direccion, setDireccion] = useState(empresa?.direccion || '');
  const [colorPrimario, setColorPrimario] = useState(empresa?.color_primario || '#22C55E');
  const [timezone, setTimezone] = useState(empresa?.timezone || 'Europe/Madrid');
  const [moneda, setMoneda] = useState(empresa?.moneda || 'EUR');
  const [mostrarImporte, setMostrarImporte] = useState(empresa?.mostrar_importe || false);
  const [logoUrl, setLogoUrl] = useState(empresa?.logo_url || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.from('empresas').update({
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      direccion: direccion.trim() || null,
      color_primario: colorPrimario,
      timezone, moneda,
      mostrar_importe: mostrarImporte,
      logo_url: logoUrl.trim() || null,
    }).eq('id', empresa.id);
    setLoading(false);
    if (err) { setError('Error al guardar'); return; }
    onSaved({ nombre, color_primario: colorPrimario, logo_url: logoUrl });
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      <Field><Label>Nombre de la empresa *</Label><Input value={nombre} onChange={setNombre} placeholder="Mi negocio"/></Field>

      {/* Logo */}
      <Field hint="URL de imagen o sube directamente. Recomendado: PNG cuadrado 200×200px.">
        <Label>Logo (URL)</Label>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <div style={{ flex:1 }}><Input value={logoUrl} onChange={setLogoUrl} placeholder="https://..." /></div>
          {logoUrl && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <img src={logoUrl} alt="logo" style={{ width:44, height:44, borderRadius:8, objectFit:'cover', background: C.panelAlt }} onError={e => { (e.target as HTMLImageElement).style.display='none'; }}/>
              <button onClick={() => setLogoUrl('')} style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, fontSize:10 }}>Quitar</button>
            </div>
          )}
        </div>
      </Field>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Field><Label>Teléfono</Label><Input value={telefono} onChange={setTelefono} placeholder="+34 600 000 000" type="tel"/></Field>
        <Field><Label>Email</Label><Input value={email} onChange={setEmail} placeholder="contacto@empresa.com" type="email"/></Field>
      </div>

      <Field><Label>Dirección</Label><Input value={direccion} onChange={setDireccion} placeholder="Calle, ciudad..."/></Field>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Field>
          <Label>Zona horaria</Label>
          <Select value={timezone} onChange={setTimezone} options={TIMEZONES.map(t => ({ value:t, label:t.replace('_',' ') }))}/>
        </Field>
        <Field>
          <Label>Moneda</Label>
          <Select value={moneda} onChange={setMoneda} options={MONEDAS.map(m => ({ value:m.code, label:m.label }))}/>
        </Field>
      </div>

      {/* Color primario */}
      <Field hint="Color de acento en la interfaz.">
        <Label>Color primario</Label>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <input type="color" value={colorPrimario} onChange={e => setColorPrimario(e.target.value)}
            style={{ width:44, height:36, borderRadius:8, border:`1px solid ${C.border}`, background:'none', cursor:'pointer', padding:2 }}/>
          <Input value={colorPrimario} onChange={setColorPrimario} placeholder="#22C55E"/>
        </div>
      </Field>

      {/* Mostrar importe */}
      <label style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background: C.panelAlt, borderRadius:10, cursor:'pointer' }}>
        <input type="checkbox" checked={mostrarImporte} onChange={e => setMostrarImporte(e.target.checked)}
          style={{ width:16, height:16, accentColor: C.green }}/>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color: C.text }}>Mostrar importe en citas</p>
          <p style={{ fontSize:11, color: C.textDim }}>Activa el campo de precio al crear citas</p>
        </div>
      </label>

      {error && <p style={{ color: C.red, fontSize:13 }}>{error}</p>}
      <SaveBtn onClick={save} loading={loading}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// TAB: HORARIO
// ══════════════════════════════════════════════════════
function TabHorario({ empresa, onSaved }: { empresa: any; onSaved: (data: any) => void }) {
  const [inicio, setInicio] = useState(empresa?.horario_inicio || '09:00');
  const [fin, setFin] = useState(empresa?.horario_fin || '19:00');
  const [pausaActiva, setPausaActiva] = useState(empresa?.pausa_activa || false);
  const [pausaInicio, setPausaInicio] = useState(empresa?.horario_pausa_inicio || '14:00');
  const [pausaFin, setPausaFin] = useState(empresa?.horario_pausa_fin || '16:00');
  const [buffer, setBuffer] = useState(empresa?.buffer_minutos ?? 0);
  const [durDef, setDurDef] = useState(empresa?.duracion_defecto ?? 60);
  const [excepciones, setExcepciones] = useState<string[]>(empresa?.dias_excepciones || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newExc, setNewExc] = useState('');

  function validate(): string | null {
    if (inicio >= fin) return 'La hora de apertura debe ser anterior al cierre';
    if (pausaActiva && pausaInicio >= pausaFin) return 'El inicio de la pausa debe ser anterior al fin';
    if (pausaActiva && (pausaInicio <= inicio || pausaFin >= fin)) return 'La pausa debe estar dentro del horario de apertura';
    return null;
  }

  async function save() {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true); setError('');
    const { error: e } = await supabase.from('empresas').update({
      horario_inicio: inicio,
      horario_fin: fin,
      pausa_activa: pausaActiva,
      horario_pausa_inicio: pausaActiva ? pausaInicio : null,
      horario_pausa_fin: pausaActiva ? pausaFin : null,
      buffer_minutos: buffer,
      duracion_defecto: durDef,
      dias_excepciones: excepciones,
    }).eq('id', empresa.id);
    setLoading(false);
    if (e) { setError('Error al guardar'); return; }
    onSaved({ horario_inicio: inicio, horario_fin: fin });
  }

  function addExcepcion() {
    if (!newExc || excepciones.includes(newExc)) return;
    setExcepciones(prev => [...prev].concat(newExc).sort());
    setNewExc('');
  }

  function removeExcepcion(d: string) {
    setExcepciones(prev => prev.filter(x => x !== d));
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Apertura / Cierre */}
      <div>
        <Label>Horario de trabajo</Label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field><p style={{ fontSize:12, color: C.textMid, marginBottom:5 }}>Apertura</p><TimeInput value={inicio} onChange={setInicio}/></Field>
          <Field><p style={{ fontSize:12, color: C.textMid, marginBottom:5 }}>Cierre</p><TimeInput value={fin} onChange={setFin}/></Field>
        </div>
      </div>

      {/* Pausa */}
      <div style={{ background: C.panelAlt, borderRadius:12, overflow:'hidden' }}>
        <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', cursor:'pointer' }}>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color: C.text }}>Pausa / descanso</p>
            <p style={{ fontSize:11, color: C.textDim }}>Bloquea un rango intermedio</p>
          </div>
          <div style={{ width:40, height:22, borderRadius:11, background: pausaActiva ? C.green : C.border, position:'relative', transition:'background 0.2s', cursor:'pointer' }}
            onClick={() => setPausaActiva(p => !p)}>
            <div style={{ position:'absolute', top:2, left: pausaActiva ? 20 : 2, width:18, height:18, borderRadius:9, background:'#fff', transition:'left 0.2s' }}/>
          </div>
        </label>
        {pausaActiva && (
          <div style={{ padding:'0 14px 14px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field><p style={{ fontSize:12, color: C.textMid, marginBottom:5 }}>Inicio pausa</p><TimeInput value={pausaInicio} onChange={setPausaInicio}/></Field>
            <Field><p style={{ fontSize:12, color: C.textMid, marginBottom:5 }}>Fin pausa</p><TimeInput value={pausaFin} onChange={setPausaFin}/></Field>
          </div>
        )}
      </div>

      {/* Buffer */}
      <Field hint="Tiempo de margen automático entre cita y cita.">
        <Label>Buffer entre citas</Label>
        <div style={{ display:'flex', gap:8 }}>
          {BUFFERS.map(b => (
            <button key={b} onClick={() => setBuffer(b)}
              style={{ flex:1, padding:'9px 0', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, background: buffer === b ? C.green : C.panelAlt, color: buffer === b ? '#fff' : C.textMid, transition:'all 0.12s' }}>
              {b === 0 ? 'Sin buffer' : `${b}min`}
            </button>
          ))}
        </div>
      </Field>

      {/* Duración por defecto */}
      <Field hint="Se usa cuando se crea una cita sin servicio asignado.">
        <Label>Duración por defecto</Label>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {DURACIONES_DEF.map(d => {
            const label = d < 60 ? `${d}min` : d === 60 ? '1h' : `${Math.floor(d/60)}h${d%60?` ${d%60}m`:''}`;
            return (
              <button key={d} onClick={() => setDurDef(d)}
                style={{ padding:'8px 12px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: durDef === d ? C.green : C.panelAlt, color: durDef === d ? '#fff' : C.textMid, transition:'all 0.12s' }}>
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Excepciones */}
      <div>
        <Label>Días no disponibles (festivos / vacaciones)</Label>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input type="date" value={newExc} onChange={e => setNewExc(e.target.value)}
            style={{ flex:1, padding:'10px 12px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:10, color: C.text, fontSize:13, outline:'none', colorScheme:'dark' }}/>
          <button onClick={addExcepcion}
            style={{ padding:'10px 14px', borderRadius:10, border:'none', background: C.green, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14}/> Añadir
          </button>
        </div>
        {excepciones.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:180, overflowY:'auto' }}>
            {excepciones.map(d => (
              <div key={d} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background: C.panelAlt, borderRadius:8 }}>
                <span style={{ fontSize:13, color: C.text }}>
                  {new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'long', year:'numeric' })}
                </span>
                <button onClick={() => removeExcepcion(d)} style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:4, display:'flex' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.red; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.textDim; }}>
                  <X size={13}/>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize:12, color: C.textDim }}>Sin excepciones configuradas</p>
        )}
      </div>

      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 13px', background: C.redDim, borderRadius:9, border:`1px solid ${C.red}33` }}>
          <AlertTriangle size={13} style={{ color: C.red, flexShrink:0 }}/>
          <p style={{ fontSize:12, color: C.red }}>{error}</p>
        </div>
      )}

      <SaveBtn onClick={save} loading={loading}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// TAB: DÍAS LABORABLES
// ══════════════════════════════════════════════════════
function TabDias({ empresa, onSaved }: { empresa: any; onSaved: (data: any) => void }) {
  const parseDias = (raw: any): boolean[] => {
    if (Array.isArray(raw)) {
      // stored as array of day indices [1,2,3,4,5]
      return DIAS_IDX.map(d => raw.includes(d));
    }
    return [true,true,true,true,true,false,false];
  };

  const [dias, setDias] = useState<boolean[]>(parseDias(empresa?.dias_laborables));
  const [loading, setLoading] = useState(false);

  function toggle(i: number) { setDias(prev => prev.map((v, idx) => idx === i ? !v : v)); }
  function setLunVie() { setDias([true,true,true,true,true,false,false]); }
  function setTodos()  { setDias([true,true,true,true,true,true,true]); }
  function setNinguno(){ setDias([false,false,false,false,false,false,false]); }

  async function save() {
    setLoading(true);
    // Convert back to array of day indices
    const indices = DIAS_IDX.filter((_, i) => dias[i]);
    const { error } = await supabase.from('empresas').update({ dias_laborables: indices }).eq('id', empresa.id);
    setLoading(false);
    if (!error) onSaved({ dias_laborables: indices });
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Quick selectors */}
      <div style={{ display:'flex', gap:8 }}>
        {[
          { label:'Lun–Vie', fn: setLunVie },
          { label:'Todos',   fn: setTodos  },
          { label:'Ninguno', fn: setNinguno },
        ].map(btn => (
          <button key={btn.label} onClick={btn.fn}
            style={{ padding:'7px 14px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color: C.textMid, cursor:'pointer', fontSize:12, fontWeight:600 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderHover; (e.currentTarget as HTMLElement).style.color = C.text; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.color = C.textMid; }}>
            {btn.label}
          </button>
        ))}
      </div>

      {/* Day toggles */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:8 }}>
        {DIAS_SEMANA.map((d, i) => (
          <button key={d} onClick={() => toggle(i)}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              padding:'14px 4px', borderRadius:12, border:'none', cursor:'pointer',
              background: dias[i] ? C.greenDim : C.panelAlt,
              outline: dias[i] ? `2px solid ${C.green}55` : 'none',
              transition:'all 0.15s',
            }}>
            <span style={{ fontSize:12, fontWeight:700, color: dias[i] ? C.green : C.textDim }}>{d}</span>
            <span style={{ fontSize:9, marginTop:4, color: dias[i] ? C.green : C.textDim, fontWeight:600 }}>
              {dias[i] ? 'Abierto' : 'Cerrado'}
            </span>
          </button>
        ))}
      </div>

      <p style={{ fontSize:12, color: C.textDim }}>
        {dias.filter(Boolean).length} día{dias.filter(Boolean).length !== 1 ? 's' : ''} laborable{dias.filter(Boolean).length !== 1 ? 's' : ''} seleccionado{dias.filter(Boolean).length !== 1 ? 's' : ''}
      </p>

      <SaveBtn onClick={save} loading={loading} disabled={dias.every(d => !d)}/>
      {dias.every(d => !d) && <p style={{ fontSize:12, color: C.amber }}>⚠ Debes tener al menos un día activo</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// TAB: EMPLEADOS
// ══════════════════════════════════════════════════════
function TabEmpleados({ empresa, profesionalActual }: { empresa: any; profesionalActual: any }) {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invEmail, setInvEmail] = useState('');
  const [invNombre, setInvNombre] = useState('');
  const [invRol, setInvRol] = useState('empleado');
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => { load(); }, [empresa?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('profesionales').select('*')
      .eq('empresa_id', empresa.id)
      .order('nombre');
    setEmpleados(data || []);
    setLoading(false);
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  async function invitar() {
    if (!invNombre.trim()) { setInvError('El nombre es obligatorio'); return; }
    setInvLoading(true); setInvError('');
    const { error } = await supabase.from('profesionales').insert({
      empresa_id: empresa.id,
      nombre: invNombre.trim(),
      email: invEmail.trim() || null,
      rol: invRol,
      activo: true,
    });
    setInvLoading(false);
    if (error) { setInvError('Error al crear empleado'); return; }
    setInvNombre(''); setInvEmail(''); setInvRol('empleado');
    await load();
    showToast(`${invNombre} añadido`);
  }

  async function changeRol(id: string, rol: string) {
    await supabase.from('profesionales').update({ rol }).eq('id', id);
    setEmpleados(prev => prev.map(e => e.id === id ? { ...e, rol } : e));
  }

  async function toggleActivo(emp: any) {
    // Prevent disabling last admin
    if (emp.activo && (emp.rol === 'admin' || emp.rol === 'owner')) {
      const admins = empleados.filter(e => e.activo && (e.rol === 'admin' || e.rol === 'owner'));
      if (admins.length <= 1) { showToast('No puedes desactivar el único administrador'); return; }
    }
    await supabase.from('profesionales').update({ activo: !emp.activo }).eq('id', emp.id);
    setEmpleados(prev => prev.map(e => e.id === emp.id ? { ...e, activo: !e.activo } : e));
  }

  async function eliminar(id: string) {
    const emp = empleados.find(e => e.id === id);
    if (emp?.rol === 'admin' || emp?.rol === 'owner') {
      const admins = empleados.filter(e => e.activo && (e.rol === 'admin' || e.rol === 'owner'));
      if (admins.length <= 1) { showToast('No puedes eliminar el único administrador'); setConfirmDel(null); return; }
    }
    await supabase.from('profesionales').delete().eq('id', id);
    setEmpleados(prev => prev.filter(e => e.id !== id));
    setConfirmDel(null);
    showToast('Empleado eliminado');
  }

  const rolColor = (rol: string) => rol === 'admin' || rol === 'owner' ? '#A855F7' : C.textMid;
  const rolLabel = (rol: string) => rol === 'owner' ? 'Propietario' : rol === 'admin' ? 'Admin' : 'Empleado';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Lista */}
      {loading ? (
        <p style={{ color: C.textDim, fontSize:13 }}>Cargando...</p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {empleados.map(emp => {
            const isMe = emp.id === profesionalActual?.id;
            return (
              <div key={emp.id} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                background: C.panelAlt, borderRadius:12,
                opacity: emp.activo ? 1 : 0.55,
                border: isMe ? `1px solid ${C.green}33` : `1px solid ${C.border}`,
              }}>
                {/* Avatar */}
                <div style={{ width:36, height:36, borderRadius:9, background: emp.color || C.panelAlt, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff', flexShrink:0, border:`1px solid ${C.border}` }}>
                  {emp.nombre?.[0]?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <p style={{ fontSize:13, fontWeight:600, color: C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {emp.nombre}
                    </p>
                    {isMe && <span style={{ fontSize:9, color: C.green, fontWeight:700, background: C.greenDim, padding:'1px 6px', borderRadius:4 }}>TÚ</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:10, color: rolColor(emp.rol), fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>{rolLabel(emp.rol)}</span>
                    {emp.email && <span style={{ fontSize:11, color: C.textDim, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.email}</span>}
                    {!emp.activo && <span style={{ fontSize:9, color: C.amber, fontWeight:700 }}>INACTIVO</span>}
                  </div>
                </div>

                {/* Actions */}
                {!isMe && (
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    {/* Cambiar rol */}
                    <select value={emp.rol} onChange={e => changeRol(emp.id, e.target.value)}
                      style={{ padding:'5px 8px', background: C.panel, border:`1px solid ${C.border}`, borderRadius:7, color: C.textMid, fontSize:11, cursor:'pointer', outline:'none' }}>
                      <option value="empleado">Empleado</option>
                      <option value="admin">Admin</option>
                    </select>
                    {/* Toggle activo */}
                    <button onClick={() => toggleActivo(emp)} title={emp.activo ? 'Desactivar' : 'Activar'}
                      style={{ padding:'5px 8px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', cursor:'pointer', color: emp.activo ? C.green : C.textDim, fontSize:11, fontWeight:600 }}>
                      {emp.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    {/* Eliminar */}
                    {confirmDel === emp.id ? (
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => eliminar(emp.id)} style={{ padding:'5px 9px', borderRadius:7, border:'none', background: C.red, color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700 }}>Eliminar</button>
                        <button onClick={() => setConfirmDel(null)} style={{ padding:'5px 9px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', color: C.textMid, cursor:'pointer', fontSize:11 }}>No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDel(emp.id)} title="Eliminar"
                        style={{ padding:'5px 8px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', cursor:'pointer', color: C.textDim, display:'flex', alignItems:'center' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.red; (e.currentTarget as HTMLElement).style.borderColor = C.red + '44'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.textDim; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Añadir empleado */}
      <div style={{ background: C.panelAlt, borderRadius:12, padding:16 }}>
        <p style={{ fontSize:13, fontWeight:700, color: C.text, marginBottom:14 }}>Añadir empleado</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <p style={{ fontSize:11, color: C.textMid, fontWeight:600, marginBottom:5 }}>NOMBRE *</p>
              <Input value={invNombre} onChange={setInvNombre} placeholder="Nombre"/>
            </div>
            <div>
              <p style={{ fontSize:11, color: C.textMid, fontWeight:600, marginBottom:5 }}>EMAIL</p>
              <Input value={invEmail} onChange={setInvEmail} placeholder="email@..." type="email"/>
            </div>
          </div>
          <div>
            <p style={{ fontSize:11, color: C.textMid, fontWeight:600, marginBottom:5 }}>ROL</p>
            <Select value={invRol} onChange={setInvRol} options={[
              { value:'empleado', label:'Empleado' },
              { value:'admin',    label:'Administrador' },
            ]}/>
          </div>
          {invError && <p style={{ color: C.red, fontSize:12 }}>{invError}</p>}
          <button onClick={invitar} disabled={invLoading}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 16px', borderRadius:10, border:'none', background: C.green, color:'#fff', cursor: invLoading ? 'not-allowed' : 'pointer', fontSize:13, fontWeight:700, opacity: invLoading ? 0.7 : 1 }}>
            <Plus size={14}/> {invLoading ? 'Añadiendo...' : 'Añadir empleado'}
          </button>
        </div>
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast('')}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════
export default function ConfiguracionSection({
  empresaId, profesionalId,
}: {
  empresaId: string;
  profesionalId: string;
}) {
  const [activeTab, setActiveTab] = useState('empresa');
  const [empresa, setEmpresa] = useState<any>(null);
  const [profesionalActual, setProfesionalActual] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  // Mobile accordion
  const [mobileOpen, setMobileOpen] = useState<string | null>('empresa');

  useEffect(() => {
    if (!empresaId) return;
    Promise.all([
      supabase.from('empresas').select('*').eq('id', empresaId).single(),
      supabase.from('profesionales').select('*').eq('id', profesionalId).single(),
    ]).then(([{ data: emp }, { data: prof }]) => {
      setEmpresa(emp);
      setProfesionalActual(prof);
      setLoading(false);
    });
  }, [empresaId, profesionalId]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  function handleSaved(tab: string, data: any) {
    setEmpresa((prev: any) => ({ ...prev, ...data }));
    showToast('Cambios guardados');
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color: C.textDim }}>
      Cargando configuración...
    </div>
  );

  function renderTabContent(id: string) {
    switch (id) {
      case 'empresa':   return <TabEmpresa empresa={empresa} onSaved={d => handleSaved('empresa', d)}/>;
      case 'horario':   return <TabHorario empresa={empresa} onSaved={d => handleSaved('horario', d)}/>;
      case 'dias':      return <TabDias    empresa={empresa} onSaved={d => handleSaved('dias', d)}/>;
      case 'empleados': return <TabEmpleados empresa={empresa} profesionalActual={profesionalActual}/>;
      default: return null;
    }
  }

  return (
    <div style={{ background: C.bg, minHeight:'100vh', color: C.text }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cfg-desktop { display: flex; }
        .cfg-mobile  { display: none; }
        @media (max-width: 767px) {
          .cfg-desktop { display: none !important; }
          .cfg-mobile  { display: block !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: C.panel, borderBottom:`1px solid ${C.border}`, padding:'16px 20px', flexShrink:0 }}>
        <h2 style={{ fontSize:18, fontWeight:700 }}>Configuración</h2>
        <p style={{ fontSize:12, color: C.textMid, marginTop:2 }}>{empresa?.nombre}</p>
      </div>

      {/* ── DESKTOP: sidebar tabs + content ── */}
      <div className="cfg-desktop" style={{ maxWidth:900, margin:'0 auto', padding:24, gap:24, alignItems:'flex-start' }}>
        {/* Tab list */}
        <div style={{ width:200, flexShrink:0, display:'flex', flexDirection:'column', gap:2 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'10px 14px', borderRadius:10, border:'none', cursor:'pointer',
                  background: active ? C.greenDim : 'transparent',
                  color: active ? C.green : C.textMid,
                  fontWeight: active ? 600 : 400, fontSize:13,
                  borderLeft: active ? `3px solid ${C.green}` : '3px solid transparent',
                  transition:'all 0.12s', textAlign:'left' as const,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = C.panelAlt; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Icon size={15} style={{ flexShrink:0 }}/>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content panel */}
        <div style={{ flex:1, background: C.panel, borderRadius:16, padding:24, minWidth:0 }}>
          {renderTabContent(activeTab)}
        </div>
      </div>

      {/* ── MOBILE: accordion ── */}
      <div className="cfg-mobile" style={{ padding:'12px 16px 80px', display:'flex', flexDirection:'column', gap:6 }}>
        {TABS.map(tab => {
          const open = mobileOpen === tab.id;
          const Icon = tab.icon;
          return (
            <div key={tab.id} style={{ background: C.panel, borderRadius:14, overflow:'hidden', border:`1px solid ${open ? C.green + '33' : C.border}` }}>
              <button onClick={() => setMobileOpen(open ? null : tab.id)}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'transparent', border:'none', cursor:'pointer', color: open ? C.green : C.text }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Icon size={16} style={{ color: open ? C.green : C.textMid }}/>
                  <span style={{ fontSize:14, fontWeight:600 }}>{tab.label}</span>
                </div>
                {open ? <ChevronUp size={15} style={{ color: C.textMid }}/> : <ChevronDown size={15} style={{ color: C.textMid }}/>}
              </button>
              {open && (
                <div style={{ padding:'0 16px 20px' }}>
                  {renderTabContent(tab.id)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast('')}/>}
    </div>
  );
}
