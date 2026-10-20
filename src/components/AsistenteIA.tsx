import { CircleAlert, MessageCircle, RotateCcw, Send, Sparkles, Trash2, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { borrarHistorialAsistente, cargarHistorialAsistente, guardarMensajeAsistente } from '../lib/asistente'
import { cx } from '../lib/estilos'
import { conversarConIA, obtenerToken } from '../lib/ia'
import { supabase } from '../lib/supabase'

interface Mensaje {
  id: string
  rol: 'user' | 'assistant'
  texto: string
}

const SUGERENCIAS = [
  'Redacta un correo de cobro amable para una factura vencida.',
  'Ayúdame a preparar una propuesta de auditoría para un cliente.',
  'Dame ideas para conseguir más clientes de consultoría.',
]

/** UUID v4 para agrupar los mensajes de una conversación. */
function nuevoUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (caracter) => {
    const aleatorio = Math.floor(Math.random() * 16)
    return (caracter === 'x' ? aleatorio : (aleatorio & 0x3) | 0x8).toString(16)
  })
}

/** Asistente de IA flotante del panel. Usa Workers AI (plan gratis, sin claves). */
export function AsistenteIA() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [conversacionId, setConversacionId] = useState(nuevoUuid)
  const [historialDisponible, setHistorialDisponible] = useState<boolean | null>(null)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const entrada = useRef<HTMLTextAreaElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const secuencia = useRef(0)

  function nuevoId(rol: string) {
    secuencia.current += 1
    return `${rol}-${secuencia.current}`
  }

  useEffect(() => {
    if (!abierto) return
    const enfoque = window.setTimeout(() => entrada.current?.focus(), 90)
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAbierto(false)
    }
    window.addEventListener('keydown', alTeclear)
    return () => {
      window.clearTimeout(enfoque)
      window.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const contenedor = lista.current
    if (contenedor) {
      contenedor.scrollTo({ top: contenedor.scrollHeight, behavior: 'smooth' })
    }
  }, [abierto, mensajes, enviando, error])

  useEffect(() => {
    let activo = true
    void cargarHistorialAsistente().then((filas) => {
      if (!activo) return
      if (filas === null) {
        setHistorialDisponible(false)
        return
      }
      setHistorialDisponible(true)
      if (filas.length === 0) return
      setConversacionId(filas[0].conversacion_id)
      setMensajes(filas.map((fila) => ({ id: fila.id, rol: fila.rol, texto: fila.contenido })))
    })
    return () => {
      activo = false
    }
  }, [])

  async function guardar(mensaje: Mensaje) {
    const guardado = await guardarMensajeAsistente({
      conversacionId,
      rol: mensaje.rol,
      contenido: mensaje.texto,
    })
    setHistorialDisponible(guardado)
  }

  async function responder(historial: Mensaje[]) {
    setEnviando(true)
    setError('')
    try {
      const token = await obtenerToken(supabase)
      const respuesta = await conversarConIA(
        historial.map(({ rol, texto: contenido }) => ({ rol, contenido })),
        token,
      )
      const mensajeAsistente: Mensaje = { id: nuevoId('asistente'), rol: 'assistant', texto: respuesta }
      setMensajes((anteriores) => [...anteriores, mensajeAsistente].slice(-50))
      void guardar(mensajeAsistente)
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'El asistente no pudo responder. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  function enviar(sugerencia?: string) {
    const contenido = (sugerencia ?? texto).trim()
    if (!contenido || enviando) return
    const nuevo: Mensaje = { id: nuevoId('usuario'), rol: 'user', texto: contenido }
    const historial = [...mensajes, nuevo].slice(-50)
    setTexto('')
    setError('')
    setMensajes(historial)
    void guardar(nuevo)
    void responder(historial)
  }

  function reintentar() {
    if (enviando || mensajes.length === 0 || mensajes[mensajes.length - 1].rol !== 'user') return
    void responder(mensajes)
  }

  function nuevaConversacion() {
    if (enviando) return
    setMensajes([])
    setError('')
    setTexto('')
    setConfirmandoBorrado(false)
    setConversacionId(nuevoUuid())
    entrada.current?.focus()
  }

  async function borrarHistorial() {
    if (borrando) return
    setBorrando(true)
    const borrado = await borrarHistorialAsistente()
    setBorrando(false)
    if (!borrado) {
      setError('No se pudo borrar el historial. Inténtalo de nuevo.')
      setConfirmandoBorrado(false)
      return
    }
    setMensajes([])
    setError('')
    setTexto('')
    setConfirmandoBorrado(false)
    setConversacionId(nuevoUuid())
    entrada.current?.focus()
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        aria-expanded={false}
        className="no-imprimir fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border border-blue-700 bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:-translate-y-0.5 hover:bg-blue-700 sm:right-6 sm:bottom-6"
      >
        <MessageCircle size={18} aria-hidden />
        <span className="hidden sm:inline">Asistente IA</span>
        <span className="sm:hidden">Asistente</span>
      </button>
    )
  }

  return (
    <section
      role="dialog"
      aria-label="Asistente de IA"
      className="no-imprimir animar-modal fixed inset-x-0 bottom-0 z-50 flex h-[min(88dvh,720px)] flex-col overflow-hidden rounded-t-3xl border border-borde bg-superficie shadow-2xl shadow-slate-900/25 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[min(680px,calc(100dvh-5rem))] sm:w-[400px] sm:rounded-3xl"
    >
      <header className="flex items-center gap-3 border-b border-borde bg-superficie px-4 py-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-sm shadow-blue-600/25">
          <Sparkles size={17} aria-hidden />
          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-superficie bg-emerald-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-sm font-semibold text-tinta">Asistente Avi</p>
          <p className="truncate text-[11px] text-tinta-tenue">IA de AviTech · en línea</p>
        </div>
        {mensajes.length > 0 && (
          <button
            type="button"
            onClick={nuevaConversacion}
            disabled={enviando}
            title="Nueva conversación"
            aria-label="Nueva conversación"
            className="flex h-8 w-8 items-center justify-center rounded-full text-tinta-tenue transition-colors hover:bg-superficie-2 hover:text-tinta disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={16} aria-hidden />
          </button>
        )}
        {historialDisponible === true && mensajes.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(true)}
            disabled={enviando || borrando}
            title="Borrar historial"
            aria-label="Borrar historial"
            className="flex h-8 w-8 items-center justify-center rounded-full text-tinta-tenue transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => setAbierto(false)}
          title="Cerrar asistente"
          aria-label="Cerrar asistente"
          className="flex h-8 w-8 items-center justify-center rounded-full text-tinta-tenue transition-colors hover:bg-superficie-2 hover:text-tinta"
        >
          <X size={18} aria-hidden />
        </button>
      </header>

      <div ref={lista} className="flex-1 space-y-4 overflow-y-auto bg-fondo/60 px-4 py-4" role="log" aria-live="polite">
        {confirmandoBorrado && (
          <div
            role="alertdialog"
            aria-label="Confirmar borrado del historial"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
          >
            <p className="font-semibold">¿Borrar todo el historial del asistente?</p>
            <p className="mt-1 leading-relaxed">Esta acción no se puede deshacer.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void borrarHistorial()}
                disabled={borrando}
                className="rounded-lg bg-red-700 px-2.5 py-1.5 font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {borrando ? 'Borrando…' : 'Sí, borrar'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoBorrado(false)}
                disabled={borrando}
                className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        {mensajes.length === 0 ? (
          <div className="rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Sparkles size={16} aria-hidden />
              </span>
              <p className="font-display text-sm font-semibold text-tinta">¿En qué te ayudo?</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-tinta-suave">
              Puedo redactar correos, propuestas y resúmenes, revisar textos o darte ideas. <strong className="font-semibold text-tinta">No veo los datos del panel</strong>: si quieres analizar algo, pégalo aquí.
            </p>
            <div className="mt-3 grid gap-1.5">
              {SUGERENCIAS.map((sugerencia) => (
                <button
                  key={sugerencia}
                  type="button"
                  onClick={() => enviar(sugerencia)}
                  className="rounded-xl border border-borde bg-superficie px-3 py-2 text-left text-xs leading-snug text-tinta-suave transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                >
                  {sugerencia}
                </button>
              ))}
            </div>
          </div>
        ) : (
          mensajes.map((mensaje) => <Burbuja key={mensaje.id} mensaje={mensaje} />)
        )}

        {enviando && (
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <Sparkles size={13} aria-hidden />
            </span>
            <span className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-borde bg-superficie px-3 py-3">
              {[0, 1, 2].map((indice) => (
                <span
                  key={indice}
                  className="punto-escribiendo h-1.5 w-1.5 rounded-full bg-tinta-tenue"
                  style={{ animationDelay: `${indice * 140}ms` }}
                />
              ))}
              <span className="sr-only">El asistente está escribiendo…</span>
            </span>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <div className="flex items-start gap-2">
              <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
              <p className="leading-relaxed">{error}</p>
            </div>
            {mensajes.length > 0 && mensajes[mensajes.length - 1].rol === 'user' && !enviando && (
              <button
                type="button"
                onClick={reintentar}
                className="mt-2 font-semibold underline decoration-red-300 underline-offset-2 hover:text-red-800"
              >
                Reintentar
              </button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-borde bg-superficie p-3">
        <div className="flex items-end gap-1.5 rounded-2xl border border-borde bg-superficie p-1.5 shadow-sm transition-shadow focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10">
          <textarea
            ref={entrada}
            rows={1}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
                evento.preventDefault()
                enviar()
              }
            }}
            maxLength={3000}
            placeholder="Escribe tu mensaje…"
            aria-label="Mensaje para el asistente"
            className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-base text-tinta placeholder:text-tinta-tenue focus:outline-none sm:text-sm"
          />
          <button
            type="button"
            onClick={() => enviar()}
            disabled={!texto.trim() || enviando}
            title="Enviar mensaje"
            aria-label="Enviar mensaje"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-all hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send size={16} aria-hidden />
          </button>
        </div>
        {historialDisponible === false && (
          <p className="mt-1 px-1 text-[10px] leading-snug text-amber-700">
            El historial no está disponible hasta aplicar la migración 010.
          </p>
        )}
        <p className="mt-1.5 px-1 text-[10px] leading-snug text-tinta-tenue">
          Gratis con Cloudflare Workers AI · puede equivocarse · no compartas contraseñas ni claves
        </p>
      </div>
    </section>
  )
}

function Burbuja({ mensaje }: { mensaje: Mensaje }) {
  const esUsuario = mensaje.rol === 'user'
  return (
    <div className={cx('flex items-start gap-2', esUsuario && 'justify-end')}>
      {!esUsuario && (
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"
        >
          <Sparkles size={13} />
        </span>
      )}
      <div
        className={cx(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap',
          esUsuario
            ? 'rounded-br-md bg-blue-600 text-white shadow-sm shadow-blue-600/20'
            : 'rounded-bl-md border border-borde bg-superficie text-tinta',
        )}
      >
        <TextoMensaje texto={mensaje.texto} />
      </div>
    </div>
  )
}

/** Renderiza negritas sencillas sin interpretar HTML (seguro ante inyección). */
function TextoMensaje({ texto }: { texto: string }) {
  const limpio = texto.replace(/^[ \t]*[-*][ \t]+/gm, '• ').replace(/^#{1,6}[ \t]+/gm, '')
  const partes = limpio.split(/(\*\*[^*\n]+\*\*)/g)
  return (
    <>
      {partes.map((parte, indice) =>
        parte.startsWith('**') && parte.endsWith('**') ? (
          <strong key={indice} className="font-semibold">
            {parte.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={indice}>{parte}</Fragment>
        ),
      )}
    </>
  )
}
