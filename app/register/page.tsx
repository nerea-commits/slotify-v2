'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Check, ArrowLeft, Building2, User, Lock } from 'lucide-react';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_IDX    = [1, 2, 3, 4, 5, 6, 0];

// ── TOKENS (idénticos al login) ─────────────────────────────────────────
const T = {
  bg:          '#07090F',
  bgCard:      'linear-gradient(160deg,#0F1826 0%,#0A0E1A 100%)',
  bgInput:     '#0E1520',
  bgInputFoc:  '#111B2C',
  gold:        '#C9A96E',
  goldDim:     'rgba(201,169,110,0.12)',
  goldBorder:  'rgba(201,169,110,0.22)',
  goldGlow:    'rgba(201,169,110,0.08)',
  textPrimary: '#F1F5F9',
  textSec:     '#8899AA',
  textDim:     '#3D4A5C',
  border:      'rgba(255,255,255,0.06)',
  divider:     'linear-gradient(90deg,transparent,rgba(201,169,110,0.18),transparent)',
  red:         '#EF4444',
  redDim:      'rgba(239,68,68,0.08)',
  redBorder:   'rgba(239,68,68,0.18)',
  green:       '#22C55E',
  greenDim:    'rgba(34,197,94,0.12)',
  greenBorder: 'rgba(34,197,94,0.25)',
  r_sm:   10,
  r_md:   14,
  r_lg:   20,
  r_xl:   26,
  r_pill: 999,
};

// ── STEPS CONFIG ────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'Tu cuenta',  icon: Lock,      desc: 'Credenciales de acceso' },
  { num: 2, label: 'Tu negocio', icon: Building2,  desc: 'Datos del establecimiento' },
  { num: 3, label: 'Tu perfil',  icon: User,       desc: 'Perfil de administrador' },
];

// ── SUBCOMPONENTES ──────────────────────────────────────────────────────

function KnoaLogo({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size,
      borderRadius: Math.round(size * 0.28),
      background: `linear-gradient(135deg, ${T.gold} 0%, #A8813E 100%)`,
      boxShadow: `0 4px 20px rgba(201,169,110,0.35)`,
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: Math.round(size * 0.45),
        fontWeight: 900,
        color: '#07090F',
        letterSpacing: -1,
        fontFamily: 'Georgia, serif',
        lineHeight: 1,
        userSelect: 'none',
      }}>K</span>
    </div>
  );
}

function InputField({
  label, type = 'text', value, onChange, onKeyDown, placeholder, suffix, inputMode,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  suffix?: React.ReactNode;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 700, color: T.textDim,
        letterSpacing: 1.2, textTransform: 'uppercase' as const,
      }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={type} value={value} placeholder={placeholder}
          inputMode={inputMode}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: suffix ? '12px 44px 12px 14px' : '12px 14px',
            background: focused ? T.bgInputFoc : T.bgInput,
            border: `1px solid ${focused ? T.gold + '55' : 'rgba(148,163,184,0.1)'}`,
            borderRadius: T.r_md,
            color: T.textPrimary,
            fontSize: 14,
            boxSizing: 'border-box' as const,
            outline: 'none',
            boxShadow: focused ? `0 0 0 3px rgba(201,169,110,0.10)` : 'none',
            transition: 'all 0.15s ease',
          }}
        />
        {suffix && (
          <div style={{
            position: 'absolute', right: 12, top: '50%',
            transform: 'translateY(-50%)',
          }}>
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: T.redDim,
      border: `1px solid ${T.redBorder}`,
      borderRadius: T.r_sm,
    }}>
      <p style={{ fontSize: 13, color: T.red, margin: 0 }}>{msg}</p>
    </div>
  );
}

