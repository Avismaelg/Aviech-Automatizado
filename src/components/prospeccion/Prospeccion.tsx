import {
  AtSign,
  Ban,
  CircleCheck,
  Download,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  Radar,
  Search,
  Share2,
  UserPlus,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useAvisos } from '../../lib/avisos'
import { construirCSV, descargarContenidoCSV } from '../../lib/csv'
import { soportaDescartadas } from '../../lib/descartadas'
import { cx } from '../../lib/estilos'
import { fechaCompleta } from '../../lib/formato'
import {
  buscarContactos,
  buscarEmpresaPorDominio,
  descartarEmpresaEnCrm,
  guardarContactosEnCrm,
  type EmpresaExistente,
} from '../../lib/prospeccion'
import { supabase } from '../../lib/supabase'
import { normalizarUrl } from '../../lib/urls'
import type { DatosProspeccion } from '../../types/prospeccion'
import {
  AreaTexto,
  Boton,
  CabeceraSeccion,
  Campo,
  Entrada,
  Insignia,
  Modal,
  Selector,
  Tarjeta,
  Vacio,
} from '../ui'

const FASES = [
  'Conectando con la web…',
  'Revisando la página principal…',
  'Buscando páginas de contacto…',
  'Recogiendo correos, teléfonos y redes…',
]

