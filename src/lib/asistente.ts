import { supabase } from './supabase'

export type RolAsistente = 'user' | 'assistant'

export interface MensajeHistorial {
  id: string
  conversacion_id: string
  rol: RolAsistente
  contenido: string
  created_at: string
}

const MAX_HISTORIAL = 50

async function usuarioActual(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/**
 * Carga los últimos 50 mensajes de la conversación más reciente del usuario.
 * Devuelve `null` si la tabla todavía no existe o no se pudo consultar, para
 * que el asistente siga funcionando sin historial.
 */
export async function cargarHistorialAsistente(): Promise<MensajeHistorial[] | null> {
  if (!supabase) return null
  const userId = await usuarioActual()
  if (!userId) return null

  const { data, error } = await supabase
    .from('asistente_mensajes')
    .select('id, conversacion_id, rol, contenido, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORIAL)
  if (error) return null

  const filas = (data ?? []) as MensajeHistorial[]
  const ultimaConversacion = filas[0]?.conversacion_id
  if (!ultimaConversacion) return []
  return filas.filter((fila) => fila.conversacion_id === ultimaConversacion).reverse()
}

/** Guarda un mensaje del usuario o del asistente. false si no se pudo guardar. */
export async function guardarMensajeAsistente(datos: {
  conversacionId: string
  rol: RolAsistente
  contenido: string
}): Promise<boolean> {
  if (!supabase) return false
  const userId = await usuarioActual()
  if (!userId) return false

  const { error } = await supabase.from('asistente_mensajes').insert({
    user_id: userId,
    conversacion_id: datos.conversacionId,
    rol: datos.rol,
    contenido: datos.contenido,
  })
  return !error
}

/** Borra todo el historial del usuario autenticado. */
export async function borrarHistorialAsistente(): Promise<boolean> {
  if (!supabase) return false
  const userId = await usuarioActual()
  if (!userId) return false

  const { error } = await supabase.from('asistente_mensajes').delete().eq('user_id', userId)
  return !error
}
