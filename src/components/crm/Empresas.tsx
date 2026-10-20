import { Building2, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useAvisos } from '../../lib/avisos'
import { convertirEmpresaEnCliente } from '../../lib/crm'
import { ETAPAS_CRM_ABIERTAS } from '../../lib/etiquetas'
import { iniciales } from '../../lib/formato'
import type { EmpresaCrm } from '../../types/crm'
import {
  AreaTexto,
  Boton,
  BotonIcono,
  Campo,
  Confirmar,
  Entrada,
  ErrorTabla,
  FilasCargando,
  Insignia,
  Modal,
  Selector,
  Tarjeta,
  Vacio,
} from '../ui'
import type { PropsEmpresas } from './tipos'

interface FormularioEmpresa {
  nombre: string
  dominio: string
  industria: string
  telefono: string
  sitio_web: string
  notas: string
  descartada: boolean
}

type FiltroEmpresas = 'todas' | 'activas' | 'descartadas'

const FORMULARIO_VACIO: FormularioEmpresa = {
  nombre: '',
  dominio: '',
  industria: '',
  telefono: '',
  sitio_web: '',
  notas: '',
  descartada: false,
}

export function Empresas({ empresas, contactos, oportunidades, refrescar }: PropsEmpresas) {
  const aviso = useAvisos()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroEmpresas>('todas')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<FormularioEmpresa>(FORMULARIO_VACIO)
  const [porEliminar, setPorEliminar] = useState<EmpresaCrm | null>(null)
  const [porConvertir, setPorConvertir] = useState<EmpresaCrm | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [convirtiendo, setConvirtiendo] = useState(false)

  const contactosPorEmpresa = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const contacto of contactos) {
      mapa.set(contacto.empresa_id, (mapa.get(contacto.empresa_id) ?? 0) + 1)
    }
    return mapa
  }, [contactos])

  const oportunidadesPorEmpresa = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const oportunidad of oportunidades) {
      if (!oportunidad.empresa_id) continue
      if (!(ETAPAS_CRM_ABIERTAS as readonly string[]).includes(oportunidad.etapa)) continue
      mapa.set(oportunidad.empresa_id, (mapa.get(oportunidad.empresa_id) ?? 0) + 1)
    }
    return mapa
  }, [oportunidades])

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return empresas.filas.filter((empresa) => {
      if (filtro === 'activas' && empresa.descartada) return false
      if (filtro === 'descartadas' && !empresa.descartada) return false
      if (!texto) return true
      return [empresa.nombre, empresa.industria, empresa.dominio, empresa.sitio_web, empresa.telefono].some((valor) =>
        valor?.toLowerCase().includes(texto),
      )
    })
  }, [empresas.filas, busqueda, filtro])

  function abrirNuevo() {
    setEditandoId(null)
    setFormulario(FORMULARIO_VACIO)
    setModalAbierto(true)
  }

  function abrirEdicion(empresa: EmpresaCrm) {
    setEditandoId(empresa.id)
    setFormulario({
      nombre: empresa.nombre,
      dominio: empresa.dominio ?? '',
      industria: empresa.industria ?? '',
      telefono: empresa.telefono ?? '',
      sitio_web: empresa.sitio_web ?? '',
      notas: empresa.notas ?? '',
      descartada: Boolean(empresa.descartada),
    })
    setModalAbierto(true)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando || !formulario.nombre.trim()) return
    setGuardando(true)
    const guardado = await empresas.guardar(
      {
        nombre: formulario.nombre.trim(),
        dominio: formulario.dominio.trim() || null,
        industria: formulario.industria.trim() || null,
        telefono: formulario.telefono.trim() || null,
        sitio_web: formulario.sitio_web.trim() || null,
        notas: formulario.notas.trim() || null,
        descartada: formulario.descartada,
      },
      editandoId ?? undefined,
    )
    setGuardando(false)
    if (guardado) setModalAbierto(false)
  }

  async function eliminarEmpresa() {
    if (!porEliminar) return
    await empresas.eliminar(porEliminar.id)
    setPorEliminar(null)
    await refrescar()
  }

  async function convertir() {
    if (!porConvertir || convirtiendo) return
    setConvirtiendo(true)
    const contacto = contactos.find((fila) => fila.empresa_id === porConvertir.id) ?? null
    const resultado = await convertirEmpresaEnCliente(porConvertir, contacto)
    setConvirtiendo(false)
    if (!resultado.ok) {
      aviso(resultado.error ?? 'No se pudo convertir la empresa en cliente.', 'error')
      return
    }
    aviso(`${porConvertir.nombre} ahora es cliente`)
    setPorConvertir(null)
    await refrescar()
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-tenue" />
          <Entrada
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por nombre, industria o dominio…"
            className="pl-9"
          />
        </div>
        <Selector
          aria-label="Filtrar empresas"
          value={filtro}
          onChange={(evento) => setFiltro(evento.target.value as FiltroEmpresas)}
          className="sm:w-44"
        >
          <option value="todas">Todas</option>
          <option value="activas">Activas</option>
          <option value="descartadas">Descartadas</option>
        </Selector>
        <Boton onClick={abrirNuevo}>
          <Plus size={16} /> Nueva empresa
        </Boton>
      </div>

      <p aria-live="polite" className="sr-only">
        {filtradas.length} empresa{filtradas.length === 1 ? '' : 's'} en pantalla
      </p>

      <Tarjeta>
        {empresas.error && <ErrorTabla mensaje={empresas.error} />}
        {empresas.cargando && !empresas.error && <FilasCargando />}
        {!empresas.cargando && !empresas.error && filtradas.length === 0 && (
          empresas.filas.length === 0 ? (
            <Vacio
              icono={<Building2 size={22} />}
              titulo="Todavía no hay empresas"
              texto="Registra la primera empresa y sus contactos para empezar el pipeline."
              accion={
                <Boton variante="secundario" onClick={abrirNuevo}>
                  <Plus size={16} /> Nueva empresa
                </Boton>
              }
            />
          ) : (
            <Vacio
              icono={<Search size={22} />}
              titulo="Sin resultados"
              texto="Prueba otra búsqueda."
              accion={
                <Boton
                  variante="secundario"
                  onClick={() => {
                    setBusqueda('')
                    setFiltro('todas')
                  }}
                >
                  Limpiar filtros
                </Boton>
              }
            />
          )
        )}
        {!empresas.cargando && !empresas.error && filtradas.length > 0 && (
          <ul className="divide-y divide-borde-suave">
            {filtradas.map((empresa) => {
              const numContactos = contactosPorEmpresa.get(empresa.id) ?? 0
              const numOportunidades = oportunidadesPorEmpresa.get(empresa.id) ?? 0
              return (
                <li key={empresa.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-superficie-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                    {iniciales(empresa.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-tinta">{empresa.nombre}</p>
                      {empresa.cliente_id && <Insignia color="emerald">Cliente</Insignia>}
                      {empresa.descartada && <Insignia color="slate">Descartada</Insignia>}
                    </div>
                    <p className="truncate text-xs text-tinta-suave">
                      {[empresa.industria, empresa.dominio || empresa.sitio_web, empresa.telefono]
                        .filter(Boolean)
                        .join(' · ') || 'Sin datos de la empresa'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-tinta-tenue">
                      {numContactos} contacto{numContactos === 1 ? '' : 's'} · {numOportunidades} oportunidad
                      {numOportunidades === 1 ? '' : 'es'} abierta{numOportunidades === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {!empresa.cliente_id && (
                      <BotonIcono
                        etiqueta="Convertir en cliente"
                        onClick={() => setPorConvertir(empresa)}
                        className="hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <UserPlus size={15} />
                      </BotonIcono>
                    )}
                    <BotonIcono etiqueta="Editar" onClick={() => abrirEdicion(empresa)}>
                      <Pencil size={15} />
                    </BotonIcono>
                    <BotonIcono
                      etiqueta="Eliminar"
                      onClick={() => setPorEliminar(empresa)}
                      className="hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={15} />
                    </BotonIcono>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Tarjeta>

      <Modal
        abierto={modalAbierto}
        titulo={editandoId ? 'Editar empresa' : 'Nueva empresa'}
        onCerrar={() => setModalAbierto(false)}
      >
        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre *" className="sm:col-span-2">
            <Entrada
              required
              value={formulario.nombre}
              onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })}
              placeholder="Ej. Ferretería Pérez SRL"
            />
          </Campo>
          <Campo etiqueta="Dominio">
            <Entrada
              value={formulario.dominio}
              onChange={(evento) => setFormulario({ ...formulario, dominio: evento.target.value })}
              placeholder="ferreteriaperez.do"
            />
          </Campo>
          <Campo etiqueta="Industria">
            <Entrada
              value={formulario.industria}
              onChange={(evento) => setFormulario({ ...formulario, industria: evento.target.value })}
              placeholder="Ferretería, salud, legal…"
            />
          </Campo>
          <Campo etiqueta="Teléfono">
            <Entrada
              value={formulario.telefono}
              onChange={(evento) => setFormulario({ ...formulario, telefono: evento.target.value })}
              placeholder="809 555 1234"
            />
          </Campo>
          <Campo etiqueta="Sitio web">
            <Entrada
              value={formulario.sitio_web}
              onChange={(evento) => setFormulario({ ...formulario, sitio_web: evento.target.value })}
              placeholder="https://…"
            />
          </Campo>
          <Campo etiqueta="Notas" className="sm:col-span-2">
            <AreaTexto
              value={formulario.notas}
              onChange={(evento) => setFormulario({ ...formulario, notas: evento.target.value })}
              placeholder="Contexto, tamaño, referidos…"
            />
          </Campo>
          <label className="flex items-start gap-2 text-sm text-tinta-suave sm:col-span-2">
            <input
              type="checkbox"
              checked={formulario.descartada}
              onChange={(evento) => setFormulario({ ...formulario, descartada: evento.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-borde text-blue-600 focus:ring-2 focus:ring-blue-500/30"
            />
            <span>
              Empresa descartada
              <span className="block text-xs text-tinta-tenue">
                No volver a prospectar. Puedes reactivarla desmarcando esta casilla.
              </span>
            </span>
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear empresa'}
            </Boton>
          </div>
        </form>
      </Modal>

      <Confirmar
        abierto={porEliminar !== null}
        titulo="Eliminar empresa"
        onCancelar={() => setPorEliminar(null)}
        onConfirmar={() => {
          void eliminarEmpresa()
        }}
        mensaje={
          porEliminar ? (
            <>
              ¿Seguro que quieres eliminar <strong className="text-tinta">{porEliminar.nombre}</strong>? Se eliminarán
              sus contactos y sus oportunidades quedarán sin empresa. Esta acción no se puede deshacer.
            </>
          ) : null
        }
      />

      <Modal
        abierto={porConvertir !== null}
        titulo="Convertir en cliente"
        onCerrar={() => setPorConvertir(null)}
        ancho="sm:max-w-md"
      >
        <p className="text-sm text-tinta-suave">
          Se creará un cliente con el nombre{' '}
          <strong className="text-tinta">
            {contactos.find((fila) => fila.empresa_id === porConvertir?.id)?.nombre ?? porConvertir?.nombre ?? '—'}
          </strong>{' '}
          y la empresa <strong className="text-tinta">{porConvertir?.nombre ?? '—'}</strong>. Podrás editarlo después en
          la sección «Clientes».
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Boton variante="secundario" type="button" onClick={() => setPorConvertir(null)}>
            Cancelar
          </Boton>
          <Boton type="button" onClick={() => void convertir()} disabled={convirtiendo}>
            <UserPlus size={15} /> {convirtiendo ? 'Convirtiendo…' : 'Convertir'}
          </Boton>
        </div>
      </Modal>
    </div>
  )
}
