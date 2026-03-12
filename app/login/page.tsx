'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Profesional, Empresa } from '@/lib/utils';
import { Shield, Lock, ChevronRight, Eye, EyeOff } from 'lucide-react';

type LoginStep = 'email' | 'profiles' | 'pin';

const ACCENT = '#C9A96E';
const ACCENT_DIM = 'rgba(201,169,110,0.12)';
const ACCENT_BORDER = 'rgba(201,169,110,0.25)';

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
      const pidLS = localStorage.getItem('slotify_profesional_id');
      if (pidLS) { router.push('/dashboard'); return; }
      setStep('profiles'); setLoading(false); return;
    }

    const { data: prof } = await supabase
      .from('profesionales').select('*, empresas(*)').eq('auth_user_id', userId).maybeSingle();

    if (prof && prof.empresas) {
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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#080C14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${ACCENT_BORDER}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #12192A 0%, #080C14 65%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .profile-card:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 3px; border-radius: 14px; }
        .login-input:focus { border-color: ${ACCENT} !important; box-shadow: 0 0 0 3px ${ACCENT_DIM} !important; outline: none; }
      `}</style>

      {/* ── PASO 1: Email ── */}
      {step === 'email' && (
        <div style={{ width: '100%', maxWidth: 400, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#F1F5F9', margin: '0 0 6px', letterSpacing: -0.5 }}>Bienvenido</h1>
            <p style={{ fontSize: 14, color: '#4B5563', margin: 0 }}>Accede al panel de gestión</p>
          </div>

          <div style={{
            background: 'linear-gradient(160deg, #0F1826 0%, #0B1020 100%)',
            border: `1px solid ${ACCENT_BORDER}`,
            borderRadius: 20, padding: 32,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: 18,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: 1, textTransform: 'uppercase' as const }}>Email</label>
              <input className="login-input" type="email" value={email} placeholder="tu@email.com"
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEmailLogin(); }}
                style={{ width: '100%', padding: '12px 14px', background: '#1A2235', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 12, color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, transition: 'all 0.15s' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: 1, textTransform: 'uppercase' as const }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input className="login-input" type={showPassword ? 'text' : 'password'} value={password} placeholder="Tu contraseña"
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleEmailLogin(); }}
                  style={{ width: '100%', padding: '12px 42px 12px 14px', background: '#1A2235', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 12, color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, transition: 'all 0.15s' }}
                />
                <button onClick={() => setShowPassword(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', padding: 4, display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: -6 }}>
              <a href="/login?reset=1" style={{ fontSize: 12, color: '#4B5563', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = ACCENT}
                onMouseLeave={e => (e.target as HTMLElement).style.color = '#4B5563'}>
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
                <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{error}</p>
              </div>
            )}

            <button onClick={handleEmailLogin} disabled={loading}
              style={{ width: '100%', padding: '13px', background: `linear-gradient(135deg, ${ACCENT} 0%, #A8813E 100%)`, border: 'none', borderRadius: 12, color: '#0B0F1A', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 0.3, opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              Entrar
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#4B5563', margin: 0 }}>
              ¿Sin cuenta?{' '}
              <a href="/register" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>Crear negocio</a>
            </p>
          </div>
        </div>
      )}

      {/* ── PASO 2: Selector de perfiles ── */}
      {step === 'profiles' && (
        <div style={{ width: '100%', maxWidth: 440, animation: 'fadeIn 0.3s ease' }}>
          <div style={{
            background: 'linear-gradient(160deg, #0F1826 0%, #0B1020 100%)',
            border: `1px solid ${ACCENT_BORDER}`,
            borderRadius: 24,
            padding: '40px 32px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 1px 0 rgba(201,169,110,0.08) inset',
          }}>

            {/* Branding */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 32 }}>
              {(empresa as any)?.logo_url ? (
                <img
                  src={(empresa as any).logo_url}
                  alt={empresa?.nombre}
                  style={{ maxHeight: 76, maxWidth: '65%', objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.6))' }}
                />
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: 16, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: ACCENT }}>
                  {empresa?.nombre?.[0]?.toUpperCase() || 'B'}
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 2.5, textTransform: 'uppercase' as const, margin: '0 0 8px' }}>
                  {empresa?.nombre || 'Tu negocio'}
                </p>
                <h1 style={{ fontSize: 21, fontWeight: 700, color: '#F1F5F9', margin: '0 0 5px', letterSpacing: -0.3 }}>
                  Selecciona tu perfil
                </h1>
                <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                  Elige un usuario para continuar
                </p>
              </div>
            </div>

            {/* Separador decorativo */}
            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${ACCENT_BORDER}, transparent)`, marginBottom: 24 }} />

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {profesionales.map(p => {
                const isAdmin = p.rol === 'admin' || p.rol === 'owner';
                const isProtected = isAdmin || !!p.pin;
                const isHovered = hoveredId === p.id;
                const fotoUrl = (p as any).foto_url;
                const avatarColor = (p as any).color || '#3B82F6';

                return (
                  <button
                    key={p.id}
                    className="profile-card"
                    onClick={() => handleSelectProfile(p)}
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px',
                      background: isHovered ? 'rgba(201,169,110,0.06)' : 'rgba(255,255,255,0.025)',
                      border: `1px solid ${isHovered ? ACCENT_BORDER : 'rgba(148,163,184,0.06)'}`,
                      borderRadius: 14, cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      transform: isHovered ? 'translateY(-1px)' : 'none',
                      boxShadow: isHovered ? '0 6px 20px rgba(0,0,0,0.3)' : 'none',
                    }}>

                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: fotoUrl ? '#0B1020' : avatarColor,
                      overflow: 'hidden',
                      border: `1px solid rgba(255,255,255,0.05)`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                    }}>
                      {fotoUrl
                        ? <img src={fotoUrl} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: '#fff' }}>
                            {p.nombre?.[0]?.toUpperCase()}
                          </div>
                      }
                    </div>

                    {/* Texto */}
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', margin: '0 0 3px' }}>{p.nombre}</p>
                      <p style={{ fontSize: 11, color: isProtected ? ACCENT : '#374151', margin: 0, fontWeight: isProtected ? 600 : 400 }}>
                        {isAdmin
                          ? 'Administrador · Requiere PIN'
                          : p.pin
                            ? 'Acceso protegido · Requiere PIN'
                            : 'Empleado'}
                      </p>
                    </div>

                    {/* Icono derecha */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isProtected && (
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Lock size={12} style={{ color: ACCENT }} />
                        </div>
                      )}
                      <ChevronRight size={15} style={{ color: isHovered ? ACCENT : '#1F2937', transition: 'color 0.15s' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 3: PIN ── */}
      {step === 'pin' && selectedProf && (
        <div style={{ width: '100%', maxWidth: 380, animation: 'fadeIn 0.3s ease' }}>
          <div style={{
            background: 'linear-gradient(160deg, #0F1826 0%, #0B1020 100%)',
            border: `1px solid ${ACCENT_BORDER}`,
            borderRadius: 24, padding: '40px 32px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          }}>
            {/* Avatar */}
            <div style={{ width: 56, height: 56, borderRadius: 16, background: (selectedProf as any).foto_url ? '#0B1020' : ((selectedProf as any).color || ACCENT), overflow: 'hidden', border: `1px solid ${ACCENT_BORDER}`, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', marginBottom: 12 }}>
              {(selectedProf as any).foto_url
                ? <img src={(selectedProf as any).foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff' }}>{selectedProf.nombre?.[0]?.toUpperCase()}</div>
              }
            </div>

            <p style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>{selectedProf.nombre}</p>
            <p style={{ fontSize: 12, color: ACCENT, fontWeight: 600, margin: '0 0 28px' }}>Introduce tu PIN para continuar</p>

            <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${ACCENT_BORDER}, transparent)`, width: '100%', marginBottom: 24 }} />

            <input
              className="login-input"
              type="password" maxLength={6} value={pin} autoFocus
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePin(); }}
              placeholder="· · · ·"
              style={{ width: '100%', padding: '14px', background: '#1A2235', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 12, color: '#F1F5F9', fontSize: 26, textAlign: 'center' as const, letterSpacing: 12, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 14, transition: 'all 0.15s' }}
            />

            {error && (
              <div style={{ width: '100%', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: '#EF4444', margin: 0, textAlign: 'center' as const }}>{error}</p>
              </div>
            )}

            <button onClick={handlePin}
              style={{ width: '100%', padding: '13px', background: `linear-gradient(135deg, ${ACCENT} 0%, #A8813E 100%)`, border: 'none', borderRadius: 12, color: '#0B0F1A', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10, letterSpacing: 0.3 }}>
              Entrar
            </button>

            <button onClick={() => { setStep('profiles'); setSelectedProf(null); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#374151', fontSize: 13, cursor: 'pointer', padding: '8px', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = ACCENT}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#374151'}>
              ← Volver a perfiles
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
