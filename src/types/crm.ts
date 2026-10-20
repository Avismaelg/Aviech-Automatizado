// Tipos del CRM. Los campos con join (`crm_empresas`, `crm_contactos`,
// `crm_oportunidades`) llegan cuando la consulta los incluye con select(...).

export interface EmpresaCrm {
  id: string
  nombre: string
  dominio: string | null
  industria: string | null
  telefono: string | null
  sitio_web: string | null
  notas: string | null
  cliente_id: string | null
  /** true = empresa descartada; no volver a prospectar. */
  descartada: boolean
  created_at: string
}

export interface ContactoCrm {
  id: string
  empresa_id: string
  nombre: string
  cargo: string | null
  email: string | null
  telefono: string | null
  linkedin: string | null
  notas: string | null
  created_at: string
  crm_empresas?: { nombre: string } | null
}

export interface OportunidadCrm {
  id: string
  empresa_id: string | null
  contacto_id: string | null
  titulo: string
  etapa: string
  monto: number
  probabilidad: number
  fecha_cierre: string | null
  notas: string | null
  created_at: string
  updated_at: string
  crm_empresas?: { id: string; nombre: string; cliente_id: string | null } | null
  crm_contactos?: { nombre: string } | null
}

export interface ActividadCrm {
  id: string
  oportunidad_id: string | null
  contacto_id: string | null
  tipo: string
  titulo: string
  detalle: string | null
  fecha: string
  completada: boolean
  created_at: string
  crm_oportunidades?: { titulo: string; crm_empresas?: { nombre: string } | null } | null
  crm_contactos?: { nombre: string } | null
}
