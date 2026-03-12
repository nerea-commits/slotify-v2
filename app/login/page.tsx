'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Profesional, Empresa } from '@/lib/utils';
import { Shield, Lock, ChevronRight, Mail } from 'lucide-react';

type LoginStep = 'email' | 'profiles' | 'pin';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selectedProf, setSelectedProf] = useState<Profesional | null>(null);
  const [pin, setPin] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Si viene de "Cambiar perfil", forzar selector
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

  async function loadEmpresaAndProfiles(userId: string, forceProfiles: boolean = false) {
    // 1. Intentar como admin
    const { data: emp } = await supabase
      .from('empresas')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (emp) {
      setEmpresa(emp as Empresa);
      localStorage.setItem('slotify_empresa_id', emp.id);
      const { data: profs } = await supabase
        .from('profesionales')
        .select('*')
        .eq('empresa_id', emp.id);
      setProfesionales((profs || []) as Profesional[]);

      // Si viene de "Cambiar perfil" → mostrar selector siempre
      if (forceProfiles) {
        setStep('profiles');
        setLoading(false);
        return;
      }

      // Si ya tiene perfil guardado → ir al dashboard
      const pidLS = localStorage.getItem('slotify_profesional_id');
      if (pidLS) {
        router.push('/dashboard');
        return;
      }

      // Sin perfil guardado → mostrar selector
      setStep('profiles');
      setLoading(false);
      return;
    }

    // 2. Intentar como empleado
    const { data: prof } = await supabase
      .from('profesionales')
      .select('*, empresas(*)')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (prof && prof.empresas) {
      const empData = prof.empresas as any;
      setEmpresa(empData as Empresa);
      localStorage.setItem('slotify_empresa_id', prof.empresa_id);
      localStorage.setItem('slotify_profesional_id', prof.id);
      localStorage.setItem('slotify_rol', prof.rol);
      router.push('/dashboard');
      return;
    }

    router.push('/register');
  }

  async function handleEmailLogin() {
    if (!email || !password) { setError('Introduce email y contraseña'); return; }
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(
        authError.message.includes('Invalid login')
          ? 'Email o contraseña incorrectos'
          : authError.message
      );
      setLoading(false);
      return;
    }

    if (data.user) {
      await loadEmpresaAndProfiles(data.user.id, false);
    }
  }

  function handleSelectProfile(prof: Profesional) {
    if (prof.rol === 'admin' || prof.pin) {
      setSelectedProf(prof);
      setStep('pin');
      setPin('');
      setError('');
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">

      {/* PASO 1: Email + Contraseña */}
      {step === 'email' && (
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Slotify</h1>
            <p className="text-gray-400 text-sm mt-2">Inicia sesión en tu negocio</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email</label>
              <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                type="email" placeholder="tu@email.com" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEmailLogin(); }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contraseña</label>
              <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                type="password" placeholder="Tu contraseña" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEmailLogin(); }}
              />
            </div>
            <div className="text-right">
              <a href="/login?reset=1" className="text-xs text-gray-400 hover:text-green-400 hover:underline transition-colors">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button onClick={handleEmailLogin} disabled={loading}
              className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
              Entrar
            </button>
            <p className="text-center text-sm text-gray-400">
              ¿No tienes cuenta?{' '}
              <a href="/register" className="text-green-400 hover:underline">Crear negocio</a>
            </p>
          </div>
        </div>
      )}

      {/* PASO 2: Selector de perfiles */}
      {step === 'profiles' && (
        <div className="w-full max-w-sm space-y-6">
          <h1 className="text-xl font-bold text-center">{empresa?.nombre || 'Slotify'}</h1>
          <p className="text-gray-400 text-sm text-center">¿Quién eres?</p>
          <div className="space-y-3">
            {profesionales.map(p => (
              <button key={p.id} onClick={() => handleSelectProfile(p)}
  className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-4 transition-all">
  <div className="flex items-center gap-3">
    <div style={{
      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
      background: (p as any).foto_url ? 'transparent' : ((p as any).color || '#22C55E'),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, fontWeight: 800, color: '#fff',
      overflow: 'hidden',
    }}>
      {(p as any).foto_url
        ? <img src={(p as any).foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        : p.nombre?.[0]?.toUpperCase() || '?'
      }
    </div>
    <div style={{ textAlign: 'left' }}>
      <span className="font-medium">{p.nombre}</span>
      {p.rol === 'admin' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Shield className="w-3 h-3" style={{ color: '#FBBF24' }}/>
          <span style={{ fontSize: 11, color: '#FBBF24', fontWeight: 600 }}>Admin</span>
        </div>
      )}
    </div>
  </div>
  <div className="flex items-center gap-2">
    {(p.rol === 'admin' || p.pin) && <Lock className="w-4 h-4 text-gray-500" />}
    <ChevronRight className="w-4 h-4 text-gray-500" />
  </div>
</button>
            ))}
          </div>
        </div>
      )}

      {/* PASO 3: PIN */}
      {step === 'pin' && selectedProf && (
        <div className="w-full max-w-sm space-y-4">
          <p className="text-gray-400 text-sm text-center">PIN de {selectedProf.nombre}</p>
          <input type="password" maxLength={4} value={pin}
            onChange={e => setPin(e.target.value)}
            className="w-full bg-gray-800 rounded-xl px-4 py-3 text-center text-2xl tracking-widest outline-none focus:ring-2 focus:ring-green-500"
            placeholder="····" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handlePin(); }}
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button onClick={handlePin}
            className="w-full py-3 bg-green-500 hover:bg-green-400 rounded-xl font-semibold text-sm">
            Entrar
          </button>
          <button onClick={() => { setStep('profiles'); setSelectedProf(null); setError(''); }}
            className="w-full text-gray-400 text-sm hover:underline">← Volver</button>
        </div>
      )}
    </div>
  );
}
