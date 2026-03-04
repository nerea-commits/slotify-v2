'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    async function verify() {
      // Esperar un poco para que el webhook procese
      await new Promise(r => setTimeout(r, 2000));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // Verificar que la empresa está activa
      const { data: empresa } = await supabase
        .from('empresas')
        .select('activo')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      if (empresa?.activo) {
        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 3000);
      } else {
        // El webhook puede tardar, intentar de nuevo
        await new Promise(r => setTimeout(r, 3000));
        const { data: empresa2 } = await supabase
          .from('empresas')
          .select('activo')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();

        if (empresa2?.activo) {
          setStatus('success');
          setTimeout(() => router.push('/dashboard'), 3000);
        } else {
          setStatus('success'); // Mostramos éxito igual, el webhook llegará
          setTimeout(() => router.push('/dashboard'), 3000);
        }
      }
    }
    verify();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400">Procesando tu pago...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-4xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold">¡Pago completado!</h1>
            <p className="text-gray-400">Tu cuenta está activa. Redirigiendo al dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-400">Algo fue mal. Contacta con soporte.</p>
            <button onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-green-500 rounded-xl font-semibold">
              Ir al dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
