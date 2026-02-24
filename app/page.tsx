'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function Home() {
  const router = useRouter();
  useEffect(() => { router.push('/login'); }, [router]);
  return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-white">Cargando...</p></div>;
}
