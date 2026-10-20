import { Download, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { construirCSV, descargarContenidoCSV } from '../lib/csv'
import { ESTADOS_CLIENTE, colorEstadoCliente, etiquetaEstadoCliente } from '../lib/etiquetas'
import { formatoFecha, hoyISO, iniciales } from '../lib/formato'
import { useTabla } from '../lib/useTabla'
import type { Cliente } from '../types/cliente'
import {
  AreaTexto,
  Boton,
  BotonIcono,
  CabeceraSeccion,
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
} from './ui'

interface FormularioCliente {
  nombre: string
  empresa: string
  rnc: string
  email: string
  telefono: string
  estado: string
  notas: string
}

const FORMULARIO_VACIO: FormularioCliente = {
  nombre: '',
  empresa: '',
  rnc: '',
  email: '',
  telefono: '',
  estado: 'activo',
  notas: '',
}

export function Clientes() {
  const { filas: clientes, cargando, error, guardar, eliminar } = useTabla<Cliente>('clientes')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<FormularioCliente>(FORMULARIO_VACIO)
  const [porEliminar, setPorEliminar] = useState<Cliente | null>(null)
  const [guardando, setGuardando] = useState(false)

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return clientes.filter((cliente) => {
      const coincideEstado = filtroEstado === 'todos' || cliente.estado === filtroEstado
      const coincideTexto =
        !texto ||
        [cliente.nombre, cliente.empresa, cliente.rnc, cliente.email, cliente.telefono].some((valor) =>
          valor?.toLowerCase().includes(texto),
        )
      return coincideEstado && coincideTexto
    })
  }, [clientes, busqueda, filtroEstado])

  function exportarCSV() {
    const cabeceras = ['Nombre', 'Empresa', 'RNC', 'Teléfono', 'Correo', 'Estado', 'Notas', 'Fecha de alta']
    const filas = filtrados.map((cliente) => [
      cliente.nombre,
      cliente.empresa,
      cliente.rnc,
      cliente.telefono,
      cliente.email,
      etiquetaEstadoCliente[cliente.estado] ?? cliente.estado,
      cliente.notas,
      formatoFecha(cliente.created_at),
    ])
    descargarContenidoCSV(`clientes-${hoyISO()}.csv`, construirCSV([cabeceras, ...filas], ';'))
  }

  function abrirNuevo() {
    setEditandoId(null)
    setFormulario(FORMULARIO_VACIO)
    setModalAbierto(true)
  }

  function abrirEdicion(cliente: Cliente) {
    setEditandoId(cliente.id)
    setFormulario({
      nombre: cliente.nombre,
      empresa: cliente.empresa ?? '',
      rnc: cliente.rnc ?? '',
      email: cliente.email ?? '',
      telefono: cliente.telefono ?? '',
      estado: cliente.estado,
      notas: cliente.notas ?? '',
    })
    setModalAbierto(true)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando || !formulario.nombre.trim()) return
    setGuardando(true)
    const guardado = await guardar(
      {
        nombre: formulario.nombre.trim(),
        empresa: formulario.empresa.trim() || null,
        rnc: formulario.rnc.trim() || null,
        email: formulario.email.trim() || null,
        telefono: formulario.telefono.trim() || null,
        estado: formulario.estado,
        notas: formulario.notas.trim() || null,
      },
      editandoId ?? undefined,
    )
    setGuardando(false)
    if (guardado) setModalAbierto(false)
  }

  return (
    <section>
      <CabeceraSeccion
        titulo="Clientes"
        descripcion={`${clientes.length} registrado${clientes.length === 1 ? '' : 's'}`}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="secundario" onClick={exportarCSV} disabled={filtrados.length === 0}>
              <Download size={16} /> Exportar CSV
            </Boton>
            <Boton onClick={abrirNuevo}>
              <Plus size={16} /> Nuevo cliente
            </Boton>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-tenue" />
          <Entrada
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por nombre, empresa, RNC, correo…"
            className="pl-9"
          />
        </div>
        <Selector value={filtroEstado} onChange={(evento) => setFiltroEstado(evento.target.value)} className="sm:w-44">
          <option value="todos">Todos los estados</option>
          {ESTADOS_CLIENTE.map((estado) => (
            <option key={estado} value={estado}>
              {etiquetaEstadoCliente[estado]}
            </option>
          ))}
        </Selector>
      </div>

      <Tarjeta>
        {error && <ErrorTabla mensaje={error} />}
        {cargando && !error && <FilasCargando />}
        {!cargando && !error && filtrados.length === 0 && (
          clientes.length === 0 ? (
            <Vacio
              icono={<UserRound size={22} />}
              titulo="Todavía no hay clientes"
              texto="Agrega tu primer cliente con el botón «Nuevo cliente»."
            />
          ) : (
            <Vacio icono={<Search size={22} />} titulo="Sin resultados" texto="Prueba otra búsqueda o quita el filtro." />
          )
        )}
        {!cargando && !error && filtrados.length > 0 && (
          <ul className="divide-y divide-borde-suave">
            {filtrados.map((cliente) => (
              <li key={cliente.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-superficie-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                  {iniciales(cliente.nombre)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-tinta">{cliente.nombre}</p>
                  <p className="truncate text-xs text-tinta-suave">
                    {[cliente.empresa, cliente.rnc ? `RNC ${cliente.rnc}` : null, cliente.email, cliente.telefono]
                      .filter(Boolean)
                      .join(' · ') || 'Sin datos de contacto'}
                  </p>
                </div>
                <div className="hidden shrink-0 sm:block">
                  <Insignia color={colorEstadoCliente[cliente.estado] ?? 'slate'}>
                    {etiquetaEstadoCliente[cliente.estado] ?? cliente.estado}
                  </Insignia>
                </div>
                <time className="hidden shrink-0 text-xs text-tinta-tenue lg:block">{formatoFecha(cliente.created_at)}</time>
                <div className="flex shrink-0 items-center gap-0.5">
                  <BotonIcono etiqueta="Editar" onClick={() => abrirEdicion(cliente)}>
                    <Pencil size={15} />
                  </BotonIcono>
                  <BotonIcono
                    etiqueta="Eliminar"
                    onClick={() => setPorEliminar(cliente)}
                    className="hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 size={15} />
                  </BotonIcono>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Modal
        abierto={modalAbierto}
        titulo={editandoId ? 'Editar cliente' : 'Nuevo cliente'}
        onCerrar={() => setModalAbierto(false)}
      >
        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre *" className="sm:col-span-2">
            <Entrada
              required
              value={formulario.nombre}
              onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })}
              placeholder="Nombre y apellidos"
            />
          </Campo>
          <Campo etiqueta="Empresa">
            <Entrada
              value={formulario.empresa}
              onChange={(evento) => setFormulario({ ...formulario, empresa: evento.target.value })}
              placeholder="Nombre de la empresa"
            />
          </Campo>
          <Campo etiqueta="RNC">
            <Entrada
              value={formulario.rnc}
              onChange={(evento) => setFormulario({ ...formulario, rnc: evento.target.value })}
              placeholder="1-01-12345-6"
            />
          </Campo>
          <Campo etiqueta="Estado">
            <Selector
              value={formulario.estado}
              onChange={(evento) => setFormulario({ ...formulario, estado: evento.target.value })}
            >
              {ESTADOS_CLIENTE.map((estado) => (
                <option key={estado} value={estado}>
                  {etiquetaEstadoCliente[estado]}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Correo">
            <Entrada
              type="email"
              value={formulario.email}
              onChange={(evento) => setFormulario({ ...formulario, email: evento.target.value })}
              placeholder="nombre@correo.com"
            />
          </Campo>
          <Campo etiqueta="Teléfono">
            <Entrada
              value={formulario.telefono}
              onChange={(evento) => setFormulario({ ...formulario, telefono: evento.target.value })}
              placeholder="809 555 1234"
            />
          </Campo>
          <Campo etiqueta="Notas" className="sm:col-span-2">
            <AreaTexto
              value={formulario.notas}
              onChange={(evento) => setFormulario({ ...formulario, notas: evento.target.value })}
              placeholder="Detalles importantes del cliente…"
            />
          </Campo>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear cliente'}
            </Boton>
          </div>
        </form>
      </Modal>

      <Confirmar
        abierto={porEliminar !== null}
        titulo="Eliminar cliente"
        textoBoton="Eliminar"
        onCancelar={() => setPorEliminar(null)}
        onConfirmar={() => {
          if (porEliminar) void eliminar(porEliminar.id)
          setPorEliminar(null)
        }}
        mensaje={
          porEliminar ? (
            <>
              ¿Seguro que quieres eliminar a <strong className="text-tinta">{porEliminar.nombre}</strong>? También se
              eliminarán sus servicios y pagos registrados. Esta acción no se puede deshacer.
            </>
          ) : null
        }
      />
    </section>
  )
}