/** Prospección: extrae contactos de una web (como un visitante) y los guarda en el CRM. */
export function Prospeccion({ onIrAlCrm }: { onIrAlCrm?: () => void }) {
  const aviso = useAvisos()
  const [entrada, setEntrada] = useState('')
  const [errorUrl, setErrorUrl] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [datos, setDatos] = useState<DatosProspeccion | null>(null)
  const [guardadoNombre, setGuardadoNombre] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [empresaExistente, setEmpresaExistente] = useState<EmpresaExistente | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const [puedeDescartar, setPuedeDescartar] = useState(false)
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [nombreContacto, setNombreContacto] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    void soportaDescartadas().then(setPuedeDescartar)
  }, [])

  function validar(valor: string): string {
    try {
      normalizarUrl(valor)
      return ''
    } catch (fallo) {
      return fallo instanceof Error ? fallo.message : 'La dirección no es válida.'
    }
  }

  function prepararFormulario(resultado: DatosProspeccion) {
    setNombreEmpresa(resultado.nombre || resultado.dominio)
    setNombreContacto('Contacto general')
    setEmail(resultado.emails[0]?.valor ?? '')
    setTelefono(resultado.telefonos[0]?.valor ?? '')
    setLinkedin(resultado.redes.find((red) => red.red === 'LinkedIn')?.url ?? '')
    setNotas(construirNotas(resultado))
    setEmpresaExistente(null)
  }

  async function buscar() {
    if (buscando || !supabase) return
    const mensaje = validar(entrada)
    setErrorUrl(mensaje)
    if (mensaje) return

    setBuscando(true)
    setGuardadoNombre('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
      const resultado = await buscarContactos(normalizarUrl(entrada), token)
      setDatos(resultado)
      setEntrada(resultado.urlFinal)
      prepararFormulario(resultado)
      const existente = await buscarEmpresaPorDominio(resultado.dominio)
      setEmpresaExistente(existente)
      const total = resultado.emails.length + resultado.telefonos.length + resultado.redes.length
      if (total > 0) {
        aviso(`Encontrados ${total} datos de contacto`, 'ok')
      } else {
        aviso('No se encontraron contactos públicos en esa web', 'error')
      }
    } catch (fallo) {
      aviso(fallo instanceof Error ? fallo.message : 'No se pudieron buscar los contactos.', 'error')
    } finally {
      setBuscando(false)
    }
  }

  async function abrirGuardar() {
    if (!datos || verificando) return
    setVerificando(true)
    const existente = await buscarEmpresaPorDominio(datos.dominio)
    if (existente) setNombreEmpresa(existente.nombre)
    setEmpresaExistente(existente)
    setVerificando(false)
    setModalAbierto(true)
  }

  async function guardar() {
    if (!datos || guardando || !nombreEmpresa.trim()) return
    setGuardando(true)
    const resultado = await guardarContactosEnCrm({
      empresaExistenteId: empresaExistente?.id ?? null,
      nombreEmpresa: nombreEmpresa.trim(),
      dominio: datos.dominio,
      sitioWeb: datos.urlFinal,
      telefonoEmpresa: datos.telefonos[0]?.valor ?? null,
      notasEmpresa: `Agregada desde Prospección el ${fechaCompleta(datos.fecha)}.`,
      contactoNombre: nombreContacto.trim() || 'Contacto general',
      email: email.trim() || null,
      telefonoContacto: telefono.trim() || null,
      linkedin: linkedin.trim() || null,
      notasContacto: notas.trim() || null,
    })
    setGuardando(false)
    if (!resultado.ok) {
      aviso(resultado.error ?? 'No se pudo guardar en el CRM.', 'error')
      return
    }
    setModalAbierto(false)
    setGuardadoNombre(nombreEmpresa.trim())
    aviso(`${nombreEmpresa.trim()} quedó guardado en el CRM`, 'ok')
  }

  async function descartar() {
    if (!datos || descartando) return
    if (!puedeDescartar) {
      aviso('La función de descartadas aún no está disponible. Aplica la migración 009 en la base de datos.', 'error')
      return
    }
    setDescartando(true)
    const resultado = await descartarEmpresaEnCrm({
      nombre: datos.nombre || datos.dominio,
      dominio: datos.dominio,
      sitioWeb: datos.urlFinal,
      telefono: datos.telefonos[0]?.valor ?? null,
    })
    setDescartando(false)
    if (!resultado.ok) {
      aviso(resultado.error ?? 'No se pudo descartar la empresa.', 'error')
      return
    }
    if (resultado.id) {
      setEmpresaExistente({
        id: resultado.id,
        nombre: datos.nombre || datos.dominio,
        descartada: true,
      })
    }
    aviso(
      resultado.yaExistia ? 'Esta empresa ya estaba descartada' : 'Empresa marcada como descartada',
      resultado.yaExistia ? 'error' : 'ok',
    )
  }

  return (
    <div>
      <CabeceraSeccion
        titulo="Prospección"
        descripcion="Escribe la web de una empresa y busca sus correos, teléfonos y redes sociales. Con un clic los guardas en el CRM."
      />

      <Tarjeta className="p-4 sm:p-5">
        <form
          onSubmit={(evento) => {
            evento.preventDefault()
            void buscar()
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Globe
                size={16}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-tenue"
              />
              <Entrada
                type="text"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                aria-label="Dirección de la web a prospectar"
                aria-invalid={Boolean(errorUrl)}
                aria-describedby={errorUrl ? 'prospeccion-error' : undefined}
                placeholder="tusitio.com o https://tusitio.com"
                className={cx('pl-9', Boolean(errorUrl) && 'border-red-400/60')}
                value={entrada}
                disabled={buscando}
                onChange={(evento) => {
                  setEntrada(evento.target.value)
                  if (errorUrl) setErrorUrl('')
                }}
                onBlur={() => setErrorUrl(entrada.trim() ? validar(entrada) : '')}
              />
            </div>
            <Boton type="submit" disabled={buscando} className="sm:w-48">
              {buscando ? (
                <span
                  aria-hidden
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                />
              ) : (
                <Search size={16} aria-hidden />
              )}
              {buscando ? 'Buscando…' : 'Buscar contactos'}
            </Boton>
          </div>
        </form>
        {errorUrl ? (
          <p id="prospeccion-error" className="mt-2 text-xs text-red-700">
            {errorUrl}
          </p>
        ) : (
          <p className="mt-2 text-xs text-tinta-tenue">
            Se visitan la página principal y hasta 5 páginas de contacto del mismo dominio (como un visitante).
            Las webs que cargan todo con JavaScript pueden no mostrar sus datos.
          </p>
        )}
      </Tarjeta>

      <div aria-live="polite" aria-busy={buscando} className="mt-4">
        {buscando ? (
          <CargandoProspeccion />
        ) : datos ? (
          <Resultado
            datos={datos}
            guardadoNombre={guardadoNombre}
            verificando={verificando}
            empresaDescartada={Boolean(empresaExistente?.descartada)}
            puedeDescartar={puedeDescartar}
            descartando={descartando}
            onGuardar={() => void abrirGuardar()}
            onDescartar={() => void descartar()}
            onIrAlCrm={onIrAlCrm}
          />
        ) : (
          <Tarjeta>
            <Vacio
              icono={<Radar size={22} />}
              titulo="Encuentra clientes potenciales"
              texto="Escribe la web de una empresa y aquí verás sus correos, teléfonos y redes sociales, listos para guardar en el CRM."
            />
          </Tarjeta>
        )}
      </div>

      <Modal abierto={modalAbierto} titulo="Guardar en el CRM" onCerrar={() => setModalAbierto(false)}>
        {empresaExistente && (
          <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
            Ya tienes «{empresaExistente.nombre}» en el CRM: solo se añadirá el contacto a esa empresa.
          </p>
        )}
        {empresaExistente?.descartada && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Esta empresa está marcada como descartada. Si guardas el contacto, se reactivará en el CRM.
          </p>
        )}
        <form
          onSubmit={(evento) => {
            evento.preventDefault()
            void guardar()
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Campo etiqueta="Empresa *" className="sm:col-span-2">
            <Entrada
              required
              disabled={Boolean(empresaExistente)}
              value={nombreEmpresa}
              onChange={(evento) => setNombreEmpresa(evento.target.value)}
              placeholder="Nombre de la empresa"
            />
          </Campo>
          <Campo etiqueta="Nombre del contacto *">
            <Entrada
              required
              value={nombreContacto}
              onChange={(evento) => setNombreContacto(evento.target.value)}
              placeholder="Ej. María Pérez"
            />
          </Campo>
          <Campo etiqueta="Correo">
            {datos && datos.emails.length > 1 ? (
              <Selector value={email} onChange={(evento) => setEmail(evento.target.value)}>
                <option value="">Sin correo</option>
                {datos.emails.map((hallazgo) => (
                  <option key={hallazgo.valor} value={hallazgo.valor}>
                    {hallazgo.valor}
                  </option>
                ))}
              </Selector>
            ) : (
              <Entrada
                type="email"
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                placeholder="correo@empresa.com"
              />
            )}
          </Campo>
          <Campo etiqueta="Teléfono">
            {datos && datos.telefonos.length > 1 ? (
              <Selector value={telefono} onChange={(evento) => setTelefono(evento.target.value)}>
                <option value="">Sin teléfono</option>
                {datos.telefonos.map((hallazgo) => (
                  <option key={hallazgo.valor} value={hallazgo.valor}>
                    {hallazgo.valor}
                  </option>
                ))}
              </Selector>
            ) : (
              <Entrada
                value={telefono}
                onChange={(evento) => setTelefono(evento.target.value)}
                placeholder="(809) 555-1234"
              />
            )}
          </Campo>
          <Campo etiqueta="LinkedIn" className="sm:col-span-2">
            <Entrada
              value={linkedin}
              onChange={(evento) => setLinkedin(evento.target.value)}
              placeholder="https://www.linkedin.com/company/…"
            />
          </Campo>
          <Campo etiqueta="Notas" className="sm:col-span-2">
            <AreaTexto value={notas} onChange={(evento) => setNotas(evento.target.value)} />
          </Campo>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={guardando || !nombreEmpresa.trim()}>
              <UserPlus size={15} aria-hidden />
              {guardando ? 'Guardando…' : empresaExistente ? 'Añadir contacto' : 'Crear empresa y contacto'}
            </Boton>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function CargandoProspeccion() {
  const [fase, setFase] = useState(0)

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      // eslint-disable-next-line react/set-state-in-effect -- el setState ocurre dentro del intervalo, no de forma sincrónica
      setFase((actual) => Math.min(actual + 1, FASES.length - 1))
    }, 4000)
    return () => window.clearInterval(intervalo)
  }, [])

  return (
    <Tarjeta className="p-5">
      <div className="flex items-center gap-3 text-sm text-tinta-suave">
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-borde border-t-blue-400"
        />
        <span aria-live="polite">{FASES[fase]}</span>
      </div>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {[0, 1, 2].map((indice) => (
          <div key={indice} className="h-16 animate-pulse rounded-lg bg-superficie-2" />
        ))}
      </div>
    </Tarjeta>
  )
}

