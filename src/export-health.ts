export type ExportFormat = 'txt' | 'md' | 'pdf' | 'docx'
type OptionalFormat = 'pdf' | 'docx'
export interface ExportCapability { status: 'checking' | 'ready' | 'unavailable'; code?: string }
export type ExportCapabilities = Record<ExportFormat, ExportCapability>

class ExportUnavailable extends Error {
  readonly status = 409
  readonly code: string
  constructor(format: OptionalFormat, cause: unknown) {
    super(`${format === 'pdf' ? 'PDF' : 'Word'} export is unavailable. Notes and other export formats are unaffected.`, { cause })
    this.code = `${format.toUpperCase()}_ENGINE_UNAVAILABLE`
  }
}

/** One synthetic preflight per optional engine; never reads or modifies a user's notes. */
export function createExportHealth(probes: Record<OptionalFormat, () => Promise<unknown>>, timeoutMs = 10_000) {
  const states: ExportCapabilities = { txt: { status: 'ready' }, md: { status: 'ready' },
    pdf: { status: 'checking' }, docx: { status: 'checking' } }
  const pending = new Map<OptionalFormat, Promise<void>>()
  const check = (format: OptionalFormat): Promise<void> => {
    const existing = pending.get(format)
    if (existing) return existing
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Exporter preflight timed out.')), timeoutMs)
    })
    const result = Promise.race([Promise.resolve().then(probes[format]), timeout]).then(() => {
      states[format] = { status: 'ready' }
    }, cause => {
      const error = new ExportUnavailable(format, cause)
      states[format] = { status: 'unavailable', code: error.code }
      throw error
    }).finally(() => clearTimeout(timer))
    // The background caller is deliberately non-blocking, and must never reject unhandled.
    void result.catch(() => {})
    pending.set(format, result)
    return result
  }
  return {
    start() { void check('pdf'); void check('docx') },
    snapshot(): ExportCapabilities { return structuredClone(states) },
    async require(format: ExportFormat) { if (format === 'pdf' || format === 'docx') await check(format) },
  }
}
