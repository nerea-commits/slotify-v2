export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: myEmpresa } = await supabaseAdmin
    .from('empresas')
    .select('is_superadmin')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!myEmpresa?.is_superadmin) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')
  if (!empresa_id) return NextResponse.json({ error: 'Falta empresa_id' }, { status: 400 })

  // Datos de la empresa
  const { data: empresa } = await supabaseAdmin
    .from('empresas')
    .select('*')
    .eq('id', empresa_id)
    .single()

  // Empleados
  const { data: profesionales } = await supabaseAdmin
    .from('profesionales')
    .select('id, nombre, rol, activo, auth_user_id, created_at')
    .eq('empresa_id', empresa_id)
    .order('created_at', { ascending: false })

  // Últimas 10 citas
  const { data: citas } = await supabaseAdmin
    .from('citas')
    .select('id, hora_inicio, hora_fin, estado, clientes(nombre), servicios(nombre), profesionales(nombre)')
    .eq('empresa_id', empresa_id)
    .order('hora_inicio', { ascending: false })
    .limit(10)

  // Conteo total de citas
  const { count: totalCitas } = await supabaseAdmin
    .from('citas')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresa_id)

  return NextResponse.json({ empresa, profesionales, citas, totalCitas })
}
