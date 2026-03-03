import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verificar que el que llama es superadmin
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

  // Traer todas las empresas con conteo de profesionales
  const { data: empresas, error } = await supabaseAdmin
    .from('empresas')
    .select(`
      id, nombre, email, telefono, created_at, activo, is_superadmin,
      profesionales(count)
    `)
    .eq('is_superadmin', false)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ empresas })
}

export async function PATCH(req: Request) {
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

  const { empresa_id, activo } = await req.json()
  if (!empresa_id || activo === undefined) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('empresas')
    .update({ activo })
    .eq('id', empresa_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
