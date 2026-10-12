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

/** 带撤销按钮的提示停留这么久；普通通知更短，而且不因忙碌暂停。 */
export const TOAST_ACTION_MS = 6000
export const TOAST_NOTICE_MS = 3500

/**
 * 这条提示还要等多久才消失。撤销提示在界面忙碌时暂停，剩余时间保持不变。
 * 换了一条提示（编号不同）时从完整时长重新计。
 */
export function toastDeadline(input: {
  id: number
  hasAction: boolean
  busy: boolean
  clock: { id: number; remainingMs: number } | null
}): { delayMs: number | null; clock: { id: number; remainingMs: number } | null } {
  if (!input.hasAction) return { delayMs: TOAST_NOTICE_MS, clock: null }
  const clock = input.clock?.id === input.id ? input.clock : { id: input.id, remainingMs: TOAST_ACTION_MS }
  if (input.busy) return { delayMs: null, clock }
  return { delayMs: clock.remainingMs, clock }
}

/** 计时器被清掉时扣掉已经走掉的时间，忙碌期间不要调用。 */
export function toastRemainingAfter(remainingMs: number, elapsedMs: number): number {
  return Math.max(0, remainingMs - Math.max(0, elapsedMs))
}

/**
 * 计时效果只该依赖提示编号，以及撤销提示是否因忙碌而暂停。
 * 普通通知的 `paused` 一直是 false，界面变忙不会重开它的计时器。
 */
export function toastTimerDeps(id: number, hasAction: boolean, busy: boolean): { id: number; paused: boolean } {
  return { id, paused: hasAction && busy }
}

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

/**
 * 取出一条可执行的提示操作。界面正忙时原样返回：perform 会直接结束，
 * 先关掉提示再调用，这次撤销就丢了。
 */
export function activateToast(queue: ToastQueue, id: number, busy: boolean): { queue: ToastQueue; run: (() => void) | null } {
  const visible = queue.visible
  if (!visible || visible.id !== id || !visible.action || busy) return { queue, run: null }
  return { queue: dismissToast(queue, id), run: visible.action.run }
}
