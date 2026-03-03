'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: Cuenta
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Step 2: Negocio
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('09:00');
  const [horarioFin, setHorarioFin] = useState('18:00');

  // Step 3: Admin
  const [adminNombre, setAdminNombre] = useState('');
  const [adminPin, setAdminPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function validateStep1() {
    if (!email.includes('@')) { setError('Introduce un email válido'); return false; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return false; }
    if (password !== passwordConfirm) { setError('Las contraseñas no coinciden'); return false; }
    setError('');
    return true;
  }

  function validateStep2() {
    if (!nombre.trim()) { setError('El nombre del negocio es obligatorio'); return false; }
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

    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      const userId = authData.user.id;

      // 2. Crear empresa vinculada al usuario auth
      const { data: emp, error: errEmp } = await supabase.from('empresas')
        .insert({
          nombre,
          telefono,
          horario_inicio: horarioInicio,
          horario_fin: horarioFin,
          auth_user_id: userId,
        })
        .select().single();
      if (errEmp) throw errEmp;

     // 3. Crear profesional admin
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

      // 4. Guardar en localStorage para compatibilidad con el sistema actual
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

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Crear negocio</h1>
          <p className="text-gray-400 text-sm mt-2">
            Paso {step} de 3 — {step === 1 ? 'Tu cuenta' : step === 2 ? 'Tu negocio' : 'Tu perfil'}
          </p>
          {/* Indicador de progreso */}
          <div className="flex gap-2 mt-4 justify-center">
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                width: 40, height: 4, borderRadius: 2,
                background: s <= step ? '#22C55E' : '#374151',
              }} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email</label>
              <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                type="email" placeholder="tu@email.com" value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>
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
                onChange={e => setPasswordConfirm(e.target.value)} />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={() => { if (validateStep1()) setStep(2); }}
              className="w-full py-3 bg-green-500 hover:bg-green-400 rounded-xl font-semibold text-sm">
              Siguiente
            </button>
            <p className="text-center text-sm text-gray-400">
              ¿Ya tienes cuenta?{' '}
              <a href="/login" className="text-green-400 hover:underline">Iniciar sesión</a>
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre del negocio</label>
              <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Mi peluquería" value={nombre}
                onChange={e => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Teléfono</label>
              <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                placeholder="612 345 678" value={telefono}
                onChange={e => setTelefono(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Apertura</label>
                <input type="time" className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                  value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Cierre</label>
                <input type="time" className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                  value={horarioFin} onChange={e => setHorarioFin(e.target.value)} />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={() => { if (validateStep2()) setStep(3); }}
              className="w-full py-3 bg-green-500 hover:bg-green-400 rounded-xl font-semibold text-sm">
              Siguiente
            </button>
            <button onClick={() => setStep(1)}
              className="w-full text-gray-400 text-sm hover:underline">← Volver</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tu nombre (administrador)</label>
              <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Nombre del admin" value={adminNombre}
                onChange={e => setAdminNombre(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">PIN de acceso (4 dígitos)</label>
              <input className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-center text-2xl tracking-widest outline-none focus:ring-2 focus:ring-green-500"
                placeholder="····" maxLength={4} value={adminPin}
                onChange={e => setAdminPin(e.target.value.replace(/\D/g, ''))} />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleSubmit} disabled={loading}
              className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 rounded-xl font-semibold text-sm">
              {loading ? 'Creando...' : 'Crear mi negocio'}
            </button>
            <button onClick={() => setStep(2)}
              className="w-full text-gray-400 text-sm hover:underline">← Volver</button>
          </div>
        )}
      </div>
    </div>
  );
}