function GoldButton({ onClick, disabled, children }: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '13px',
        background: hov
          ? 'linear-gradient(135deg,#D4B47A,#C9A96E)'
          : 'linear-gradient(135deg,#C9A96E,#A8813E)',
        border: 'none',
        borderRadius: T.r_md,
        color: '#07090F',
        fontSize: 14, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        boxShadow: hov
          ? '0 6px 24px rgba(201,169,110,0.4)'
          : '0 2px 10px rgba(201,169,110,0.2)',
        transition: 'all 0.15s ease',
        letterSpacing: 0.2,
      }}>
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />;
}

// ── STEPPER ─────────────────────────────────────────────────────────────
function Stepper({ current }: { current: number }) {
  return (
    <div className="knoa-stepper" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 0, marginBottom: 6,
    }}>
      {STEPS.map((s, i) => {
        const done = current > s.num;
        const active = current === s.num;
        const Icon = s.icon;
        return (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Step circle */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              minWidth: 64,
            }}>
              <div style={{
                width: 36, height: 36,
                borderRadius: 12,
                background: done
                  ? T.gold
                  : active
                  ? T.goldDim
                  : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${done ? T.gold : active ? T.gold + '66' : 'rgba(148,163,184,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.25s ease',
                boxShadow: active ? `0 0 16px ${T.goldGlow}` : 'none',
              }}>
                {done ? (
                  <Check size={16} style={{ color: '#07090F', strokeWidth: 3 }} />
                ) : (
                  <Icon size={15} style={{
                    color: active ? T.gold : '#334155',
                    strokeWidth: active ? 2.2 : 1.5,
                  }} />
                )}
              </div>
              <span className="knoa-step-label" style={{
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: done ? T.gold : active ? T.textPrimary : '#334155',
                letterSpacing: 0.3, whiteSpace: 'nowrap',
                transition: 'color 0.2s',
              }}>{s.label}</span>
            </div>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div style={{
                width: 40, height: 1.5,
                background: done
                  ? T.gold
                  : `linear-gradient(90deg, ${active ? T.gold + '44' : 'rgba(148,163,184,0.08)'}, rgba(148,163,184,0.08))`,
                margin: '0 4px',
                marginBottom: 22, /* align with circles, not labels */
                borderRadius: 1,
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── PÁGINA PRINCIPAL ────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: Cuenta
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Step 2: Negocio
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('09:00');
  const [horarioFin, setHorarioFin] = useState('18:00');
  const [diasSeleccionados, setDiasSeleccionados] = useState<boolean[]>([true, true, true, true, true, false, false]);

  // Step 3: Admin
  const [adminNombre, setAdminNombre] = useState('');
  const [adminPin, setAdminPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleDia(i: number) {
    setDiasSeleccionados(prev => prev.map((v, idx) => idx === i ? !v : v));
  }

  function validateStep1() {
    if (!email.includes('@')) { setError('Introduce un email válido'); return false; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return false; }
    if (password !== passwordConfirm) { setError('Las contraseñas no coinciden'); return false; }
    setError('');
    return true;
  }

  function validateStep2() {
    if (!nombre.trim()) { setError('El nombre del negocio es obligatorio'); return false; }
    if (!diasSeleccionados.some(Boolean)) { setError('Selecciona al menos un día laborable'); return false; }
    setError('');
    return true;
  }

  async function handleSubmit() {
    if (!adminNombre.trim() || adminPin.length !== 4) {
      setError('Completa tu nombre y un PIN de 4 dígitos');
      return;
    }
    setLoading(true);
    setError('');

    const diasLaborables = DIAS_IDX.filter((_, i) => diasSeleccionados[i]);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      const userId = authData.user.id;

      const { data: emp, error: errEmp } = await supabase.from('empresas')
        .insert({
          nombre,
          telefono,
          horario_inicio: horarioInicio,
          horario_fin: horarioFin,
          dias_laborables: diasLaborables,
          auth_user_id: userId,
        })
        .select().single();
      if (errEmp) throw errEmp;

      const { data: admin, error: errAdmin } = await supabase.from('profesionales')
        .insert({
          nombre: adminNombre,
          rol: 'admin',
          pin: adminPin,
          empresa_id: emp.id,
          auth_user_id: userId,
        })
        .select().single();
      if (errAdmin) throw errAdmin;

      localStorage.setItem('slotify_empresa_id', emp.id);
      localStorage.setItem('slotify_profesional_id', admin.id);
      localStorage.setItem('slotify_rol', 'admin');

      router.push('/dashboard');
    } catch (e: any) {
      console.error('Error en registro:', e);
      if (e.message?.includes('already registered')) {
        setError('Este email ya está registrado. Prueba a iniciar sesión.');
      } else {
        setError(e.message || 'Error al registrar');
      }
    } finally {
      setLoading(false);
    }
  }

  const currentStep = STEPS[step - 1];

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(ellipse 90% 70% at 50% -5%, #141C2E 0%, ${T.bg} 65%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes fadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        .knoa-bg-grain::before {
          content: '';
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none; z-index: 0; opacity: 0.4;
        }
        /* Time inputs dark scheme */
        input[type="time"] {
          color-scheme: dark;
        }
        /* Responsive stepper */
        @media (max-width: 480px) {
          .knoa-stepper { gap: 0 !important; }
          .knoa-step-label { font-size: 9px !important; }
        }
      `}</style>

      {/* Grain */}
      <div className="knoa-bg-grain" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />

      {/* Glow ambiental */}
      <div style={{
        position: 'fixed',
        top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '60vw', height: '40vw',
        background: 'radial-gradient(ellipse, rgba(201,169,110,0.06) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480 }}>

        {/* ── Branding superior ── */}
        <div style={{ textAlign: 'center', marginBottom: 24, animation: 'fadeIn 0.3s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <KnoaLogo size={32} />
            <span style={{
              fontSize: 22, fontWeight: 800, color: T.textPrimary,
              letterSpacing: -0.8, fontFamily: 'Georgia, serif',
            }}>Knöa</span>
          </div>
          <p style={{
            fontSize: 13, color: T.textSec, margin: 0,
            letterSpacing: 0.1, lineHeight: 1.5,
          }}>
            Configura tu negocio en menos de 2 minutos
          </p>
        </div>

        {/* ── Stepper ── */}
        <div style={{ marginBottom: 20, animation: 'fadeIn 0.35s ease both' }}>
          <Stepper current={step} />
        </div>

        {/* ── Card formulario ── */}
        <div
          key={`step-${step}`}
          style={{
            background: T.bgCard,
            border: `1px solid ${T.goldBorder}`,
            borderRadius: T.r_xl,
            padding: '32px 28px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(201,169,110,0.06)',
            display: 'flex', flexDirection: 'column', gap: 18,
            animation: 'fadeUp 0.25s ease both',
          }}
        >

          {/* Card header */}
          <div style={{ marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <currentStep.icon size={16} style={{ color: T.gold, strokeWidth: 2 }} />
              <h2 style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary, margin: 0 }}>
                {currentStep.label}
              </h2>
            </div>
            <p style={{ fontSize: 13, color: T.textDim, margin: 0 }}>
              {currentStep.desc}
            </p>
          </div>

          <Divider />

          {/* ════════════════════════════════════════
              STEP 1: CUENTA
          ════════════════════════════════════════ */}
          {step === 1 && (<>
            <InputField
              label="Email"
              type="email"
              inputMode="email"
              value={email}
              onChange={setEmail}
              placeholder="tu@email.com"
            />

            <InputField
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              placeholder="Mínimo 6 caracteres"
              suffix={
                <button
                  onClick={() => setShowPassword(s => !s)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: T.textDim, display: 'flex', padding: 4,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.gold}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.textDim}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            <InputField
              label="Confirmar contraseña"
              type={showPasswordConfirm ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={setPasswordConfirm}
              placeholder="Repite la contraseña"
              onKeyDown={e => { if (e.key === 'Enter' && validateStep1()) setStep(2); }}
              suffix={
                <button
                  onClick={() => setShowPasswordConfirm(s => !s)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: T.textDim, display: 'flex', padding: 4,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.gold}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.textDim}
                >
                  {showPasswordConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            {error && <ErrorBox msg={error} />}

            <GoldButton onClick={() => { if (validateStep1()) setStep(2); }}>
              Siguiente
            </GoldButton>

            <Divider />

            <p style={{ textAlign: 'center', fontSize: 13, color: T.textDim, margin: 0 }}>
              ¿Ya tienes cuenta?{' '}
              <a href="/login" style={{
                color: T.gold, fontWeight: 600, textDecoration: 'none', transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => (e.target as HTMLElement).style.opacity = '0.75'}
                onMouseLeave={e => (e.target as HTMLElement).style.opacity = '1'}>
                Iniciar sesión
              </a>
            </p>
          </>)}

          {/* ════════════════════════════════════════
              STEP 2: NEGOCIO
          ════════════════════════════════════════ */}
          {step === 2 && (<>
            <InputField
              label="Nombre del negocio *"
              value={nombre}
              onChange={setNombre}
              placeholder="Mi peluquería"
            />

            <InputField
              label="Teléfono"
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={setTelefono}
              placeholder="612 345 678"
            />

            {/* Horario: grid 2 cols */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: T.textDim,
                  letterSpacing: 1.2, textTransform: 'uppercase' as const,
                }}>Apertura</label>
                <input
                  type="time" value={horarioInicio}
                  onChange={e => setHorarioInicio(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: T.bgInput,
                    border: `1px solid rgba(148,163,184,0.1)`,
                    borderRadius: T.r_md,
                    color: T.textPrimary, fontSize: 14,
                    boxSizing: 'border-box' as const, outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = T.gold + '55'; e.currentTarget.style.background = T.bgInputFoc; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; e.currentTarget.style.background = T.bgInput; }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: T.textDim,
                  letterSpacing: 1.2, textTransform: 'uppercase' as const,
                }}>Cierre</label>
                <input
                  type="time" value={horarioFin}
                  onChange={e => setHorarioFin(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: T.bgInput,
                    border: `1px solid rgba(148,163,184,0.1)`,
                    borderRadius: T.r_md,
                    color: T.textPrimary, fontSize: 14,
                    boxSizing: 'border-box' as const, outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = T.gold + '55'; e.currentTarget.style.background = T.bgInputFoc; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)'; e.currentTarget.style.background = T.bgInput; }}
                />
              </div>
            </div>

            {/* Días laborables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{
                fontSize: 11, fontWeight: 700, color: T.textDim,
                letterSpacing: 1.2, textTransform: 'uppercase' as const,
              }}>Días laborables *</label>

              {/* Quick presets */}
              <div style={{ display: 'flex', gap: 6 }}>
                {['Lun–Vie', 'Todos'].map((label, i) => (
                  <button key={label} type="button"
                    onClick={() => setDiasSeleccionados(i === 0
                      ? [true, true, true, true, true, false, false]
                      : [true, true, true, true, true, true, true]
                    )}
                    style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '5px 12px', borderRadius: T.r_pill,
                      border: `1px solid ${T.goldBorder}`,
                      background: 'transparent',
                      color: T.gold,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.goldDim; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Day toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {DIAS_SEMANA.map((dia, i) => {
                  const sel = diasSeleccionados[i];
                  return (
                    <button key={dia} type="button" onClick={() => toggleDia(i)}
                      style={{
                        padding: '10px 2px',
                        borderRadius: T.r_sm,
                        border: `1.5px solid ${sel ? T.gold + '66' : 'rgba(148,163,184,0.08)'}`,
                        cursor: 'pointer',
                        background: sel ? T.goldDim : 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                        transition: 'all 0.15s',
                      }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: sel ? T.gold : '#334155',
                      }}>{dia}</span>
                      <span style={{
                        fontSize: 8, fontWeight: 600,
                        color: sel ? T.gold : '#1E293B',
                      }}>
                        {sel ? 'Abierto' : 'Cerrado'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!diasSeleccionados.some(Boolean) && (
                <p style={{ fontSize: 12, color: '#F59E0B', margin: '2px 0 0' }}>
                  ⚠ Selecciona al menos un día
                </p>
              )}
            </div>

            {error && <ErrorBox msg={error} />}

            <GoldButton onClick={() => { if (validateStep2()) setStep(3); }}>
              Siguiente
            </GoldButton>

            <button
              onClick={() => { setError(''); setStep(1); }}
              style={{
                background: 'none', border: 'none',
                color: T.textDim, fontSize: 13,
                cursor: 'pointer', padding: '6px 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'color 0.15s', width: '100%',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.gold}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.textDim}
            >
              <ArrowLeft size={14} /> Volver
            </button>
          </>)}

          {/* ════════════════════════════════════════
              STEP 3: PERFIL ADMIN
          ════════════════════════════════════════ */}
          {step === 3 && (<>
            <InputField
              label="Tu nombre (administrador)"
              value={adminNombre}
              onChange={setAdminNombre}
              placeholder="Nombre del administrador"
            />

            {/* PIN input estilizado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                fontSize: 11, fontWeight: 700, color: T.textDim,
                letterSpacing: 1.2, textTransform: 'uppercase' as const,
              }}>PIN de acceso (4 dígitos)</label>
              <PinInputRegister
                value={adminPin}
                onChange={v => setAdminPin(v.replace(/\D/g, ''))}
                onEnter={handleSubmit}
              />
              <p style={{ fontSize: 11, color: T.textDim, margin: '2px 0 0' }}>
                Lo usarás para acceder a tu perfil cada día
              </p>
            </div>

            {/* Resumen del negocio */}
            <div style={{
              padding: '12px 14px',
              background: 'rgba(201,169,110,0.04)',
              border: `1px solid ${T.goldBorder}`,
              borderRadius: T.r_sm,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: T.textDim, letterSpacing: 0.8, textTransform: 'uppercase' as const, margin: 0 }}>
                Resumen
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>
                  <span style={{ color: T.gold, fontWeight: 600 }}>{nombre || '—'}</span>
                  {telefono && <span> · {telefono}</span>}
                </p>
                <p style={{ fontSize: 11, color: T.textDim, margin: 0 }}>
                  {horarioInicio} – {horarioFin} · {diasSeleccionados.filter(Boolean).length} días/semana
                </p>
              </div>
            </div>

            {error && <ErrorBox msg={error} />}

            <GoldButton onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creando tu negocio...' : 'Crear mi negocio'}
            </GoldButton>

            <button
              onClick={() => { setError(''); setStep(2); }}
              style={{
                background: 'none', border: 'none',
                color: T.textDim, fontSize: 13,
                cursor: 'pointer', padding: '6px 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                transition: 'color 0.15s', width: '100%',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.gold}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.textDim}
            >
              <ArrowLeft size={14} /> Volver
            </button>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ── PIN INPUT REGISTRO ──────────────────────────────────────────────────
function PinInputRegister({ value, onChange, onEnter }: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="password"
      maxLength={4}
      inputMode="numeric"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onEnter()}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="· · · ·"
      style={{
        width: '100%',
        padding: '14px',
        background: focused ? T.bgInputFoc : T.bgInput,
        border: `1px solid ${focused ? T.gold + '55' : 'rgba(148,163,184,0.1)'}`,
        borderRadius: T.r_md,
        color: T.textPrimary,
        fontSize: 26,
        textAlign: 'center' as const,
        letterSpacing: 14,
        outline: 'none',
        boxSizing: 'border-box' as const,
        boxShadow: focused ? `0 0 0 3px rgba(201,169,110,0.10)` : 'none',
        transition: 'all 0.15s ease',
      }}
    />
  );
}
