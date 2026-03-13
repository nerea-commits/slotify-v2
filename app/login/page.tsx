'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Profesional, Empresa } from '@/lib/utils';
import { Lock, ChevronRight, Eye, EyeOff, CheckCircle2, BellRing, CalendarCheck } from 'lucide-react';

type LoginStep = 'email' | 'profiles' | 'pin';

// ── TOKENS ──────────────────────────────────────────────────────────────
const T = {
  // Fondos
  bg:          '#07090F',
  bgCard:      'linear-gradient(160deg,#0F1826 0%,#0A0E1A 100%)',
  bgCardHov:   'rgba(201,169,110,0.06)',
  bgInput:     '#0E1520',
  bgInputFoc:  '#111B2C',

  // Marca
  gold:        '#C9A96E',
  goldDim:     'rgba(201,169,110,0.12)',
  goldBorder:  'rgba(201,169,110,0.22)',
  goldGlow:    'rgba(201,169,110,0.08)',

  // Texto
  textPrimary: '#F1F5F9',
  textSec:     '#8899AA',
  textDim:     '#3D4A5C',

  // Superficies
  border:      'rgba(255,255,255,0.06)',
  borderHov:   'rgba(201,169,110,0.28)',
  divider:     'linear-gradient(90deg,transparent,rgba(201,169,110,0.18),transparent)',

  // Estados
  red:         '#EF4444',
  redDim:      'rgba(239,68,68,0.08)',
  redBorder:   'rgba(239,68,68,0.18)',

  // Radios
  r_sm:   10,
  r_md:   14,
  r_lg:   20,
  r_xl:   26,
  r_pill: 999,
};

const BENEFITS = [
  { icon: CalendarCheck,  text: 'Agenda inteligente' },
  { icon: BellRing,       text: 'Recordatorios automáticos' },
  { icon: CheckCircle2,   text: 'Confirmación por WhatsApp' },
];

