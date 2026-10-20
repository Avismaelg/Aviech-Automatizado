import { supabase } from './supabase'

let resultado: boolean | null = null

/**
 * Comprueba si la migración 009 (columna `crm_empresas.descartada`) ya está
 * aplicada. Se cachea durante la sesión para no repetir la consulta.
 */
export async function soportaDescartadas(): Promise<boolean> {
  if (resultado !== null) return resultado
  if (!supabase) return false
  const { error } = await supabase.from('crm_empresas').select('descartada').limit(1)
  resultado = !error
  return resultado
}
