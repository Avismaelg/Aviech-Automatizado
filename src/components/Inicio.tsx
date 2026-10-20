import type { Session } from '@supabase/supabase-js'
import { ArrowRight, Banknote, Briefcase, Clock, Handshake, PiggyBank, Plus, TrendingDown, TrendingUp, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cx } from '../lib/estilos'
import { colorEstadoCliente, etiquetaCategoriaGasto, etiquetaEstadoCliente } from '../lib/etiquetas'
import { diasDeAtraso, formatoDinero, formatoFecha, hoyISO, iniciales, mesActualISO } from '../lib/formato'
import { supabase } from '../lib/supabase'
import { useContador } from '../lib/useContador'
import type { ActividadCrm } from '../types/crm'
import type { Cliente } from '../types/cliente'
import type { Gasto } from '../types/gasto'
import type { Iguala } from '../types/iguala'
import type { Pago } from '../types/pago'
import type { Servicio } from '../types/servicio'
import type { Seccion } from './Layout'
import { Boton, CabeceraSeccion, Insignia, Tarjeta, Vacio } from './ui'

interface Resumen {
  clientes: Cliente[]
  servicios: Servicio[]
  pagos: Pago[]
  gastos: Gasto[]
  igualas: Iguala[]
  actividades: ActividadCrm[]
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function TarjetaDato({
  Icono,
  claseIcono,
  titulo,
  valor,
  formatear = (numero) => String(Math.round(numero)),
  claseValor,
  detalle,
}: {
  Icono: LucideIcon
  claseIcono: string
  titulo: string
  valor: number
  formatear?: (numero: number) => string
  claseValor?: string
  detalle?: string
}) {
  const animado = useContador(valor)
  return (
    <Tarjeta className="group p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-900/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-tinta-suave">{titulo}</p>
          <p className={cx('mt-2.5 truncate text-[26px] leading-none font-semibold tabular-nums', claseValor ?? 'text-tinta')}>
            {formatear(animado)}
          </p>
          {detalle && <p className="mt-2 truncate text-[11px] text-tinta-tenue">{detalle}</p>}
        </div>
        <span
          className={cx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
            claseIcono,
          )}
        >
          <Icono size={19} />
        </span>
      </div>
    </Tarjeta>
  )
}

interface PuntoSerie {
  clave: string
  etiqueta: string
  valor: number
  actual: boolean
}

function serieIngresos(pagos: Pago[]): PuntoSerie[] {
  const ahora = new Date()
  const puntos: PuntoSerie[] = []
  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    const valor = pagos
      .filter((pago) => pago.estado === 'pagado' && (pago.fecha ?? '').slice(0, 7) === clave)
      .reduce((total, pago) => total + Number(pago.monto), 0)
    puntos.push({ clave, etiqueta: MESES_CORTOS[fecha.getMonth()], valor, actual: i === 0 })
  }
  return puntos
}

interface FilaBarra {
  clave: string
  etiqueta: string
  valor: number
}

/** Agrupa los pagos cobrados por cliente y devuelve el top 5 histórico. */
function topClientes(pagos: Pago[], clientes: Cliente[]): FilaBarra[] {
  const nombres = new Map(clientes.map((cliente) => [cliente.id, cliente.nombre]))
  for (const pago of pagos) {
    if (!nombres.has(pago.cliente_id) && pago.clientes?.nombre) nombres.set(pago.cliente_id, pago.clientes.nombre)
  }
  const totales = new Map<string, number>()
  for (const pago of pagos) {
    if (pago.estado !== 'pagado') continue
    totales.set(pago.cliente_id, (totales.get(pago.cliente_id) ?? 0) + Number(pago.monto))
  }
  return [...totales.entries()]
    .map(([clave, valor]) => ({ clave, etiqueta: nombres.get(clave) ?? 'Cliente sin nombre', valor }))
    .filter((fila) => fila.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5)
}

