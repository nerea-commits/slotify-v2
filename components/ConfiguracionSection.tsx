'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Building2, Clock, Calendar, Users, Check, X, AlertTriangle,
  Plus, Trash2, RefreshCw, Shield, UserCircle, Mail, ChevronDown, ChevronUp, Upload, User
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

const ADMIN_TABS = [
  { id: 'empresa',   label: 'Empresa',        icon: Building2 },
  { id: 'horario',   label: 'Horario',         icon: Clock     },
  { id: 'dias',      label: 'Días laborables', icon: Calendar  },
  { id: 'empleados', label: 'Empleados',       icon: Users     },
];

const EMPLOYEE_TABS = [
  { id: 'miperfil',  label: 'Mi perfil',      icon: User      },
];

const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DIAS_IDX    = [1, 2, 3, 4, 5, 6, 0];

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

const PERMISOS_DEF = [
  { key: 'ver_agenda_todos',      label: 'Ver agenda de todos',      desc: 'Puede ver las citas de todos los empleados' },
  { key: 'gestionar_citas_todos', label: 'Gestionar citas de todos', desc: 'Puede crear, editar y cancelar citas de cualquier empleado' },
  { key: 'gestionar_clientes',    label: 'Gestionar clientes',       desc: 'Acceso completo a todos los clientes, no solo los suyos' },
  { key: 'editar_servicios',      label: 'Editar servicios',         desc: 'Puede crear, editar y eliminar servicios' },
  { key: 'ver_estadisticas',      label: 'Ver estadísticas propias', desc: 'Acceso a su panel de estadísticas personales' },
];

const AVATAR_COLORS = [
  '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
  '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#64748B',
  '#0EA5E9', '#D946EF', '#84CC16', '#FB7185', '#A78BFA',
  '#34D399',
];

function defaultPermisos(): Record<string, boolean> {
  return Object.fromEntries(PERMISOS_DEF.map(p => [p.key, false]));
}

function parsePermisos(raw: any): Record<string, boolean> {
  const def = defaultPermisos();
  if (!raw || typeof raw !== 'object') return def;
  return { ...def, ...raw };
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)}
      style={{ width:36, height:20, borderRadius:10, background: value ? C.green : 'rgba(148,163,184,0.2)', position:'relative', transition:'background 0.2s', cursor:'pointer', flexShrink:0 }}>
      <div style={{ position:'absolute', top:2, left: value ? 18 : 2, width:16, height:16, borderRadius:8, background:'#fff', transition:'left 0.2s' }}/>
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

