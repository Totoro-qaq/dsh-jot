import type { ExportCapabilities, ExportFormat, ExportHealth, JotApi, JotLocale } from './types.js'

const OPTIONAL_FORMATS = ['pdf', 'docx'] as const
const ENGINE_CODES = { pdf: 'PDF_ENGINE_UNAVAILABLE', docx: 'DOCX_ENGINE_UNAVAILABLE' } as const

export function initialExportHealth(checking = true): ExportHealth {
  return { txt: { status: 'ready' }, md: { status: 'ready' },
    pdf: { status: checking ? 'checking' : 'unknown' }, docx: { status: checking ? 'checking' : 'unknown' } }
}

/** Keep diagnostics bounded and local: never display an arbitrary Host message or file path. */
function readHealth(value: ExportCapabilities): ExportHealth {
  const health = initialExportHealth(false)
  for (const format of OPTIONAL_FORMATS) {
    const status = value?.[format]?.status
    if (status === 'ready' || status === 'checking') health[format] = { status }
    else if (status === 'unavailable') health[format] = { status, code: ENGINE_CODES[format] }
  }
  return health
}

export function exportBlocked(health: ExportHealth | undefined, format: ExportFormat): boolean {
  const status = health?.[format].status
  return status === 'checking' || status === 'unavailable'
}

export function exportFormatNotice(health: ExportHealth | undefined, format: ExportFormat, locale: JotLocale): string {
  if (format === 'txt' || format === 'md') return ''
  const en = locale === 'en'
  const label = format === 'pdf' ? 'PDF' : 'Word'
  const status = health?.[format].status ?? 'unknown'
  if (status === 'checking') return en ? `Checking ${label} export…` : `正在检查 ${label} 导出…`
  if (status === 'unavailable') return en
    ? `${label} export is unavailable: its engine could not be loaded (${ENGINE_CODES[format]}).`
    : `${label} 导出不可用：导出模块未能加载（${ENGINE_CODES[format]}）。`
  if (status === 'unknown') return en ? `${label}: Export readiness has not been checked.` : `${label}：尚未检测导出是否可用。`
  return ''
}

export function exportHealthNotice(health: ExportHealth, locale: JotLocale): string {
  const en = locale === 'en'
  const formats = OPTIONAL_FORMATS.filter(format => health[format].status !== 'ready')
  if (!formats.length) return ''
  const details = formats.map(format => exportFormatNotice(health, format, locale))
  const unique = [...new Set(details)]
  const explanation = formats.some(format => health[format].status === 'unavailable')
    ? en ? 'This does not disable notes or other export formats.' : '不影响笔记功能和其他正常的导出格式。'
    : formats.some(format => health[format].status === 'checking')
      ? en ? 'Checks run in the background without blocking notes.' : '检查在后台进行，不影响编辑笔记。'
      : en ? 'This check does not disable notes. Unchecked formats may still be tried.' : '此次检查不影响笔记功能，未检测的格式仍可尝试导出。'
  return `${unique.join(en ? ' ' : '')} ${explanation}`
}

export function exportFormatLabel(format: ExportFormat, health: ExportHealth, locale: JotLocale): string {
  const en = locale === 'en'
  const label = format === 'docx' ? en ? 'Word (DOCX)' : 'Word（DOCX）'
    : format === 'md' ? 'Markdown' : format === 'pdf' ? 'PDF' : en ? 'Plain text (TXT)' : '纯文本（TXT）'
  const status = health[format].status
  const suffix = status === 'checking' ? en ? 'Checking' : '检查中'
    : status === 'unavailable' ? en ? 'Unavailable' : '不可用'
      : status === 'unknown' ? en ? 'Unchecked' : '未检测' : ''
  return `${label}${suffix ? ` · ${suffix}` : ''}`
}

interface WatchOptions {
  onChange(health: ExportHealth): void
  /** A manual snapshot refresh must not forget a verified failure. */
  initialHealth?: ExportHealth
  intervalMs?: number
  requestTimeoutMs?: number
  maxAttempts?: number
  schedule?: typeof setTimeout
  cancel?: typeof clearTimeout
}

/** Start before any export gesture; bounded polling never blocks notes or outlives its panel. */
export function watchExportHealth(get: JotApi['getExportCapabilities'], options: WatchOptions): () => void {
  const schedule = options.schedule ?? setTimeout
  const cancel = options.cancel ?? clearTimeout
  let active = true
  let attempts = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let request: AbortController | undefined
  let last = initialExportHealth(Boolean(get))
  for (const format of OPTIONAL_FORMATS) {
    if (options.initialHealth?.[format].status === 'unavailable') last[format] = options.initialHealth[format]
  }
  const publish = (health: ExportHealth) => { if (active) { last = health; options.onChange(health) } }
  publish(last)
  const check = async () => {
    if (!active || !get) return
    attempts++
    request = new AbortController()
    const current = request
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        deadline = schedule(() => { current.abort(); reject(new Error('Export health check timed out.')) }, options.requestTimeoutMs ?? 5000)
      })
      const health = readHealth(await Promise.race([get({ signal: current.signal }), timeout]))
      if (!active) return
      const checking = OPTIONAL_FORMATS.filter(format => health[format].status === 'checking')
      if (checking.length && attempts >= (options.maxAttempts ?? 15)) {
        for (const format of checking) health[format] = { status: 'unknown' }
      }
      // Only a real ready response may clear a known failed format. An old Host,
      // malformed snapshot or a pending check is not evidence of recovery.
      for (const format of OPTIONAL_FORMATS) {
        if (last[format].status === 'unavailable' && health[format].status !== 'ready') health[format] = last[format]
      }
      publish(health)
      if (checking.length && attempts < (options.maxAttempts ?? 15)) {
        timer = schedule(() => { void check() }, options.intervalMs ?? 1000)
      }
    } catch {
      const health = { ...last }
      // A failed refresh cannot re-enable an engine already known to be broken.
      for (const format of OPTIONAL_FORMATS) if (health[format].status === 'checking') health[format] = { status: 'unknown' }
      publish(health)
    }
    finally { if (deadline !== undefined) { cancel(deadline); deadline = undefined } }
  }
  void check()
  return () => { active = false; request?.abort(); if (timer !== undefined) cancel(timer); if (deadline !== undefined) cancel(deadline) }
}