function Resultado({
  datos,
  guardadoNombre,
  verificando,
  empresaDescartada,
  puedeDescartar,
  descartando,
  onGuardar,
  onDescartar,
  onIrAlCrm,
}: {
  datos: DatosProspeccion
  guardadoNombre: string
  verificando: boolean
  empresaDescartada: boolean
  puedeDescartar: boolean
  descartando: boolean
  onGuardar: () => void
  onDescartar: () => void
  onIrAlCrm?: () => void
}) {
  const total = datos.emails.length + datos.telefonos.length + datos.redes.length

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Tarjeta className="overflow-hidden">
        <div className="border-b border-borde p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-lg font-semibold text-tinta">{datos.nombre || datos.dominio}</h3>
            <Insignia color={total ? 'blue' : 'slate'}>
              {total} hallazgo{total === 1 ? '' : 's'}
            </Insignia>
            {empresaDescartada && <Insignia color="slate">Descartada</Insignia>}
            {total > 0 && (
              <button
                type="button"
                onClick={() => exportarProspeccion(datos)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-borde bg-superficie-2/60 px-2.5 py-1.5 text-xs font-medium text-tinta-suave transition-colors hover:border-blue-200 hover:text-tinta"
              >
                <Download size={13} aria-hidden />
                Exportar CSV
              </button>
            )}
          </div>
          <a
            href={datos.urlFinal}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-blue-700 transition-colors hover:text-blue-700"
          >
            <span className="truncate">{datos.urlFinal}</span>
            <ExternalLink size={12} aria-hidden className="shrink-0" />
          </a>
          <p className="mt-1 text-xs text-tinta-tenue">
            {datos.paginas.length} página{datos.paginas.length === 1 ? '' : 's'} revisada
            {datos.paginas.length === 1 ? '' : 's'} · {datos.tiempoMs} ms · {fechaCompleta(datos.fecha)}
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <BloqueHallazgos icono={<Mail size={15} />} titulo="Correos" vacio="No se encontraron correos públicos.">
            {datos.emails.map((hallazgo) => (
              <li key={hallazgo.valor}>
                <a
                  href={`mailto:${hallazgo.valor}`}
                  className="group flex items-center gap-2 text-sm text-tinta transition-colors hover:text-blue-700"
                >
                  <AtSign size={14} aria-hidden className="shrink-0 text-tinta-tenue group-hover:text-blue-700" />
                  <span className="truncate">{hallazgo.valor}</span>
                </a>
                {hallazgo.origen && <p className="pl-6 text-[11px] text-tinta-tenue">en {hallazgo.origen}</p>}
              </li>
            ))}
          </BloqueHallazgos>

          <BloqueHallazgos icono={<Phone size={15} />} titulo="Teléfonos" vacio="No se encontraron teléfonos.">
            {datos.telefonos.map((hallazgo) => (
              <li key={hallazgo.valor}>
                <a
                  href={`tel:${hallazgo.valor.replace(/[^\d+]/g, '')}`}
                  className="group flex items-center gap-2 text-sm text-tinta transition-colors hover:text-blue-700"
                >
                  <Phone size={14} aria-hidden className="shrink-0 text-tinta-tenue group-hover:text-blue-700" />
                  <span className="truncate">{hallazgo.valor}</span>
                </a>
                {hallazgo.origen && <p className="pl-6 text-[11px] text-tinta-tenue">en {hallazgo.origen}</p>}
              </li>
            ))}
          </BloqueHallazgos>

          <BloqueHallazgos
            icono={<Share2 size={15} />}
            titulo="Redes sociales"
            vacio="No se encontraron redes sociales."
            className="sm:col-span-2"
            horizontal
          >
            {datos.redes.map((hallazgo) => (
              <li key={hallazgo.url}>
                <a
                  href={hallazgo.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                    hallazgo.red === 'WhatsApp'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                      : 'border-borde bg-superficie-2/60 text-tinta-suave hover:border-blue-200 hover:text-tinta',
                  )}
                >
                  {hallazgo.red}
                  <ExternalLink size={11} aria-hidden className="opacity-70" />
                </a>
              </li>
            ))}
          </BloqueHallazgos>
        </div>
      </Tarjeta>

      <div className="space-y-4">
        <Tarjeta className="p-5">
          <h3 className="text-sm font-semibold text-tinta">Guardar en el CRM</h3>
          {guardadoNombre ? (
            <>
              <p className="mt-2 flex items-start gap-2 text-xs text-emerald-700">
                <CircleCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
                «{guardadoNombre}» y su contacto ya están en el CRM.
              </p>
              {onIrAlCrm && (
                <Boton variante="secundario" type="button" className="mt-3 w-full" onClick={onIrAlCrm}>
                  Ver en el CRM
                </Boton>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-xs leading-relaxed text-tinta-suave">
                {total > 0
                  ? 'Crea la empresa y un contacto con los datos que elijas. Podrás editarlos después.'
                  : 'No hay datos que guardar. Prueba con otra dirección.'}
              </p>
              <Boton type="button" className="mt-3 w-full" onClick={onGuardar} disabled={total === 0 || verificando}>
                <UserPlus size={15} aria-hidden />
                {verificando ? 'Comprobando…' : 'Guardar en el CRM'}
              </Boton>
            </>
          )}
        </Tarjeta>

        {puedeDescartar && (
          <Tarjeta className="p-5">
            <h3 className="text-sm font-semibold text-tinta">Descartar empresa</h3>
            <p className="mt-2 text-xs leading-relaxed text-tinta-suave">
              Si no encaja, márcala para no volver a prospectarla. Podrás reactivarla desde el CRM.
            </p>
            <Boton
              variante="secundario"
              type="button"
              className="mt-3 w-full"
              onClick={onDescartar}
              disabled={descartando || empresaDescartada}
            >
              <Ban size={15} aria-hidden />
              {empresaDescartada ? 'Ya descartada' : descartando ? 'Descartando…' : 'Descartar empresa'}
            </Boton>
          </Tarjeta>
        )}

        <Tarjeta className="p-5">
          <h3 className="text-sm font-semibold text-tinta">Páginas revisadas</h3>
          <ul className="mt-3 space-y-2.5 text-xs">
            {datos.paginas.map((pagina) => (
              <li key={pagina.url} className="min-w-0">
                <p className="truncate text-tinta-suave">{cortarRuta(pagina.url)}</p>
                <p className="truncate text-[11px] text-tinta-tenue">
                  {pagina.estado ? `HTTP ${pagina.estado}` : 'No se pudo abrir'}
                  {pagina.titulo ? ` · ${pagina.titulo}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </div>
  )
}

function BloqueHallazgos({
  icono,
  titulo,
  vacio,
  className,
  horizontal = false,
  children,
}: {
  icono: ReactNode
  titulo: string
  vacio: string
  className?: string
  horizontal?: boolean
  children: ReactNode
}) {
  const sinDatos = Array.isArray(children) && children.length === 0
  return (
    <section className={className}>
      <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-tinta-tenue uppercase">
        <span className="text-blue-700">{icono}</span>
        {titulo}
      </h4>
      {sinDatos ? (
        <p className="text-xs text-tinta-tenue">{vacio}</p>
      ) : horizontal ? (
        <ul className="flex flex-wrap gap-2">{children}</ul>
      ) : (
        <ul className="space-y-2.5">{children}</ul>
      )}
    </section>
  )
}

/** Descarga todos los hallazgos visibles en una tabla CSV compatible con Excel. */
function exportarProspeccion(datos: DatosProspeccion): void {
  const filas: string[][] = [['Tipo', 'Valor', 'Origen']]
  datos.emails.forEach((hallazgo) => filas.push(['Correo', hallazgo.valor, hallazgo.origen]))
  datos.telefonos.forEach((hallazgo) => filas.push(['Teléfono', hallazgo.valor, hallazgo.origen]))
  datos.redes.forEach((hallazgo) => filas.push([hallazgo.red, hallazgo.url, hallazgo.origen]))
  if (filas.length === 1) return

  const dominio = datos.dominio.replace(/[^a-z0-9.-]+/gi, '-').replace(/^-+|-+$/g, '') || 'empresa'
  const fecha = datos.fecha.slice(0, 10) || new Date().toISOString().slice(0, 10)
  descargarContenidoCSV(`prospeccion-${dominio}-${fecha}`, construirCSV(filas, ';'))
}

function construirNotas(datos: DatosProspeccion): string {
  const lineas = [`Encontrado con Prospección el ${fechaCompleta(datos.fecha)} desde ${datos.urlFinal}.`]
  if (datos.emails.length) lineas.push(`Correos: ${datos.emails.map((hallazgo) => hallazgo.valor).join(', ')}`)
  if (datos.telefonos.length) {
    lineas.push(`Teléfonos: ${datos.telefonos.map((hallazgo) => hallazgo.valor).join(', ')}`)
  }
  if (datos.redes.length) {
    lineas.push(`Redes: ${datos.redes.map((hallazgo) => `${hallazgo.red}: ${hallazgo.url}`).join(' | ')}`)
  }
  return lineas.join('\n')
}

function cortarRuta(direccion: string): string {
  try {
    const url = new URL(direccion)
    const ruta = `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`
    return ruta.length > 60 ? `${ruta.slice(0, 59)}…` : ruta
  } catch {
    return direccion
  }
}