function SaveBtn({ onClick, loading, disabled, label }: { onClick: () => void; loading: boolean; disabled?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 20px', borderRadius:10, border:'none', background: disabled ? C.panelAlt : C.green, color: disabled ? C.textDim : '#fff', cursor: disabled ? 'default' : 'pointer', fontSize:13, fontWeight:700, transition:'all 0.15s' }}>
      {loading ? <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> : <Check size={14}/>}
      {loading ? 'Guardando...' : (label || 'Guardar')}
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
// TAB: MI PERFIL (para empleados)
// ══════════════════════════════════════════════════════
function TabMiPerfil({ profesional, onSaved }: { profesional: any; onSaved: (data: any) => void }) {
  const [nombre, setNombre] = useState(profesional?.nombre || '');
  const [color, setColor] = useState(profesional?.color || AVATAR_COLORS[0]);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [currentPin, setCurrentPin] = useState(profesional?.pin || '');
  const [showPinForm, setShowPinForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [error, setError] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  useEffect(() => {
    setNombre(profesional?.nombre || '');
    setColor(profesional?.color || AVATAR_COLORS[0]);
    setCurrentPin(profesional?.pin || '');
  }, [profesional?.id]);

  async function saveProfile() {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true); setError('');

    const { error: e } = await supabase.from('profesionales').update({
      nombre: nombre.trim(),
      color,
    }).eq('id', profesional.id);

    setLoading(false);
    if (e) { setError('Error al guardar: ' + e.message); return; }
    onSaved({ nombre: nombre.trim(), color });
  }

  async function savePin() {
    setPinError(''); setPinSuccess('');
    if (pin.length < 4) { setPinError('El PIN debe tener al menos 4 dígitos'); return; }
    if (pin !== pinConfirm) { setPinError('Los PINs no coinciden'); return; }
    if (!/^\d+$/.test(pin)) { setPinError('El PIN solo puede contener números'); return; }

    setPinLoading(true);
    const { error: e } = await supabase.from('profesionales').update({ pin }).eq('id', profesional.id);
    setPinLoading(false);

    if (e) { setPinError('Error al guardar PIN'); return; }
    setCurrentPin(pin);
    setPin(''); setPinConfirm('');
    setShowPinForm(false);
    setPinSuccess('PIN actualizado');
    setTimeout(() => setPinSuccess(''), 3000);
  }

  async function removePin() {
    setPinLoading(true);
    await supabase.from('profesionales').update({ pin: null }).eq('id', profesional.id);
    setPinLoading(false);
    setCurrentPin('');
    setPinSuccess('PIN eliminado');
    setTimeout(() => setPinSuccess(''), 3000);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 800, color: '#fff',
          boxShadow: `0 4px 16px ${color}55`,
          transition: 'all 0.2s',
        }}>
          {nombre?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{nombre || 'Sin nombre'}</p>
          <p style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>{profesional?.email || 'Sin email'}</p>
          <p style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
            {profesional?.rol === 'admin' || profesional?.rol === 'owner' ? 'Administrador' : 'Empleado'}
          </p>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>Nombre</p>
        <Input value={nombre} onChange={setNombre} placeholder="Tu nombre"/>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>Color de tu avatar</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {AVATAR_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: c,
                outline: color === c ? `3px solid ${c}` : 'none',
                outlineOffset: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.1s',
                transform: color === c ? 'scale(1.1)' : 'scale(1)',
              }}>
              {color === c && <Check size={16} style={{ color: '#fff' }}/>}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: C.red, fontSize:13 }}>{error}</p>}
      <SaveBtn onClick={saveProfile} loading={loading} label="Guardar perfil"/>

      <div style={{ height: 1, background: C.border, margin: '4px 0' }} />

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color: C.text }}>PIN de acceso</p>
            <p style={{ fontSize:11, color: C.textDim, marginTop:2 }}>
              {currentPin ? 'Tienes un PIN configurado' : 'No tienes PIN configurado'}
            </p>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {currentPin && !showPinForm && (
              <button onClick={removePin} disabled={pinLoading}
                style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color: C.red, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                Quitar PIN
              </button>
            )}
            <button onClick={() => { setShowPinForm(!showPinForm); setPin(''); setPinConfirm(''); setPinError(''); }}
              style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${C.border}`, background: showPinForm ? C.panelAlt : 'transparent', color: C.textMid, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              {showPinForm ? 'Cancelar' : currentPin ? 'Cambiar PIN' : 'Establecer PIN'}
            </button>
          </div>
        </div>

        {showPinForm && (
          <div style={{ background: C.panelAlt, borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <p style={{ fontSize:11, color: C.textMid, fontWeight:600, marginBottom:5 }}>Nuevo PIN (mínimo 4 dígitos)</p>
              <input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="····"
                style={{ width:'100%', padding:'10px 13px', background: C.panel, border:`1px solid ${C.border}`, borderRadius:10, color: C.text, fontSize:18, textAlign:'center', letterSpacing:8, outline:'none', boxSizing:'border-box' as const }}/>
            </div>
            <div>
              <p style={{ fontSize:11, color: C.textMid, fontWeight:600, marginBottom:5 }}>Confirmar PIN</p>
              <input type="password" maxLength={6} value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                placeholder="····"
                style={{ width:'100%', padding:'10px 13px', background: C.panel, border:`1px solid ${C.border}`, borderRadius:10, color: C.text, fontSize:18, textAlign:'center', letterSpacing:8, outline:'none', boxSizing:'border-box' as const }}/>
            </div>
            {pinError && <p style={{ color: C.red, fontSize:12 }}>{pinError}</p>}
            <button onClick={savePin} disabled={pinLoading}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 16px', borderRadius:10, border:'none', background: C.green, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, opacity: pinLoading ? 0.7 : 1 }}>
              <Check size={14}/> {pinLoading ? 'Guardando...' : 'Guardar PIN'}
            </button>
          </div>
        )}

        {pinSuccess && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background: C.greenDim, borderRadius:8 }}>
            <Check size={14} style={{ color: C.green }}/>
            <p style={{ fontSize:12, color: C.green, fontWeight:600 }}>{pinSuccess}</p>
          </div>
        )}
      </div>
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
  const [sector, setSector] = useState(empresa?.sector || '');
  const [cif, setCif] = useState(empresa?.cif || '');
  const [logoUrl, setLogoUrl] = useState(empresa?.logo_url || '');
  const [logoUploading, setLogoUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNombre(empresa?.nombre || '');
    setTelefono(empresa?.telefono || '');
    setEmail(empresa?.email || '');
    setDireccion(empresa?.direccion || '');
    setColorPrimario(empresa?.color_primario || '#22C55E');
    setTimezone(empresa?.timezone || 'Europe/Madrid');
    setMoneda(empresa?.moneda || 'EUR');
    setMostrarImporte(empresa?.mostrar_importe || false);
    setSector(empresa?.sector || '');
    setCif(empresa?.cif || '');
    setLogoUrl(empresa?.logo_url || '');
  }, [empresa?.id]);

  async function save() {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!empresa?.id) { setError('Error: empresa sin ID'); return; }
    setLoading(true); setError('');

    const finalLogoUrl = (logoUrl && !logoUrl.startsWith('data:')) ? logoUrl.trim() : null;

    const { data: d1, error: e1 } = await supabase.from('empresas')
      .update({
        nombre: nombre.trim(),
        color_primario: colorPrimario,
        mostrar_importe: mostrarImporte,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        direccion: direccion.trim() || null,
        sector: sector.trim() || null,
        cif: cif.trim() || null,
        timezone,
        moneda,
      })
      .eq('id', empresa.id)
      .select();

    setLoading(false);

    if (e1) { setError(`Error Supabase: ${e1.message} (code: ${e1.code})`); return; }
    if (!d1 || d1.length === 0) { setError('RLS bloqueó el guardado. Revisa políticas en Supabase.'); return; }

    onSaved({
      nombre: nombre.trim(),
      color_primario: colorPrimario,
      logo_url: finalLogoUrl,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      direccion: direccion.trim() || null,
      sector: sector.trim() || null,
      cif: cif.trim() || null,
      timezone,
      moneda,
      mostrar_importe: mostrarImporte,
    });
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
        <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Nombre de la empresa *</p>
        <Input value={nombre} onChange={setNombre} placeholder="Mi negocio"/>
      </div>

      <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
        <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:4 }}>Logo</p>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:80, height:80, borderRadius:14, background: C.panelAlt, border:`2px solid ${C.border}`, flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {logoUrl ? <img src={logoUrl} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/> : <span style={{ fontSize:28, color: C.textDim }}>🏢</span>}
          </div>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
            {logoUrl && <p style={{ fontSize:12, color: C.green, fontWeight:600 }}>✓ Logo guardado</p>}
            <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'11px 16px', background: C.panelAlt, border:`1px dashed ${logoUrl ? C.green+'44' : C.border}`, borderRadius:10, cursor: logoUploading ? 'wait' : 'pointer', fontSize:13, color: C.textMid, fontWeight:600 }}>
              {logoUploading
                ? <><RefreshCw size={14} style={{ color: C.green, animation:'spin 1s linear infinite' }}/> Subiendo...</>
                : <><Upload size={14} style={{ color: C.green }}/>{logoUrl ? 'Cambiar logo' : 'Subir logo'}</>}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display:'none' }} disabled={logoUploading} onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setLogoUploading(true);
                try {
                  const ext = file.name.split('.').pop() || 'png';
                  const path = `${empresa.id}/logo_${Date.now()}.${ext}`;
                  const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
                  if (upErr) throw upErr;
                  const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
                  setLogoUrl(urlData.publicUrl);
                  await supabase.from('empresas').update({ logo_url: urlData.publicUrl }).eq('id', empresa.id);
                  onSaved({ nombre, color_primario: colorPrimario, logo_url: urlData.publicUrl });
                } catch (err: any) {
                  setError('Error al subir logo: ' + err.message);
                } finally {
                  setLogoUploading(false);
                }
              }}/>
            </label>
            {logoUrl && (
              <button onClick={async () => {
                setLogoUrl('');
                await supabase.from('empresas').update({ logo_url: null }).eq('id', empresa.id);
                onSaved({ nombre, color_primario: colorPrimario, logo_url: null });
              }} style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, fontSize:12, textAlign:'left' as const }}>
                Quitar logo
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
          <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Teléfono</p>
          <Input value={telefono} onChange={setTelefono} placeholder="+34 600 000 000" type="tel"/>
        </div>
        <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
          <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Email</p>
          <Input value={email} onChange={setEmail} placeholder="contacto@empresa.com" type="email"/>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
        <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Dirección</p>
        <Input value={direccion} onChange={setDireccion} placeholder="Calle, ciudad..."/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
          <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Sector</p>
          <Input value={sector} onChange={setSector} placeholder="Ej: Peluquería, Estética..."/>
        </div>
        <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
          <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>CIF</p>
          <Input value={cif} onChange={setCif} placeholder="B12345678"/>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
          <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Zona horaria</p>
          <Select value={timezone} onChange={setTimezone} options={TIMEZONES.map(t => ({ value:t, label:t.replace('_',' ') }))}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
          <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Moneda</p>
          <Select value={moneda} onChange={setMoneda} options={MONEDAS.map(m => ({ value:m.code, label:m.label }))}/>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
        <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Color primario</p>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <input type="color" value={colorPrimario} onChange={e => setColorPrimario(e.target.value)}
            style={{ width:44, height:36, borderRadius:8, border:`1px solid ${C.border}`, background:'none', cursor:'pointer', padding:2 }}/>
          <Input value={colorPrimario} onChange={setColorPrimario} placeholder="#22C55E"/>
        </div>
      </div>

      <label style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background: C.panelAlt, borderRadius:10, cursor:'pointer' }}>
        <input type="checkbox" checked={mostrarImporte} onChange={e => setMostrarImporte(e.target.checked)} style={{ width:16, height:16, accentColor: C.green }}/>
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

  useEffect(() => {
    setInicio(empresa?.horario_inicio || '09:00');
    setFin(empresa?.horario_fin || '19:00');
    setPausaActiva(empresa?.pausa_activa || false);
    setPausaInicio(empresa?.horario_pausa_inicio || '14:00');
    setPausaFin(empresa?.horario_pausa_fin || '16:00');
    setBuffer(empresa?.buffer_minutos ?? 0);
    setDurDef(empresa?.duracion_defecto ?? 60);
    setExcepciones(empresa?.dias_excepciones || []);
  }, [empresa?.id]);

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
      horario_inicio: inicio, horario_fin: fin,
      pausa_activa: pausaActiva,
      horario_pausa_inicio: pausaActiva ? pausaInicio : null,
      horario_pausa_fin: pausaActiva ? pausaFin : null,
      buffer_minutos: buffer, duracion_defecto: durDef,
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

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Horario de trabajo</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}><p style={{ fontSize:12, color: C.textMid, marginBottom:5 }}>Apertura</p><TimeInput value={inicio} onChange={setInicio}/></div>
          <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}><p style={{ fontSize:12, color: C.textMid, marginBottom:5 }}>Cierre</p><TimeInput value={fin} onChange={setFin}/></div>
        </div>
      </div>

      <div style={{ background: C.panelAlt, borderRadius:12, overflow:'hidden', border: pausaActiva ? `1px solid ${C.green}33` : `1px solid ${C.border}` }}>
        <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', cursor:'pointer' }}>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color: C.text }}>Turno partido</p>
            <p style={{ fontSize:11, color: C.textDim }}>{pausaActiva ? `Pausa de ${pausaInicio} a ${pausaFin}` : 'Activa si cierras a mediodía'}</p>
          </div>
          <div style={{ width:40, height:22, borderRadius:11, background: pausaActiva ? C.green : C.border, position:'relative', transition:'background 0.2s', cursor:'pointer' }}
            onClick={() => setPausaActiva((prev: boolean) => !prev)}>
            <div style={{ position:'absolute', top:2, left: pausaActiva ? 20 : 2, width:18, height:18, borderRadius:9, background:'#fff', transition:'left 0.2s' }}/>
          </div>
        </label>
        {pausaActiva && (
          <div style={{ padding:'0 14px 14px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}><p style={{ fontSize:12, color: C.textMid, marginBottom:5 }}>Inicio pausa</p><TimeInput value={pausaInicio} onChange={setPausaInicio}/></div>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}><p style={{ fontSize:12, color: C.textMid, marginBottom:5 }}>Fin pausa</p><TimeInput value={pausaFin} onChange={setPausaFin}/></div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
        <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Buffer entre citas</p>
        <div style={{ display:'flex', gap:8 }}>
          {BUFFERS.map(b => (
            <button key={b} onClick={() => setBuffer(b)}
              style={{ flex:1, padding:'9px 0', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, background: buffer === b ? C.green : C.panelAlt, color: buffer === b ? '#fff' : C.textMid }}>
              {b === 0 ? 'Sin buffer' : `${b}min`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
        <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Duración por defecto</p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const, alignItems:'center' }}>
          <button onClick={() => setDurDef(null as any)}
            style={{ padding:'8px 12px', borderRadius:9, border:`1px solid ${durDef == null ? C.green+'66' : C.border}`, cursor:'pointer', fontSize:12, fontWeight:600, background: durDef == null ? 'rgba(34,197,94,0.08)' : 'transparent', color: durDef == null ? C.green : C.textDim }}>
            Sin definir
          </button>
          {DURACIONES_DEF.map(d => {
            const label = d < 60 ? `${d}min` : d === 60 ? '1h' : `${Math.floor(d/60)}h${d%60?` ${d%60}m`:''}`;
            return (
              <button key={d} onClick={() => setDurDef(d)}
                style={{ padding:'8px 12px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: durDef === d ? C.green : C.panelAlt, color: durDef === d ? '#fff' : C.textMid }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:7 }}>Días no disponibles (festivos / vacaciones)</p>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input type="date" value={newExc} onChange={e => setNewExc(e.target.value)}
            style={{ flex:1, padding:'10px 12px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:10, color: C.text, fontSize:13, outline:'none', colorScheme:'dark' as const }}/>
          <button onClick={addExcepcion}
            style={{ padding:'10px 14px', borderRadius:10, border:'none', background: C.green, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14}/> Añadir
          </button>
        </div>
        {excepciones.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:180, overflowY:'auto' as const }}>
            {excepciones.map(d => (
              <div key={d} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background: C.panelAlt, borderRadius:8 }}>
                <span style={{ fontSize:13, color: C.text }}>
                  {new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'long', year:'numeric' })}
                </span>
                <button onClick={() => setExcepciones(prev => prev.filter(x => x !== d))} style={{ background:'none', border:'none', cursor:'pointer', color: C.textDim, padding:4, display:'flex' }}>
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
    if (Array.isArray(raw)) return DIAS_IDX.map(d => raw.map(Number).includes(d));
    return [true,true,true,true,true,false,false];
  };

  const [dias, setDias] = useState<boolean[]>(parseDias(empresa?.dias_laborables));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDias(parseDias(empresa?.dias_laborables));
  }, [empresa?.dias_laborables]);

  function toggle(i: number) { setDias(prev => prev.map((v, idx) => idx === i ? !v : v)); }

  async function save() {
    setLoading(true);
    const indices = DIAS_IDX.filter((_, i) => dias[i]);
    const { error } = await supabase.from('empresas').update({ dias_laborables: indices }).eq('id', empresa.id);
    setLoading(false);
    if (!error) onSaved({ dias_laborables: indices });
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', gap:8 }}>
        {[
          { label:'Lun–Vie', fn: () => setDias([true,true,true,true,true,false,false]) },
          { label:'Todos',   fn: () => setDias([true,true,true,true,true,true,true]) },
          { label:'Ninguno', fn: () => setDias([false,false,false,false,false,false,false]) },
        ].map(btn => (
          <button key={btn.label} onClick={btn.fn}
            style={{ padding:'7px 14px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color: C.textMid, cursor:'pointer', fontSize:12, fontWeight:600 }}>
            {btn.label}
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:8 }}>
        {DIAS_SEMANA.map((d, i) => (
          <button key={d} onClick={() => toggle(i)}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'14px 4px', borderRadius:12, border:'none', cursor:'pointer', background: dias[i] ? C.greenDim : C.panelAlt, outline: dias[i] ? `2px solid ${C.green}55` : 'none' }}>
            <span style={{ fontSize:12, fontWeight:700, color: dias[i] ? C.green : C.textDim }}>{d}</span>
            <span style={{ fontSize:9, marginTop:4, color: dias[i] ? C.green : C.textDim, fontWeight:600 }}>{dias[i] ? 'Abierto' : 'Cerrado'}</span>
          </button>
        ))}
      </div>

      <p style={{ fontSize:12, color: C.textDim }}>{dias.filter(Boolean).length} día{dias.filter(Boolean).length !== 1 ? 's' : ''} laborable{dias.filter(Boolean).length !== 1 ? 's' : ''} seleccionado{dias.filter(Boolean).length !== 1 ? 's' : ''}</p>
      <SaveBtn onClick={save} loading={loading} disabled={dias.every(d => !d)}/>
      {dias.every(d => !d) && <p style={{ fontSize:12, color: C.amber }}>⚠ Debes tener al menos un día activo</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// TAB: EMPLEADOS (solo admin)
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
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<Record<string, 'horario' | 'permisos'>>({});
  const [empHorarios, setEmpHorarios] = useState<Record<string, any>>({});
  const [empPermisos, setEmpPermisos] = useState<Record<string, Record<string, boolean>>>({});
  const [savingHorario, setSavingHorario] = useState<string | null>(null);
  const [savingPermisos, setSavingPermisos] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const DIAS_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const DIAS_IDX2 = [1, 2, 3, 4, 5, 6, 0];

  useEffect(() => { load(); }, [empresa?.id]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('profesionales').select('*').eq('empresa_id', empresa.id).order('nombre');
    setEmpleados(data || []);
    setLoading(false);
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  async function loadHorario(empId: string) {
    const { data } = await supabase.from('profesionales')
      .select('horario_apertura, horario_cierre, pausa_activa, horario_pausa_inicio, horario_pausa_fin, dias_laborables')
      .eq('id', empId).single();
    if (data) {
      setEmpHorarios(prev => ({ ...prev, [empId]: {
        apertura: data.horario_apertura || empresa?.horario_inicio || '09:00',
        cierre: data.horario_cierre || empresa?.horario_fin || '19:00',
        pausaActiva: data.pausa_activa || false,
        pausaInicio: data.horario_pausa_inicio || '14:00',
        pausaFin: data.horario_pausa_fin || '16:00',
        dias: data.dias_laborables || empresa?.dias_laborables || [1,2,3,4,5],
      }}));
    }
  }

  async function loadPermisos(empId: string) {
    const { data } = await supabase.from('profesionales').select('permisos').eq('id', empId).single();
    setEmpPermisos(prev => ({ ...prev, [empId]: parsePermisos(data?.permisos) }));
  }

  async function saveHorario(empId: string) {
    setSavingHorario(empId);
    const h = empHorarios[empId];
    await supabase.from('profesionales').update({
      horario_apertura: h.apertura, horario_cierre: h.cierre,
      pausa_activa: h.pausaActiva,
      horario_pausa_inicio: h.pausaActiva ? h.pausaInicio : null,
      horario_pausa_fin: h.pausaActiva ? h.pausaFin : null,
      dias_laborables: h.dias,
    }).eq('id', empId);
    setSavingHorario(null);
    showToast('Horario guardado');
  }

  async function savePermisos(empId: string) {
    setSavingPermisos(empId);
    await supabase.from('profesionales').update({ permisos: empPermisos[empId] }).eq('id', empId);
    setEmpleados(prev => prev.map(e => e.id === empId ? { ...e, permisos: empPermisos[empId] } : e));
    setSavingPermisos(null);
    showToast('Permisos guardados');
  }

  function toggleEmp(empId: string, tab: 'horario' | 'permisos') {
    const currentTab = expandedTab[empId];
    if (expandedEmp === empId && currentTab === tab) {
      setExpandedEmp(null);
    } else {
      setExpandedEmp(empId);
      setExpandedTab(prev => ({ ...prev, [empId]: tab }));
      if (tab === 'horario' && !empHorarios[empId]) loadHorario(empId);
      if (tab === 'permisos') loadPermisos(empId);
    }
  }

  function updateHorario(empId: string, key: string, value: any) {
    setEmpHorarios(prev => ({ ...prev, [empId]: { ...prev[empId], [key]: value } }));
  }

  function updatePermiso(empId: string, key: string, value: boolean) {
    setEmpPermisos(prev => ({ ...prev, [empId]: { ...prev[empId], [key]: value } }));
  }

  async function invitar() {
    if (!invNombre.trim()) { setInvError('El nombre es obligatorio'); return; }
    if (!invEmail.trim() || !invEmail.includes('@')) { setInvError('El email es obligatorio'); return; }
    setInvLoading(true); setInvError('');
    try {
      const res = await fetch('/api/invite-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invEmail.trim(), nombre: invNombre.trim(), rol: invRol, empresa_id: empresa.id }),
      });
      const data = await res.json();
      if (!res.ok) { setInvError(data.error || 'Error al invitar'); return; }
      setInvNombre(''); setInvEmail(''); setInvRol('empleado');
      await load();
      showToast(`Invitación enviada a ${invEmail}`);
    } catch (err: any) {
      setInvError(err.message || 'Error de conexión');
    } finally {
      setInvLoading(false);
    }
  }

  async function reenviarInvitacion(emp: any) {
    if (!emp.email) { showToast('Este empleado no tiene email registrado'); return; }
    try {
      const res = await fetch('/api/invite-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emp.email, nombre: emp.nombre, rol: emp.rol, empresa_id: empresa.id }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Error al reenviar'); return; }
      showToast(`Invitación reenviada a ${emp.email}`);
    } catch {
      showToast('Error de conexión');
    }
  }

  async function changeRol(id: string, rol: string) {
    await supabase.from('profesionales').update({ rol }).eq('id', id);
    setEmpleados(prev => prev.map(e => e.id === id ? { ...e, rol } : e));
  }

  async function toggleActivo(emp: any) {
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
      {loading ? (
        <p style={{ color: C.textDim, fontSize:13 }}>Cargando...</p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {empleados.map(emp => {
            const isMe = emp.id === profesionalActual?.id;
            const isExpanded = expandedEmp === emp.id;
            const currentTab = expandedTab[emp.id] || 'horario';
            return (
              <div key={emp.id} style={{ borderRadius:12, overflow:'hidden', border: isMe ? `1px solid ${C.green}33` : `1px solid ${C.border}`, opacity: emp.activo ? 1 : 0.55 }}>
                <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 0 : 12, padding: isMobile ? 0 : '12px 14px', background: C.panelAlt }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding: isMobile ? '12px 14px' : 0, flex: isMobile ? undefined : 1, minWidth:0 }}>
                    <div style={{ width:36, height:36, borderRadius:9, background: emp.color || C.panelAlt, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff', flexShrink:0, border:`1px solid ${C.border}` }}>
                      {emp.nombre?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <p style={{ fontSize:13, fontWeight:600, color: C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.nombre}</p>
                        {isMe && <span style={{ fontSize:9, color: C.green, fontWeight:700, background: C.greenDim, padding:'1px 6px', borderRadius:4 }}>TÚ</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:10, color: rolColor(emp.rol), fontWeight:700, textTransform:'uppercase' as const, letterSpacing:0.5 }}>{rolLabel(emp.rol)}</span>
                        {!emp.activo && <span style={{ fontSize:9, color: C.amber, fontWeight:700 }}>INACTIVO</span>}
                      </div>
                    </div>
                  </div>
                  {!isMe && (
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' as const, padding: isMobile ? '8px 14px 12px' : 0, borderTop: isMobile ? `1px solid ${C.border}` : 'none', flexShrink:0 }}>
                      <button onClick={() => toggleEmp(emp.id, 'horario')}
                        style={{ padding: isMobile ? '6px 10px' : '5px 8px', borderRadius:7, border:`1px solid ${isExpanded && currentTab === 'horario' ? C.green+'66' : C.border}`, background: isExpanded && currentTab === 'horario' ? C.greenDim : 'transparent', cursor:'pointer', color: isExpanded && currentTab === 'horario' ? C.green : C.textDim, fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                        <Clock size={12}/> Horario
                      </button>
                      <button onClick={() => toggleEmp(emp.id, 'permisos')}
                        style={{ padding: isMobile ? '6px 10px' : '5px 8px', borderRadius:7, border:`1px solid ${isExpanded && currentTab === 'permisos' ? C.green+'66' : C.border}`, background: isExpanded && currentTab === 'permisos' ? C.greenDim : 'transparent', cursor:'pointer', color: isExpanded && currentTab === 'permisos' ? C.green : C.textDim, fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                        <Shield size={12}/> Permisos
                      </button>
                      <button onClick={() => reenviarInvitacion(emp)}
                        style={{ padding: isMobile ? '6px 10px' : '5px 8px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', cursor:'pointer', color: C.amber, fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                        <Mail size={12}/> Reenviar
                      </button>
                      <select value={emp.rol} onChange={e => changeRol(emp.id, e.target.value)}
                        style={{ padding: isMobile ? '6px 10px' : '5px 8px', background: C.panel, border:`1px solid ${C.border}`, borderRadius:7, color: C.textMid, fontSize:11, cursor:'pointer', outline:'none' }}>
                        <option value="empleado">Empleado</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button onClick={() => toggleActivo(emp)}
                        style={{ padding: isMobile ? '6px 10px' : '5px 8px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', cursor:'pointer', color: emp.activo ? C.green : C.textDim, fontSize:11, fontWeight:600 }}>
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </button>
                      {confirmDel === emp.id ? (
                        <div style={{ display:'flex', gap:4 }}>
                          <button onClick={() => eliminar(emp.id)} style={{ padding:'5px 9px', borderRadius:7, border:'none', background: C.red, color:'#fff', cursor:'pointer', fontSize:11, fontWeight:700 }}>Eliminar</button>
                          <button onClick={() => setConfirmDel(null)} style={{ padding:'5px 9px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', color: C.textMid, cursor:'pointer', fontSize:11 }}>No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(emp.id)}
                          style={{ padding: isMobile ? '6px 10px' : '5px 8px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', cursor:'pointer', color: C.textDim, display:'flex', alignItems:'center' }}>
                          <Trash2 size={13}/>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isExpanded && currentTab === 'horario' && empHorarios[emp.id] && (
                  <div style={{ padding:'14px', borderTop:`1px solid ${C.border}`, background: C.panel }}>
                    <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:12 }}>Horario de {emp.nombre}</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                      <div><p style={{ fontSize:11, color: C.textMid, marginBottom:5 }}>Apertura</p><input type="time" value={empHorarios[emp.id].apertura} onChange={e => updateHorario(emp.id, 'apertura', e.target.value)} style={{ width:'100%', padding:'8px 10px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:8, color: C.text, fontSize:13, outline:'none', boxSizing:'border-box' as const }}/></div>
                      <div><p style={{ fontSize:11, color: C.textMid, marginBottom:5 }}>Cierre</p><input type="time" value={empHorarios[emp.id].cierre} onChange={e => updateHorario(emp.id, 'cierre', e.target.value)} style={{ width:'100%', padding:'8px 10px', background: C.panelAlt, border:`1px solid ${C.border}`, borderRadius:8, color: C.text, fontSize:13, outline:'none', boxSizing:'border-box' as const }}/></div>
                    </div>
                    <div style={{ background: C.panelAlt, borderRadius:10, overflow:'hidden', marginBottom:10, border: empHorarios[emp.id].pausaActiva ? `1px solid ${C.green}33` : `1px solid ${C.border}` }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', cursor:'pointer' }} onClick={() => updateHorario(emp.id, 'pausaActiva', !empHorarios[emp.id].pausaActiva)}>
                        <div><p style={{ fontSize:12, fontWeight:600, color: C.text }}>Turno partido</p><p style={{ fontSize:10, color: C.textDim }}>{empHorarios[emp.id].pausaActiva ? `Pausa de ${empHorarios[emp.id].pausaInicio} a ${empHorarios[emp.id].pausaFin}` : 'Activa si tiene pausa al mediodía'}</p></div>
                        <div style={{ width:36, height:20, borderRadius:10, background: empHorarios[emp.id].pausaActiva ? C.green : C.border, position:'relative', transition:'background 0.2s' }}><div style={{ position:'absolute', top:2, left: empHorarios[emp.id].pausaActiva ? 18 : 2, width:16, height:16, borderRadius:8, background:'#fff', transition:'left 0.2s' }}/></div>
                      </div>
                      {empHorarios[emp.id].pausaActiva && (
                        <div style={{ padding:'0 12px 12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                          <div><p style={{ fontSize:11, color: C.textMid, marginBottom:5 }}>Inicio pausa</p><input type="time" value={empHorarios[emp.id].pausaInicio} onChange={e => updateHorario(emp.id, 'pausaInicio', e.target.value)} style={{ width:'100%', padding:'8px 10px', background: C.panel, border:`1px solid ${C.border}`, borderRadius:8, color: C.text, fontSize:13, outline:'none', boxSizing:'border-box' as const }}/></div>
                          <div><p style={{ fontSize:11, color: C.textMid, marginBottom:5 }}>Fin pausa</p><input type="time" value={empHorarios[emp.id].pausaFin} onChange={e => updateHorario(emp.id, 'pausaFin', e.target.value)} style={{ width:'100%', padding:'8px 10px', background: C.panel, border:`1px solid ${C.border}`, borderRadius:8, color: C.text, fontSize:13, outline:'none', boxSizing:'border-box' as const }}/></div>
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize:11, color: C.textDim, fontWeight:700, letterSpacing:1, textTransform:'uppercase' as const, marginBottom:8 }}>Días laborables</p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginBottom:12 }}>
                      {DIAS_LABELS.map((d, i) => {
                        const idx = DIAS_IDX2[i];
                        const active = (empHorarios[emp.id].dias || []).includes(idx);
                        return (
                          <button key={d} onClick={() => { const dias = empHorarios[emp.id].dias || []; updateHorario(emp.id, 'dias', active ? dias.filter((x: number) => x !== idx) : [...dias, idx]); }}
                            style={{ padding:'8px 2px', borderRadius:8, border:'none', cursor:'pointer', background: active ? C.greenDim : C.panelAlt, outline: active ? `2px solid ${C.green}55` : 'none' }}>
                            <span style={{ fontSize:10, fontWeight:700, color: active ? C.green : C.textDim }}>{d}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => saveHorario(emp.id)} disabled={savingHorario === emp.id}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:9, border:'none', background: C.green, color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, opacity: savingHorario === emp.id ? 0.7 : 1 }}>
                      <Check size={13}/> {savingHorario === emp.id ? 'Guardando...' : 'Guardar horario'}
                    </button>
                  </div>
                )}

                {isExpanded && currentTab === 'permisos' && empPermisos[emp.id] && (
                  <div style={{ padding:'14px', borderTop:`1px solid ${C.border}`, background: C.panel }}>
                    <div style={{ marginBottom:14 }}>
                      <p style={{ fontSize:11, fontWeight:700, color: C.textDim, letterSpacing:1, textTransform:'uppercase' as const }}>Permisos de {emp.nombre}</p>
                      <p style={{ fontSize:11, color: C.textDim, marginTop:3 }}>Ver y gestionar agenda propia siempre están activos</p>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
                      {PERMISOS_DEF.map(p => (
                        <div key={p.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background: C.panelAlt, borderRadius:10, gap:12 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:13, fontWeight:600, color: C.text }}>{p.label}</p>
                            <p style={{ fontSize:11, color: C.textDim, marginTop:2 }}>{p.desc}</p>
                          </div>
                          <Toggle value={empPermisos[emp.id][p.key] || false} onChange={v => updatePermiso(emp.id, p.key, v)}/>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => savePermisos(emp.id)} disabled={savingPermisos === emp.id}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:9, border:'none', background: C.green, color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, opacity: savingPermisos === emp.id ? 0.7 : 1 }}>
                      <Check size={13}/> {savingPermisos === emp.id ? 'Guardando...' : 'Guardar permisos'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ background: C.panelAlt, borderRadius:12, padding:16 }}>
        <p style={{ fontSize:13, fontWeight:700, color: C.text, marginBottom:14 }}>Añadir empleado</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><p style={{ fontSize:11, color: C.textMid, fontWeight:600, marginBottom:5 }}>NOMBRE *</p><Input value={invNombre} onChange={setInvNombre} placeholder="Nombre"/></div>
            <div><p style={{ fontSize:11, color: C.textMid, fontWeight:600, marginBottom:5 }}>EMAIL</p><Input value={invEmail} onChange={setInvEmail} placeholder="email@..." type="email"/></div>
          </div>
          <div><p style={{ fontSize:11, color: C.textMid, fontWeight:600, marginBottom:5 }}>ROL</p><Select value={invRol} onChange={setInvRol} options={[{ value:'empleado', label:'Empleado' },{ value:'admin', label:'Administrador' }]}/></div>
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
  empresa: empresaProp, profesional: profesionalProp, isAdmin = false, onEmpresaUpdated,
}: {
  empresa: any;
  profesional: any;
  isAdmin?: boolean;
  onEmpresaUpdated?: (data: any) => void;
}) {
  const tabs = isAdmin ? ADMIN_TABS : EMPLOYEE_TABS;
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [empresa, setEmpresa] = useState<any>(empresaProp);
  const [profesionalActual, setProfesionalActual] = useState<any>(profesionalProp);
  const [toast, setToast] = useState('');
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (empresaProp) setEmpresa(empresaProp);
  }, [empresaProp]);

  useEffect(() => {
    if (profesionalProp) setProfesionalActual(profesionalProp);
  }, [profesionalProp]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500); }

  function handleSaved(tab: string, data: any) {
    if (tab === 'miperfil') {
      setProfesionalActual((prev: any) => ({ ...prev, ...data }));
      showToast('Perfil actualizado');
      return;
    }
    const merged = { ...empresa, ...data };
    setEmpresa(merged);
    onEmpresaUpdated?.(merged);
    showToast('Cambios guardados');
  }

  if (!empresa) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color: C.textDim }}>
      Cargando configuración...
    </div>
  );

  function renderTabContent(id: string) {
    switch (id) {
      case 'miperfil':  return <TabMiPerfil profesional={profesionalActual} onSaved={d => handleSaved('miperfil', d)}/>;
      case 'empresa':   return <TabEmpresa empresa={empresa} onSaved={d => handleSaved('empresa', d)}/>;
      case 'horario':   return <TabHorario empresa={empresa} onSaved={d => handleSaved('horario', d)}/>;
      case 'dias':      return <TabDias    empresa={empresa} onSaved={d => handleSaved('dias', d)}/>;
      case 'empleados': return <TabEmpleados empresa={empresa} profesionalActual={profesionalActual}/>;
      default: return null;
    }
  }

  const headerTitle = isAdmin ? 'Configuración' : 'Mi perfil';
  const headerSubtitle = isAdmin ? empresa?.nombre : profesionalActual?.nombre || '';

  return (
    <div style={{ background: C.bg, color: C.text }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ background: C.panel, borderBottom:`1px solid ${C.border}`, padding:'16px 20px', flexShrink:0 }}>
        <h2 style={{ fontSize:18, fontWeight:700 }}>{headerTitle}</h2>
        <p style={{ fontSize:12, color: C.textMid, marginTop:2 }}>{headerSubtitle}</p>
      </div>

      {/* DESKTOP */}
      <div style={{ maxWidth:900, margin:'0 auto', padding:24, gap:24, alignItems:'flex-start', display: isMobile ? 'none' : 'flex' }}>
        {tabs.length > 1 && (
          <div style={{ width:200, flexShrink:0, display:'flex', flexDirection:'column', gap:2 }}>
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, border:'none', cursor:'pointer', background: active ? C.greenDim : 'transparent', color: active ? C.green : C.textMid, fontWeight: active ? 600 : 400, fontSize:13, borderLeft: active ? `3px solid ${C.green}` : '3px solid transparent', transition:'all 0.12s', textAlign:'left' as const }}>
                  <Icon size={15} style={{ flexShrink:0 }}/>
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ flex:1, background: C.panel, borderRadius:16, padding:24, minWidth:0, paddingBottom:40 }}>
          {renderTabContent(activeTab)}
        </div>
      </div>

      {/* MOBILE */}
      <div style={{ padding:'12px 16px 80px', flexDirection:'column', gap:6, display: isMobile ? 'flex' : 'none' }}>
        {tabs.length === 1 ? (
          <div style={{ background: C.panel, borderRadius:14, padding:16 }}>
            {renderTabContent(tabs[0].id)}
          </div>
        ) : (
          tabs.map(tab => {
            const open = mobileOpen === tab.id;
            const Icon = tab.icon;
            return (
              <div key={tab.id} style={{ background: C.panel, borderRadius:14, overflow:'hidden', border:`1px solid ${open ? C.green+'33' : C.border}` }}>
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
          })
        )}
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast('')}/>}
    </div>
  );
}