/** Suma los gastos del mes por categoría, de mayor a menor. */
function gastosPorCategoria(gastos: Gasto[], mes: string): FilaBarra[] {
  const totales = new Map<string, number>()
  for (const gasto of gastos) {
    if ((gasto.fecha ?? '').slice(0, 7) !== mes) continue
    totales.set(gasto.categoria, (totales.get(gasto.categoria) ?? 0) + Number(gasto.monto))
  }
  return [...totales.entries()]
    .map(([clave, valor]) => ({ clave, etiqueta: etiquetaCategoriaGasto[clave] ?? clave, valor }))
    .filter((fila) => fila.valor > 0)
    .sort((a, b) => b.valor - a.valor)
}

function GraficoIngresos({ serie }: { serie: PuntoSerie[] }) {
  const maximo = Math.max(...serie.map((punto) => punto.valor), 1)
  return (
    <div
      role="img"
      aria-label="Gráfica de barras con los ingresos de los últimos 6 meses"
      className="flex h-48 items-stretch gap-2 px-4 pt-5 pb-3 sm:gap-3"
    >
      {serie.map((punto) => (
        <div key={punto.clave} className="group flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute -top-4 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              {formatoDinero(punto.valor)}
            </div>
            <div
              className={cx(
                'animar-barra absolute right-0 bottom-0 left-0 rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-400 shadow-[0_10px_24px_-14px_rgba(37,99,235,0.55)] transition-[filter] duration-150 group-hover:brightness-105',
                punto.actual && 'from-blue-700 to-cyan-500',
              )}
              style={{ height: `${Math.max((punto.valor / maximo) * 100, punto.valor > 0 ? 8 : 3)}%` }}
            />
          </div>
          <span className={cx('text-center text-[10px]', punto.actual ? 'font-semibold text-blue-700' : 'text-tinta-tenue')}>
            {punto.etiqueta}
          </span>
        </div>
      ))}
    </div>
  )
}

