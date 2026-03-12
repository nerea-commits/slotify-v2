'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Profesional, Empresa } from '@/lib/utils';
import { Lock, ChevronRight, Eye, EyeOff } from 'lucide-react';

type LoginStep = 'email' | 'profiles' | 'pin';

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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#07090F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: '2px solid rgba(201,169,110,0.2)', borderTopColor: '#C9A96E', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 80% 60% at 50% -10%, #141C2E 0%, #07090F 70%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .pcard:focus-visible{outline:2px solid #C9A96E;outline-offset:3px;border-radius:16px}
        .linput:focus{border-color:#C9A96E !important;box-shadow:0 0 0 3px rgba(201,169,110,0.14) !important;outline:none}
      `}</style>

      {/* ── EMAIL ── */}
      {step === 'email' && (
        <div style={{ width: '100%', maxWidth: 420, animation: 'up 0.3s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#F1F5F9', margin: '0 0 6px', letterSpacing: -0.5 }}>Bienvenido</h1>
            <p style={{ fontSize: 14, color: '#4B5563', margin: 0 }}>Accede al panel de gestión</p>
          </div>
          <div style={{ background: 'linear-gradient(160deg,#0F1826,#0A0E1A)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 22, padding: '36px 32px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: 1, textTransform: 'uppercase' as const }}>Email</label>
              <input className="linput" type="email" value={email} placeholder="tu@email.com"
                onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                style={{ width: '100%', padding: '12px 14px', background: '#131B2B', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 12, color: '#F1F5F9', fontSize: 14, boxSizing: 'border-box' as const, transition: 'all 0.15s' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: 1, textTransform: 'uppercase' as const }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input className="linput" type={showPassword ? 'text' : 'password'} value={password} placeholder="Tu contraseña"
                  onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                  style={{ width: '100%', padding: '12px 44px 12px 14px', background: '#131B2B', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 12, color: '#F1F5F9', fontSize: 14, boxSizing: 'border-box' as const, transition: 'all 0.15s' }} />
                <button onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#374151', display: 'flex', padding: 4 }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'right', marginTop: -8 }}>
              <a href="/login?reset=1" style={{ fontSize: 12, color: '#4B5563', textDecoration: 'none' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = '#C9A96E'}
                onMouseLeave={e => (e.target as HTMLElement).style.color = '#4B5563'}>
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10 }}>
              <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{error}</p>
            </div>}
            <button onClick={handleEmailLogin} disabled={loading}
              style={{ padding: '13px', background: 'linear-gradient(135deg,#C9A96E,#A8813E)', border: 'none', borderRadius: 12, color: '#07090F', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              Entrar
            </button>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#374151', margin: 0 }}>
              ¿Sin cuenta?{' '}<a href="/register" style={{ color: '#C9A96E', fontWeight: 600, textDecoration: 'none' }}>Crear negocio</a>
            </p>
          </div>
        </div>
      )}

      {/* ── PERFILES ── */}
      {step === 'profiles' && (
        <div style={{ width: '100%', maxWidth: 520, animation: 'up 0.3s ease' }}>
          <div style={{
            background: 'linear-gradient(170deg,#0E1724 0%,#090D18 100%)',
            border: '1px solid rgba(201,169,110,0.22)',
            borderRadius: 28,
            padding: '52px 44px',
            boxShadow: '0 48px 120px rgba(0,0,0,0.75), inset 0 1px 0 rgba(201,169,110,0.06)',
          }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, marginBottom: 38 }}>

              {/* Logo */}
              {(empresa as any)?.logo_url ? (
                <div style={{ marginBottom: 20 }}>
                  <img
                    src={(empresa as any).logo_url}
                    alt={empresa?.nombre}
                    style={{
                      maxHeight: 96, maxWidth: 200,
                      width: 'auto', height: 'auto',
                      objectFit: 'contain', display: 'block',
                      filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.7))',
                    }}
                  />
                </div>
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 22, background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: '#C9A96E', marginBottom: 20 }}>
                  {empresa?.nombre?.[0]?.toUpperCase() || 'B'}
                </div>
              )}

              {/* Nombre de marca */}
              <p style={{
                fontSize: 20, fontWeight: 700, color: '#E2C97E',
                margin: '0 0 10px', letterSpacing: 0.2,
                textShadow: '0 2px 12px rgba(201,169,110,0.2)',
              }}>
                {empresa?.nombre || 'Tu negocio'}
              </p>

              {/* Título acción */}
              <h1 style={{ fontSize: 26, fontWeight: 700, color: '#F1F5F9', margin: '0 0 7px', letterSpacing: -0.4, textAlign: 'center' as const }}>
                Selecciona tu perfil
              </h1>

              {/* Subtítulo */}
              <p style={{ fontSize: 14, color: '#8899AA', margin: 0, fontWeight: 400, textAlign: 'center' as const }}>
                Elige un usuario para continuar
              </p>
            </div>

            {/* Divisor */}
            <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(201,169,110,0.18),transparent)', marginBottom: 30 }} />

            {/* ── CARDS ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {profesionales.map(p => {
                const isAdmin = p.rol === 'admin' || p.rol === 'owner';
                const isProtected = isAdmin || !!p.pin;
                const isHov = hoveredId === p.id;
                const foto = (p as any).foto_url;
                const avatarColor = (p as any).color || '#3B82F6';

                return (
                  <button key={p.id} className="pcard"
                    onClick={() => handleSelectProfile(p)}
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                      padding: '16px 18px',
                      background: isHov ? 'rgba(201,169,110,0.07)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isHov ? 'rgba(201,169,110,0.28)' : 'rgba(255,255,255,0.05)'}`,
                      borderRadius: 16, cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      transform: isHov ? 'translateY(-2px)' : 'none',
                      boxShadow: isHov ? '0 10px 28px rgba(0,0,0,0.4)' : 'none',
                      textAlign: 'left' as const,
                    }}>

                    {/* Avatar */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 13, flexShrink: 0,
                      background: foto ? '#0A0E1A' : avatarColor,
                      overflow: 'hidden', position: 'relative',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
                    }}>
                      {foto
                        ? <img src={foto} alt={p.nombre} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>
                            {p.nombre?.[0]?.toUpperCase()}
                          </div>
                      }
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#F1F5F9', margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {p.nombre}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {isProtected && <Lock size={10} style={{ color: '#C9A96E', flexShrink: 0 }} />}
                        <span style={{ fontSize: 12, color: isProtected ? '#C9A96E' : '#4B5563', fontWeight: isProtected ? 600 : 400, lineHeight: 1.3 }}>
                          {isAdmin ? 'Administrador · Requiere PIN' : p.pin ? 'Acceso protegido · Requiere PIN' : 'Empleado'}
                        </span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      background: isHov ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isHov ? 'rgba(201,169,110,0.22)' : 'rgba(255,255,255,0.06)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      <ChevronRight size={15} style={{ color: isHov ? '#C9A96E' : '#2D3748', transition: 'color 0.15s' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PIN ── */}
      {step === 'pin' && selectedProf && (
        <div style={{ width: '100%', maxWidth: 400, animation: 'up 0.3s ease' }}>
          <div style={{
            background: 'linear-gradient(170deg,#0E1724,#090D18)',
            border: '1px solid rgba(201,169,110,0.22)',
            borderRadius: 26, padding: '44px 36px',
            boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: (selectedProf as any).foto_url ? '#0A0E1A' : ((selectedProf as any).color || '#C9A96E'), overflow: 'hidden', border: '1px solid rgba(201,169,110,0.25)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', marginBottom: 14, position: 'relative', flexShrink: 0 }}>
              {(selectedProf as any).foto_url
                ? <img src={(selectedProf as any).foto_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>{selectedProf.nombre?.[0]?.toUpperCase()}</div>
              }
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', margin: '0 0 5px' }}>{selectedProf.nombre}</p>
            <p style={{ fontSize: 12, color: '#C9A96E', fontWeight: 600, margin: '0 0 30px', letterSpacing: 0.3 }}>Introduce tu PIN para continuar</p>
            <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(201,169,110,0.18),transparent)', width: '100%', marginBottom: 24 }} />
            <input className="linput" type="password" maxLength={6} value={pin} autoFocus
              onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePin()}
              placeholder="· · · ·"
              style={{ width: '100%', padding: '15px', background: '#131B2B', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 12, color: '#F1F5F9', fontSize: 28, textAlign: 'center' as const, letterSpacing: 14, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 14, transition: 'all 0.15s' }} />
            {error && <div style={{ width: '100%', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, marginBottom: 14 }}>
              <p style={{ fontSize: 13, color: '#EF4444', margin: 0, textAlign: 'center' as const }}>{error}</p>
            </div>}
            <button onClick={handlePin}
              style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg,#C9A96E,#A8813E)', border: 'none', borderRadius: 12, color: '#07090F', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
              Entrar
            </button>
            <button onClick={() => { setStep('profiles'); setSelectedProf(null); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#374151', fontSize: 13, cursor: 'pointer', padding: '8px', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#C9A96E'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#374151'}>
              ← Volver a perfiles
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
