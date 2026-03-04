import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, nombre, rol, empresa_id } = body

    if (!email || !nombre || !empresa_id) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Invitar usuario por email — Supabase envía email con enlace automáticamente
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          nombre,
          rol: rol || 'empleado',
          empresa_id,
        },
       redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://slotify-v2-vxnx.vercel.app'}/auth/callback`,
      })

    if (userError || !userData.user) {
      if (userError?.message?.includes('already been registered')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(u => u.email === email)

        if (existingUser) {
          const { data: existingProf } = await supabaseAdmin
            .from('profesionales')
            .select('id')
            .eq('auth_user_id', existingUser.id)
            .eq('empresa_id', empresa_id)
            .maybeSingle()

          if (existingProf) {
            return NextResponse.json(
              { error: 'Este email ya está registrado en tu empresa' },
              { status: 400 }
            )
          }

          const { error: profError } = await supabaseAdmin
            .from('profesionales')
            .insert({
              nombre,
              rol: rol || 'empleado',
              empresa_id,
              auth_user_id: existingUser.id,
          activo: true,
          email,
        })

          if (profError) {
            return NextResponse.json({ error: profError.message }, { status: 400 })
          }

          return NextResponse.json({
            success: true,
            message: 'Empleado vinculado (ya tenía cuenta)',
          })
        }
      }

      return NextResponse.json({ error: userError?.message }, { status: 400 })
    }

    const userId = userData.user.id

    const { error: profError } = await supabaseAdmin
      .from('profesionales')
      .insert({
        nombre,
        rol: rol || 'empleado',
        empresa_id,
        auth_user_id: userId,
          activo: true,
          email,
        })

    if (profError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Invitación enviada por email',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