function AnilloCobro({ cobrado, porCobrar }: { cobrado: number; porCobrar: number }) {
  const total = cobrado + porCobrar
  const proporcion = total > 0 ? cobrado / total : 0
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    const temporizador = window.setTimeout(() => setMontado(true), 80)
    return () => window.clearTimeout(temporizador)
  }, [])

  const radio = 42
  const circunferencia = 2 * Math.PI * radio
  const avance = montado ? proporcion : 0

  return (
    <div className="flex flex-col items-center gap-4 p-5">
      <div className="relative">
        <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
          <defs>
            <linearGradient id="gradiente-anillo" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r={radio} fill="none" strokeWidth="9" className="stroke-slate-200" />
          <circle
            cx="50"
            cy="50"
            r={radio}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            stroke="url(#gradiente-anillo)"
            strokeDasharray={circunferencia}
            strokeDashoffset={circunferencia * (1 - avance)}
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-tinta tabular-nums">{Math.round(proporcion * 100)}%</span>
          <span className="text-[10px] font-medium tracking-wide text-tinta-tenue uppercase">cobrado</span>
        </div>
      </div>
      <dl className="w-full space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-tinta-suave">Cobrado (histórico)</dt>
          <dd className="font-semibold text-emerald-700 tabular-nums">{formatoDinero(cobrado)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-tinta-suave">Por cobrar</dt>
          <dd className="font-semibold text-amber-700 tabular-nums">{formatoDinero(porCobrar)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-borde-suave pt-1.5">
          <dt className="text-tinta-suave">Facturado</dt>
          <dd className="font-semibold text-tinta tabular-nums">{formatoDinero(total)}</dd>
        </div>
      </dl>
    </div>
  )
}

function ListaBarras({ filas, color }: { filas: FilaBarra[]; color: string }) {
  const maximo = Math.max(...filas.map((fila) => fila.valor), 1)
  return (
    <ul className="space-y-3.5 p-5">
      {filas.map((fila) => (
        <li key={fila.clave}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium text-tinta">{fila.etiqueta}</span>
            <span className="shrink-0 font-semibold text-tinta-suave tabular-nums">{formatoDinero(fila.valor)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-superficie-2">
            <div
              className={cx('animar-barra h-full rounded-full', color)}
              style={{ width: `${Math.max((fila.valor / maximo) * 100, 3)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Inicio({ sesion, onIr }: { sesion: Session; onIr: (seccion: Seccion) => void }) {
  const [datos, setDatos] = useState<Resumen | null>(null)
  const [errorTablas, setErrorTablas] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void Promise.all([
      supabase.from('clientes').select('*').order('created_at', { ascending: false }),
      supabase.from('servicios').select('*'),
      supabase.from('pagos').select('*, clientes(nombre)').order('fecha', { ascending: false }),
      supabase.from('gastos').select('*').order('fecha', { ascending: false }),
      supabase.from('igualas').select('*'),
      supabase
        .from('crm_actividades')
        .select('*, crm_oportunidades(titulo, crm_empresas(nombre)), crm_contactos(nombre)')
        .eq('completada', false)
        .lt('fecha', hoyISO())
        .order('fecha', { ascending: true }),
    ]).then(([consultaClientes, consultaServicios, consultaPagos, consultaGastos, consultaIgualas, consultaActividades]) => {
      if (consultaClientes.error || consultaServicios.error || consultaPagos.error) setErrorTablas(true)
      setDatos({
        clientes: (consultaClientes.data ?? []) as Cliente[],
        servicios: (consultaServicios.data ?? []) as Servicio[],
        pagos: (consultaPagos.data ?? []) as Pago[],
        gastos: (consultaGastos.error ? [] : (consultaGastos.data ?? [])) as Gasto[],
        igualas: (consultaIgualas.error ? [] : (consultaIgualas.data ?? [])) as Iguala[],
        actividades: (consultaActividades.error ? [] : (consultaActividades.data ?? [])) as ActividadCrm[],
      })
    })
  }, [])

  const nombre = (sesion.user.email ?? 'equipo').split('@')[0]

  if (errorTablas) {
    return (
      <section>
        <CabeceraSeccion titulo={`Hola, ${nombre}`} descripcion="Resumen general de AviTech." />
        <Tarjeta>
          <div className="p-6 text-sm text-amber-700">
            Alguna tabla todavía no existe en la base de datos. Aplica las migraciones: GitHub → Actions → «Migrar base de datos» →
            Run workflow.
          </div>
        </Tarjeta>
      </section>
    )
  }

  if (!datos) {
    return (
      <section>
        <CabeceraSeccion titulo={`Hola, ${nombre}`} descripcion="Este es el resumen de AviTech hoy." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, indice) => (
            <Tarjeta key={indice} className="p-4">
              <div className="h-10 animate-pulse rounded-lg bg-superficie-2" />
            </Tarjeta>
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Tarjeta className="p-4 lg:col-span-2">
            <div className="h-48 animate-pulse rounded-lg bg-superficie-2" />
          </Tarjeta>
          <Tarjeta className="p-4">
            <div className="h-48 animate-pulse rounded-lg bg-superficie-2" />
          </Tarjeta>
        </div>
      </section>
    )
  }

  const clientes = datos.clientes
  const servicios = datos.servicios
  const pagos = datos.pagos
  const activos = clientes.filter((cliente) => cliente.estado === 'activo').length
  const enCurso = servicios.filter((servicio) => servicio.estado === 'en_curso').length
  const pendientesServicio = servicios.filter((servicio) => servicio.estado === 'pendiente').length
  const mesActual = mesActualISO()
  const cobradoMes = pagos
    .filter((pago) => pago.estado === 'pagado' && (pago.fecha ?? '').slice(0, 7) === mesActual)
    .reduce((total, pago) => total + Number(pago.monto), 0)
  const pendientesPago = pagos.filter((pago) => pago.estado === 'pendiente')
  const porCobrar = pendientesPago.reduce((total, pago) => total + Number(pago.monto), 0)
  const cobradoHistorico = pagos
    .filter((pago) => pago.estado === 'pagado')
    .reduce((total, pago) => total + Number(pago.monto), 0)
  const gastosMes = datos.gastos
    .filter((gasto) => (gasto.fecha ?? '').slice(0, 7) === mesActual)
    .reduce((total, gasto) => total + Number(gasto.monto), 0)
  const balanceMes = cobradoMes - gastosMes
  const igualasActivas = datos.igualas.filter((iguala) => iguala.estado === 'activa')
  const ingresoRecurrente = igualasActivas.reduce((total, iguala) => total + Number(iguala.monto_mensual), 0)
  const clientesConIguala = new Set(igualasActivas.map((iguala) => iguala.cliente_id)).size
  const serie = serieIngresos(pagos)
  const totalPeriodo = serie.reduce((total, punto) => total + punto.valor, 0)
  const recientes = clientes.slice(0, 5)
  const actividadesAtrasadas = datos.actividades
  const pagosVencidos = pendientesPago.filter((pago) => diasDeAtraso(pago.fecha) > 0)
  const totalVencido = pagosVencidos.reduce((total, pago) => total + Number(pago.monto), 0)
  const topPorCliente = topClientes(pagos, clientes)
  const gastosCategoria = gastosPorCategoria(datos.gastos, mesActual)

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-blue-700 uppercase">Resumen de hoy</p>
          <h2 className="text-[30px] leading-tight font-semibold tracking-tight text-tinta sm:text-[34px]">Hola, {nombre}</h2>
          <p className="mt-1.5 text-sm text-tinta-suave">Este es el pulso de AviTech hoy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton onClick={() => onIr('clientes')}>
            <Plus size={16} /> Cliente
          </Boton>
          <Boton variante="secundario" onClick={() => onIr('servicios')}>
            <Plus size={16} /> Servicio
          </Boton>
          <Boton variante="secundario" onClick={() => onIr('pagos')}>
            <Plus size={16} /> Pago
          </Boton>
          <Boton variante="secundario" onClick={() => onIr('facturacion')}>
            <Plus size={16} /> Factura
          </Boton>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-teal-700 ring-1 ring-teal-200">
            <Handshake size={18} />
          </span>
          <div>
            <p className="text-xs font-medium text-teal-800/80">Ingreso mensual recurrente (igualas)</p>
            <p className="text-lg font-semibold text-tinta tabular-nums">
              {formatoDinero(ingresoRecurrente)}
              <span className="ml-2 text-xs font-normal text-teal-800/70">
                {igualasActivas.length} activa{igualasActivas.length === 1 ? '' : 's'} en {clientesConIguala} cliente
                {clientesConIguala === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onIr('igualas')}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-100"
        >
          Ver igualas <ArrowRight size={13} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <TarjetaDato
          Icono={Users}
          claseIcono="bg-blue-50 text-blue-700"
          titulo="Clientes activos"
          valor={activos}
          detalle={`de ${clientes.length} en total`}
        />
        <TarjetaDato
          Icono={Briefcase}
          claseIcono="bg-sky-50 text-sky-700"
          titulo="Servicios en curso"
          valor={enCurso}
          detalle={`${pendientesServicio} ${pendientesServicio === 1 ? 'pendiente' : 'pendientes'} de iniciar`}
        />
        <TarjetaDato
          Icono={Banknote}
          claseIcono="bg-emerald-50 text-emerald-700"
          titulo="Cobrado este mes"
          valor={cobradoMes}
          formatear={(numero) => formatoDinero(Math.round(numero))}
          detalle="Pagos recibidos"
        />
        <TarjetaDato
          Icono={Clock}
          claseIcono="bg-amber-50 text-amber-700"
          titulo="Por cobrar"
          valor={porCobrar}
          formatear={(numero) => formatoDinero(Math.round(numero))}
          detalle={`${pendientesPago.length} pago${pendientesPago.length === 1 ? '' : 's'} pendiente${pendientesPago.length === 1 ? '' : 's'}`}
        />
        <TarjetaDato
          Icono={TrendingDown}
          claseIcono="bg-rose-50 text-rose-700"
          titulo="Gastos este mes"
          valor={gastosMes}
          formatear={(numero) => formatoDinero(Math.round(numero))}
          detalle="Salidas registradas"
        />
        <TarjetaDato
          Icono={PiggyBank}
          claseIcono="bg-cyan-50 text-cyan-700"
          titulo="Balance del mes"
          valor={balanceMes}
          formatear={(numero) => formatoDinero(Math.round(numero))}
          claseValor={balanceMes >= 0 ? 'text-emerald-700' : 'text-rose-700'}
          detalle="Cobrado − gastos"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <div className="flex items-center justify-between border-b border-borde-suave px-5 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-tinta">Actividades atrasadas</h3>
              <p className="mt-0.5 text-xs text-tinta-tenue">
                {actividadesAtrasadas.length === 0
                  ? 'Sin seguimientos vencidos'
                  : `${actividadesAtrasadas.length} ${
                      actividadesAtrasadas.length === 1 ? 'actividad requiere' : 'actividades requieren'
                    } atención`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onIr('crm')}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Ver CRM <ArrowRight size={13} />
            </button>
          </div>
          {actividadesAtrasadas.length === 0 ? (
            <Vacio icono={<Clock size={22} />} titulo="Todo al día" texto="No hay actividades atrasadas en el CRM." />
          ) : (
            <ul className="divide-y divide-borde-suave">
              {actividadesAtrasadas.slice(0, 5).map((actividad) => {
                const dias = diasDeAtraso(actividad.fecha)
                const contexto =
                  actividad.crm_oportunidades?.crm_empresas?.nombre ??
                  actividad.crm_oportunidades?.titulo ??
                  actividad.crm_contactos?.nombre ??
                  'Sin vincular'
                return (
                  <li
                    key={actividad.id}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-superficie-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                      <Clock size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-tinta">{actividad.titulo}</p>
                      <p className="truncate text-xs text-tinta-tenue">
                        {contexto} · {formatoFecha(actividad.fecha)} ·{' '}
                        <span className="font-medium text-red-700">
                          atrasada {dias} día{dias === 1 ? '' : 's'}
                        </span>
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta>
          <div className="flex items-center justify-between border-b border-borde-suave px-5 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-tinta">Pagos vencidos</h3>
              <p className="mt-0.5 text-xs text-tinta-tenue">
                {pagosVencidos.length === 0
                  ? 'Sin pagos vencidos'
                  : `${pagosVencidos.length} ${pagosVencidos.length === 1 ? 'pago vencido' : 'pagos vencidos'} · ${formatoDinero(totalVencido)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onIr('pagos')}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Ver pagos <ArrowRight size={13} />
            </button>
          </div>
          {pagosVencidos.length === 0 ? (
            <Vacio icono={<Banknote size={22} />} titulo="Todo cobrado" texto="No hay pagos vencidos por ahora." />
          ) : (
            <ul className="divide-y divide-borde-suave">
              {pagosVencidos.slice(0, 5).map((pago) => {
                const dias = diasDeAtraso(pago.fecha)
                return (
                  <li key={pago.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-superficie-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-tinta">{pago.concepto}</p>
                      <p className="truncate text-xs text-tinta-tenue">
                        {pago.clientes?.nombre ?? 'Cliente'} · {formatoFecha(pago.fecha)} ·{' '}
                        <span className="font-medium text-red-700">
                          vencido hace {dias} día{dias === 1 ? '' : 's'}
                        </span>
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-red-700 tabular-nums">{formatoDinero(pago.monto)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-borde-suave px-5 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-tinta">Ingresos últimos 6 meses</h3>
              <p className="mt-0.5 text-xs text-tinta-tenue">
                Total del periodo: <span className="font-medium text-tinta-suave">{formatoDinero(totalPeriodo)}</span>
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <TrendingUp size={17} />
            </span>
          </div>
          <GraficoIngresos serie={serie} />
        </Tarjeta>

        <Tarjeta>
          <div className="border-b border-borde-suave px-5 py-4">
            <h3 className="text-[15px] font-semibold text-tinta">Estado de cobro</h3>
            <p className="mt-0.5 text-xs text-tinta-tenue">Pagado vs. pendiente (todo el historial)</p>
          </div>
          <AnilloCobro cobrado={cobradoHistorico} porCobrar={porCobrar} />
        </Tarjeta>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <div className="flex items-center justify-between border-b border-borde-suave px-5 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-tinta">Top clientes</h3>
              <p className="mt-0.5 text-xs text-tinta-tenue">Por ingresos cobrados (histórico)</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Users size={17} />
            </span>
          </div>
          {topPorCliente.length === 0 ? (
            <Vacio
              icono={<Users size={22} />}
              titulo="Aún no hay ingresos"
              texto="Cuando registres pagos cobrados, verás aquí a tus mejores clientes."
            />
          ) : (
            <ListaBarras filas={topPorCliente} color="bg-gradient-to-r from-blue-600 to-cyan-400" />
          )}
        </Tarjeta>

        <Tarjeta>
          <div className="flex items-center justify-between border-b border-borde-suave px-5 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-tinta">Gastos del mes por categoría</h3>
              <p className="mt-0.5 text-xs text-tinta-tenue">Total: {formatoDinero(gastosMes)}</p>
            </div>
            <button
              type="button"
              onClick={() => onIr('gastos')}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Ver gastos <ArrowRight size={13} />
            </button>
          </div>
          {gastosCategoria.length === 0 ? (
            <Vacio
              icono={<TrendingDown size={22} />}
              titulo="Sin gastos este mes"
              texto="Registra un gasto para ver su distribución por categoría."
            />
          ) : (
            <ListaBarras filas={gastosCategoria} color="bg-gradient-to-r from-rose-500 to-orange-400" />
          )}
        </Tarjeta>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <div className="flex items-center justify-between border-b border-borde-suave px-5 py-4">
            <h3 className="text-[15px] font-semibold text-tinta">Últimos clientes</h3>
            <button
              type="button"
              onClick={() => onIr('clientes')}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Ver todos <ArrowRight size={13} />
            </button>
          </div>
          {recientes.length === 0 ? (
            <Vacio icono={<Users size={22} />} titulo="Aún no hay clientes" texto="Agrega tu primer cliente para verlo aquí." />
          ) : (
            <ul className="divide-y divide-borde-suave">
              {recientes.map((cliente) => (
                <li key={cliente.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-superficie-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-700">
                    {iniciales(cliente.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-tinta">{cliente.nombre}</p>
                    <p className="truncate text-xs text-tinta-tenue">{cliente.empresa ?? 'Sin empresa'}</p>
                  </div>
                  <Insignia color={colorEstadoCliente[cliente.estado] ?? 'slate'}>
                    {etiquetaEstadoCliente[cliente.estado] ?? cliente.estado}
                  </Insignia>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta>
          <div className="flex items-center justify-between border-b border-borde-suave px-5 py-4">
            <h3 className="text-[15px] font-semibold text-tinta">Pagos pendientes</h3>
            <button
              type="button"
              onClick={() => onIr('pagos')}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Ver todos <ArrowRight size={13} />
            </button>
          </div>
          {pendientesPago.length === 0 ? (
            <Vacio icono={<Banknote size={22} />} titulo="Todo cobrado" texto="No hay pagos pendientes por ahora. ¡Bien!" />
          ) : (
            <ul className="divide-y divide-borde-suave">
              {pendientesPago.slice(0, 5).map((pago) => (
                <li key={pago.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-superficie-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-tinta">{pago.concepto}</p>
                    <p className="truncate text-xs text-tinta-tenue">
                      {pago.clientes?.nombre ?? 'Cliente'} · {formatoFecha(pago.fecha)}
                      {diasDeAtraso(pago.fecha) > 0 && (
                        <>
                          {' · '}
                          <span className="font-medium text-red-700">
                            vencido hace {diasDeAtraso(pago.fecha)} día{diasDeAtraso(pago.fecha) === 1 ? '' : 's'}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={cx(
                      'shrink-0 text-sm font-semibold tabular-nums',
                      diasDeAtraso(pago.fecha) > 0 ? 'text-red-700' : 'text-tinta',
                    )}
                  >
                    {formatoDinero(pago.monto)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </section>
  )
}
