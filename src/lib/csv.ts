/** Valor de una celda exportada: los nulos se escriben vacíos. */
export type ValorCelda = string | number | null | undefined

/** Descarga un texto ya formateado como CSV en UTF-8 con BOM. */
export function descargarContenidoCSV(nombreArchivo: string, contenido: string): void {
  const blob = new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo.toLowerCase().endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}

/**
 * Escapa una celda para CSV: duplica las comillas dobles y encapsula el valor
 * cuando contiene el separador, comillas o saltos de línea.
 */
export function celdaCSV(valor: ValorCelda, separador = ','): string {
  const texto = valor == null ? '' : String(valor)
  const necesitaComillas = texto.includes(separador) || /["\r\n]/.test(texto)
  return necesitaComillas ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** Une las filas (cabecera incluida) en un documento CSV con el separador indicado. */
export function construirCSV(filas: ValorCelda[][], separador = ','): string {
  return filas.map((fila) => fila.map((celda) => celdaCSV(celda, separador)).join(separador)).join('\r\n')
}

/** Descarga una tabla como CSV compatible con Excel (BOM + comillas). */
export function descargarCSV(nombreArchivo: string, filas: Array<Array<string | number>>): void {
  const contenido = filas
    .map((fila) => fila.map((celda) => `"${String(celda).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  descargarContenidoCSV(nombreArchivo, contenido)
}
