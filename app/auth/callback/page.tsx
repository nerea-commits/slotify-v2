'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function handleAuth() {
      // Supabase pone el token en el hash de la URL
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        // Parsear los params del hash
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setError('Error al procesar la invitación');
            setLoading(false);
            return;
          }

          // Si es invite o recovery, mostrar formulario de contraseña
          if (type === 'invite' || type === 'recovery' || type === 'magiclink') {
            setNeedsPassword(true);
            setLoading(false);
            return;
          }
        }
      }

      // Si no hay token o no necesita contraseña, ir al login
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setNeedsPassword(true);
        setLoading(false);
      } else {
        router.push('/login');
      }
    }
    handleAuth();
  }, []);

  async function handleSetPassword() {
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSaving(true);
    setError('');

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // Cerrar sesión para que entre limpio por login
    await supabase.auth.signOut();
    setDone(true);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white">Procesando invitación...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div style={{ fontSize: 48 }}>✓</div>
          <h1 className="text-xl font-bold">¡Contraseña creada!</h1>
          <p className="text-gray-400 text-sm">Ya puedes iniciar sesión con tu email y contraseña.</p>
          <button onClick={() => router.push('/login')}
            className="w-full py-3 bg-green-500 hover:bg-green-400 rounded-xl font-semibold text-sm">
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Crea tu contraseña</h1>
            <p className="text-gray-400 text-sm mt-2">Elige una contraseña para acceder a tu cuenta</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contraseña</label>
              <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                type="password" placeholder="Mínimo 6 caracteres" value={password}
                onChange={e => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Confirmar contraseña</label>
              <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                type="password" placeholder="Repite la contraseña" value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSetPassword(); }} />
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button onClick={handleSetPassword} disabled={saving}
              className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 rounded-xl font-semibold text-sm">
              {saving ? 'Guardando...' : 'Crear contraseña'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
