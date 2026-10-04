import { canOpenNativePath, openNativeAssociatedPath } from '@deepseek-ai/dsh-native-command'
import { AttachmentError, type AttachmentStore, validateAttachmentId } from './attachments.js'

export const ATTACHMENT_OPEN_TIMEOUT_MS = 15_000

/** The official Host-native boundary, replaceable without launching applications in tests. */
export interface AttachmentNativeAdapter {
  canOpenNativePath(): boolean
  openNativeAssociatedPath(path: string, signal: AbortSignal): Promise<void>
}

export interface AttachmentActionOptions { timeoutMs?: number }

export class AttachmentActionError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message)
    this.name = 'AttachmentActionError'
  }
}

const nativeAdapter: AttachmentNativeAdapter = { canOpenNativePath, openNativeAssociatedPath }

/** Stop waiting even when an adapter ignores cancellation; the operation still receives the signal. */
function boundedOperation<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason)
    if (signal.aborted) { abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve().then(() => {
      signal.throwIfAborted()
      return operation()
    }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Attachments are selected only by managed ID; neither route nor caller supplies an OS path. */
export function createAttachmentActions(
  attachments: Pick<AttachmentStore, 'previewFile'>,
  native: AttachmentNativeAdapter = nativeAdapter,
  options: AttachmentActionOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? ATTACHMENT_OPEN_TIMEOUT_MS
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new TypeError('Attachment open timeout must be between 1 and 60000 milliseconds.')
  }

  async function preparePreview(id: string): Promise<{ path: string }> {
    validateAttachmentId(id)
    try {
      const { path } = await attachments.previewFile(id)
      return { path }
    } catch (error) {
      if (error instanceof AttachmentError) throw error
      throw new AttachmentActionError('ATTACHMENT_PREVIEW_FAILED', 'The attachment could not be prepared for preview.', 500)
    }
  }

  return {
    capabilities(): { nativeOpen: boolean } { return { nativeOpen: native.canOpenNativePath() } },
    preparePreview,
    async open(id: string, signal: AbortSignal): Promise<void> {
      if (!native.canOpenNativePath()) {
        throw new AttachmentActionError('ATTACHMENT_OPEN_UNAVAILABLE', 'Opening an application is unavailable on this Host. Download the file to open it.', 409)
      }
      validateAttachmentId(id)
      const deadline = new AbortController()
      const timer = setTimeout(() => deadline.abort(), timeoutMs)
      const lifetime = AbortSignal.any([signal, deadline.signal])
      try {
        await boundedOperation(lifetime, async () => {
          const { path } = await preparePreview(id)
          lifetime.throwIfAborted()
          await native.openNativeAssociatedPath(path, lifetime)
          lifetime.throwIfAborted()
        })
      } catch (error) {
        if (lifetime.aborted) {
          if (signal.aborted) throw new AttachmentActionError('ATTACHMENT_OPEN_CANCELLED', 'Opening the attachment was cancelled.', 409)
          throw new AttachmentActionError('ATTACHMENT_OPEN_TIMEOUT', 'The application took too long to respond. Download the file to open it.', 504)
        }
        if (error instanceof AttachmentError || error instanceof AttachmentActionError) throw error
        // Native errors can contain the full local path or command output. Neither belongs in the response.
        throw new AttachmentActionError('ATTACHMENT_OPEN_FAILED', 'The attachment could not be opened. Check its default application or download the file.', 502)
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

export type AttachmentActions = ReturnType<typeof createAttachmentActions>