// ── SUBCOMPONENTES ───────────────────────────────────────────────────────

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
  label, type = 'text', value, onChange, onKeyDown, placeholder, suffix
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  suffix?: React.ReactNode;
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

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selectedProf, setSelectedProf] = useState<Profesional | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const forceSelect = localStorage.getItem('slotify_select_profile');
        if (forceSelect) {
          localStorage.removeItem('slotify_select_profile');
          await loadEmpresaAndProfiles(session.user.id, true);
        } else {
          await loadEmpresaAndProfiles(session.user.id, false);
        }
      } else {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  async function loadEmpresaAndProfiles(userId: string, forceProfiles = false) {
    const { data: emp } = await supabase
      .from('empresas').select('*').eq('auth_user_id', userId).maybeSingle();
    if (emp) {
      setEmpresa(emp as Empresa);
      localStorage.setItem('slotify_empresa_id', emp.id);
      const { data: profs } = await supabase
        .from('profesionales').select('*').eq('empresa_id', emp.id);
      setProfesionales((profs || []) as Profesional[]);
      if (forceProfiles) { setStep('profiles'); setLoading(false); return; }
      if (localStorage.getItem('slotify_profesional_id')) { router.push('/dashboard'); return; }
      setStep('profiles'); setLoading(false); return;
    }
    const { data: prof } = await supabase
      .from('profesionales').select('*, empresas(*)').eq('auth_user_id', userId).maybeSingle();
    if (prof?.empresas) {
      setEmpresa(prof.empresas as any);
      localStorage.setItem('slotify_empresa_id', prof.empresa_id);
      localStorage.setItem('slotify_profesional_id', prof.id);
      localStorage.setItem('slotify_rol', prof.rol);
      router.push('/dashboard'); return;
    }
    router.push('/register');
  }

  async function handleEmailLogin() {
    if (!email || !password) { setError('Introduce email y contraseña'); return; }
    setLoading(true); setError('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message.includes('Invalid login') ? 'Email o contraseña incorrectos' : authError.message);
      setLoading(false); return;
    }
    if (data.user) await loadEmpresaAndProfiles(data.user.id, false);
  }

  function handleSelectProfile(prof: Profesional) {
    if (prof.rol === 'admin' || prof.rol === 'owner' || prof.pin) {
      setSelectedProf(prof); setStep('pin'); setPin(''); setError('');
    } else {
      localStorage.setItem('slotify_profesional_id', prof.id);
      localStorage.setItem('slotify_rol', prof.rol);
      router.push('/dashboard');
    }
  }

  function handlePin() {
    if (!selectedProf) return;
    if (pin === selectedProf.pin) {
      localStorage.setItem('slotify_profesional_id', selectedProf.id);
      localStorage.setItem('slotify_rol', selectedProf.rol);
      router.push('/dashboard');
    } else {
      setError('PIN incorrecto');
    }
  }

  // ── LOADING ──
  if (loading) return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 36, height: 36,
        border: `2px solid ${T.goldDim}`,
        borderTopColor: T.gold,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

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
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes fadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        /* Grain overlay sutil */
        .knoa-bg-grain::before {
          content: '';
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none; z-index: 0; opacity: 0.4;
        }
        .pcard { outline: none; }
        .pcard:focus-visible {
          outline: 2px solid ${T.gold};
          outline-offset: 3px;
          border-radius: 16px;
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

      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>

        {/* ══════════════════════════════════════════════════════
            STEP: EMAIL
        ══════════════════════════════════════════════════════ */}
        {step === 'email' && (
          <div style={{
            width: '100%', maxWidth: 440,
            animation: 'fadeUp 0.35s ease both',
          }}>

            {/* Branding superior */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              {/* Logo + nombre */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
                <KnoaLogo size={36} />
                <span style={{
                  fontSize: 26, fontWeight: 800, color: T.textPrimary,
                  letterSpacing: -0.8, fontFamily: 'Georgia, serif',
                }}>Knöa</span>
              </div>

              {/* Claim */}
              <h1 style={{
                fontSize: 15, fontWeight: 500,
                color: T.textSec,
                margin: '0 0 20px',
                letterSpacing: 0.1,
                lineHeight: 1.5,
              }}>
                Organiza tu agenda, automatiza recordatorios<br />y reduce ausencias desde el primer día.
              </h1>

              {/* Microbeneficios */}
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                gap: 6, flexWrap: 'wrap' as const,
                justifyContent: 'center',
              }}>
                {BENEFITS.map(({ icon: Icon, text }) => (
                  <div key={text} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px',
                    background: T.goldDim,
                    border: `1px solid ${T.goldBorder}`,
                    borderRadius: T.r_pill,
                    fontSize: 11, fontWeight: 600, color: T.gold,
                    whiteSpace: 'nowrap' as const,
                  }}>
                    <Icon size={11} />
                    {text}
                  </div>
                ))}
              </div>
            </div>

            {/* Card formulario */}
            <div style={{
              background: T.bgCard,
              border: `1px solid ${T.goldBorder}`,
              borderRadius: T.r_xl,
              padding: '36px 32px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(201,169,110,0.06)',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              <div style={{ marginBottom: 2 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary, margin: '0 0 3px' }}>
                  Accede a tu panel
                </h2>
                <p style={{ fontSize: 13, color: T.textDim, margin: 0 }}>
                  Introduce tus credenciales para continuar
                </p>
              </div>

              <InputField
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                placeholder="tu@email.com"
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <InputField
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={setPassword}
                  onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                  placeholder="Tu contraseña"
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
                <div style={{ textAlign: 'right', marginTop: 2 }}>
                  <a href="/login?reset=1" style={{
                    fontSize: 12, color: T.textDim, textDecoration: 'none', transition: 'color 0.15s',
                  }}
                    onMouseEnter={e => (e.target as HTMLElement).style.color = T.gold}
                    onMouseLeave={e => (e.target as HTMLElement).style.color = T.textDim}>
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              </div>

              {error && <ErrorBox msg={error} />}

              <GoldButton onClick={handleEmailLogin} disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </GoldButton>

              <Divider />

              <p style={{ textAlign: 'center', fontSize: 13, color: T.textDim, margin: 0 }}>
                ¿Sin cuenta?{' '}
                <a href="/register" style={{
                  color: T.gold, fontWeight: 600, textDecoration: 'none', transition: 'opacity 0.15s',
                }}
                  onMouseEnter={e => (e.target as HTMLElement).style.opacity = '0.75'}
                  onMouseLeave={e => (e.target as HTMLElement).style.opacity = '1'}>
                  Registra tu negocio
                </a>
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP: PERFILES
        ══════════════════════════════════════════════════════ */}
        {step === 'profiles' && (
          <div style={{
            width: '100%', maxWidth: 520,
            animation: 'fadeUp 0.35s ease both',
          }}>
            <div style={{
              background: T.bgCard,
              border: `1px solid ${T.goldBorder}`,
              borderRadius: T.r_xl + 2,
              padding: '44px 40px',
              boxShadow: '0 48px 120px rgba(0,0,0,0.75), inset 0 1px 0 rgba(201,169,110,0.06)',
            }}>

              {/* Header negocio */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                marginBottom: 32, textAlign: 'center' as const,
              }}>
                {/* Logo o inicial */}
                {(empresa as any)?.logo_url ? (
                  <img
                    src={(empresa as any).logo_url}
                    alt={empresa?.nombre}
                    style={{
                      maxHeight: 72, maxWidth: 180,
                      width: 'auto', height: 'auto',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.6))',
                      marginBottom: 14,
                    }}
                  />
                ) : (
                  <div style={{
                    width: 68, height: 68,
                    borderRadius: T.r_lg,
                    background: T.goldDim,
                    border: `1px solid ${T.goldBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, fontWeight: 800, color: T.gold,
                    marginBottom: 14,
                    boxShadow: `0 4px 20px ${T.goldGlow}`,
                  }}>
                    {empresa?.nombre?.[0]?.toUpperCase() || 'K'}
                  </div>
                )}

                {/* Nombre negocio con pill */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px',
                  background: T.goldDim,
                  border: `1px solid ${T.goldBorder}`,
                  borderRadius: T.r_pill,
                  marginBottom: 12,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 0.3 }}>
                    {empresa?.nombre || 'Tu negocio'}
                  </span>
                </div>

                <h1 style={{
                  fontSize: 22, fontWeight: 700, color: T.textPrimary,
                  margin: '0 0 6px', letterSpacing: -0.3,
                }}>
                  Selecciona tu perfil
                </h1>
                <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>
                  Elige el usuario con el que vas a trabajar hoy
                </p>
              </div>

              <Divider />
              <div style={{ height: 20 }} />

              {/* Lista de perfiles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {profesionales.map(p => {
                  const isAdmin = p.rol === 'admin' || p.rol === 'owner';
                  const isProtected = isAdmin || !!p.pin;
                  const isHov = hoveredId === p.id;
                  const foto = (p as any).foto_url;
                  const avatarColor = (p as any).color || '#3B82F6';
                  const rolLabel = p.rol === 'owner' ? 'Propietario' : p.rol === 'admin' ? 'Administrador' : 'Empleado';

                  return (
                    <button
                      key={p.id}
                      className="pcard"
                      onClick={() => handleSelectProfile(p)}
                      onMouseEnter={() => setHoveredId(p.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 16px',
                        background: isHov ? T.bgCardHov : 'rgba(255,255,255,0.025)',
                        border: `1px solid ${isHov ? T.borderHov : T.border}`,
                        borderRadius: T.r_lg,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        transform: isHov ? 'translateY(-1px)' : 'none',
                        boxShadow: isHov ? '0 8px 24px rgba(0,0,0,0.35)' : 'none',
                        textAlign: 'left' as const,
                      }}>

                      {/* Avatar */}
                      <div style={{
                        width: 46, height: 46,
                        borderRadius: 12, flexShrink: 0,
                        background: foto ? '#0A0E1A' : avatarColor,
                        overflow: 'hidden', position: 'relative',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        border: `1px solid rgba(255,255,255,0.06)`,
                      }}>
                        {foto
                          ? <img src={foto} alt={p.nombre} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: '#fff' }}>
                              {p.nombre?.[0]?.toUpperCase()}
                            </div>
                        }
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 15, fontWeight: 700, color: T.textPrimary,
                          margin: '0 0 4px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                        }}>
                          {p.nombre}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                          {/* Rol */}
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: isAdmin ? T.gold : T.textSec,
                            letterSpacing: 0.2,
                          }}>
                            {rolLabel}
                          </span>
                          {/* Badge PIN */}
                          {isProtected && (
                            <>
                              <span style={{ fontSize: 10, color: T.textDim }}>·</span>
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                padding: '2px 6px',
                                background: 'rgba(201,169,110,0.08)',
                                border: `1px solid rgba(201,169,110,0.2)`,
                                borderRadius: T.r_pill,
                              }}>
                                <Lock size={9} style={{ color: T.gold }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: T.gold }}>PIN</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Chevron */}
                      <div style={{
                        width: 32, height: 32,
                        borderRadius: 9, flexShrink: 0,
                        background: isHov ? T.goldDim : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isHov ? T.goldBorder : T.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        <ChevronRight size={14} style={{
                          color: isHov ? T.gold : T.textDim,
                          transition: 'color 0.15s',
                        }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            STEP: PIN
        ══════════════════════════════════════════════════════ */}
        {step === 'pin' && selectedProf && (
          <div style={{
            width: '100%', maxWidth: 380,
            animation: 'fadeUp 0.3s ease both',
          }}>
            <div style={{
              background: T.bgCard,
              border: `1px solid ${T.goldBorder}`,
              borderRadius: T.r_xl,
              padding: '40px 32px',
              boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 0,
            }}>
              {/* Avatar */}
              <div style={{
                width: 58, height: 58,
                borderRadius: 15,
                background: (selectedProf as any).foto_url ? '#0A0E1A' : ((selectedProf as any).color || T.gold),
                overflow: 'hidden',
                border: `1px solid ${T.goldBorder}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                marginBottom: 12,
                position: 'relative', flexShrink: 0,
              }}>
                {(selectedProf as any).foto_url
                  ? <img src={(selectedProf as any).foto_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>
                      {selectedProf.nombre?.[0]?.toUpperCase()}
                    </div>
                }
              </div>

              <p style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary, margin: '0 0 4px' }}>
                {selectedProf.nombre}
              </p>
              <p style={{ fontSize: 12, color: T.gold, fontWeight: 600, margin: '0 0 24px', letterSpacing: 0.3 }}>
                Introduce tu PIN para acceder
              </p>

              <Divider />
              <div style={{ height: 22, width: '100%' }} />

              {/* Input PIN */}
              <PinInput
                value={pin}
                onChange={setPin}
                onEnter={handlePin}
              />

              <div style={{ height: 14, width: '100%' }} />

              {error && (
                <div style={{ width: '100%', marginBottom: 14 }}>
                  <ErrorBox msg={error} />
                </div>
              )}

              <GoldButton onClick={handlePin}>Entrar</GoldButton>

              <button
                onClick={() => { setStep('profiles'); setSelectedProf(null); setError(''); }}
                style={{
                  background: 'none', border: 'none',
                  color: T.textDim, fontSize: 13,
                  cursor: 'pointer', padding: '10px 8px 0',
                  transition: 'color 0.15s',
                  width: '100%',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.gold}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.textDim}
              >
                ← Volver a perfiles
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── PIN INPUT ────────────────────────────────────────────────────────────
function PinInput({ value, onChange, onEnter }: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="password"
      maxLength={6}
      value={value}
      autoFocus
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onEnter()}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="· · · ·"
      style={{
        width: '100%',
        padding: '15px',
        background: focused ? T.bgInputFoc : T.bgInput,
        border: `1px solid ${focused ? T.gold + '55' : 'rgba(148,163,184,0.1)'}`,
        borderRadius: T.r_md,
        color: T.textPrimary,
        fontSize: 28,
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
