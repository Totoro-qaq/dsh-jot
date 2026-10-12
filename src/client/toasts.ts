export interface ToastNotice {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

export interface ToastQueue {
  visible: ToastNotice | null
  /** 撤销提示还在时，后来的普通通知先停在这里，避免把撤销顶掉。 */
  deferred: ToastNotice | null
}

export const emptyToastQueue = (): ToastQueue => ({ visible: null, deferred: null })

/**
 * 带操作的提示（移到回收站后的撤销）不会被随后的普通通知替换。
 * 新的可撤销操作会换上自己的撤销；普通通知之间仍显示最新的一条。
 */
export function pushToast(queue: ToastQueue, notice: ToastNotice): ToastQueue {
  if (notice.action) return { visible: notice, deferred: queue.deferred }
  if (queue.visible?.action) return { visible: queue.visible, deferred: notice }
  return { visible: notice, deferred: queue.deferred }
}

/** 关掉当前这条之后，把暂存的普通通知显示出来。 */
export function dismissToast(queue: ToastQueue, id: number): ToastQueue {
  if (queue.visible?.id !== id) return queue
  return { visible: queue.deferred, deferred: null }
}
