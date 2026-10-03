import { useState, useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'

/** Test-only additive plugin. It never replaces a shipped singleton slot. */
export const name = 'dsh-jot-coexist-fixture-client'
export const inject = ['slots', 'layout', 'sidebarRightTabs']
export const PANEL_ID = 'dsh-jot-coexist-fixture' as MainPanelId
export const TAB_ID = 'dsh-jot-coexist-fixture/panel'
export const TAB_KIND = 'dsh-jot-coexist-fixture'

const fixtureCss = `
.dsqa-coexist{box-sizing:border-box;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14,inherit);font-family:var(--dsw-font-family,inherit);font-size:var(--dsh-content-font-size,14px);line-height:22px}
.dsqa-coexist *, .dsqa-coexist *:before, .dsqa-coexist *:after{box-sizing:border-box}
.dsqa-coexist-panel{height:100%;min-height:0;overflow:auto;padding:16px;background:var(--dsw-alias-bg-layer-1)}
.dsqa-coexist-panel h1{font:inherit;font-size:16px;font-weight:600;margin:0 0 12px}
.dsqa-coexist-panel p{margin:0 0 12px}.dsqa-coexist-panel label{display:block;margin:12px 0}
.dsqa-coexist button,.dsqa-coexist input{font:inherit;color:inherit}
.dsqa-coexist button{min-height:28px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);padding:2px 8px;cursor:pointer}
.dsqa-coexist button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsqa-coexist input[type=text]{width:100%;min-height:28px;padding:3px 7px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1)}
.dsqa-coexist :focus-visible{outline:2px solid var(--dsw-static-blue-450);outline-offset:2px}
.dsqa-coexist-overlay{position:absolute;inset:0;pointer-events:none!important}
.dsqa-coexist-decoration{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(135deg,transparent 0 47px,color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent) 47px 48px)}
.dsqa-coexist-badge{position:absolute;left:12px;bottom:12px;pointer-events:auto;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);padding:5px 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12,inherit)}
.dsqa-coexist-badge button{font:inherit;white-space:nowrap}.dsqa-coexist-badge output{min-width:0;white-space:nowrap}
`

function FixtureIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h7v6H4zm9 0h7v6h-7zM4 13h7v6H4zm9 0h7v6h-7z" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
}

export function apply(ctx: Context): void {
  let snapshot = { decoration: true, pulse: 0 }
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
  const getSnapshot = () => snapshot
  const toggleDecoration = () => { snapshot = { ...snapshot, decoration: !snapshot.decoration }; listeners.forEach(listener => listener()) }
  ctx.effect(() => {
    const timer = setInterval(() => {
      snapshot = { ...snapshot, pulse: snapshot.pulse + 1 }
      listeners.forEach(listener => listener())
    }, 1000)
    return () => { clearInterval(timer); listeners.clear() }
  }, 'coexist fixture: bounded test heartbeat')

  function FixturePanel() {
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    const [text, setText] = useState('Other plugin draft')
    return <section className="dsqa-coexist dsqa-coexist-panel" data-dsqa-coexist-panel="" aria-label="Coexistence fixture">
      <style>{fixtureCss}</style>
      <h1>Coexistence fixture</h1>
      <p>独立测试插件：背景装饰、全局入口和原生右栏页。</p>
      <label><input type="checkbox" checked={state.decoration} onChange={toggleDecoration} /> 显示可穿透点击的装饰层</label>
      <label>另一插件的输入框<input type="text" value={text} onChange={event => setText(event.target.value)} /></label>
      <p>切换右栏页后，这个输入框应保留文字。装饰层不应挡住 Jot 的按钮、编辑器或弹层。</p>
      <output aria-label="Fixture heartbeat" data-dsqa-heartbeat={state.pulse}>Heartbeat {state.pulse}</output>
    </section>
  }
  function FixtureOverlay() {
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    return <div className="dsqa-coexist dsqa-coexist-overlay" data-dsqa-coexist-overlay="">
      <style>{fixtureCss}</style>
      {state.decoration && <div className="dsqa-coexist-decoration" aria-hidden="true" />}
      <div className="dsqa-coexist-badge">
        <button type="button" onClick={toggleDecoration} aria-pressed={state.decoration}>QA decoration</button>
        <button type="button" onClick={() => ctx.layout.selectPanel(PANEL_ID)}>QA panel</button>
        <output aria-label="Fixture heartbeat" data-dsqa-heartbeat={state.pulse}>{state.pulse}s</output>
      </div>
    </div>
  }

  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, FixturePanel))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 31, label: 'Coexist QA' }, FixtureIcon))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'dsh-jot-coexist-fixture/decoration', order: 30 }, FixtureOverlay))
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID, kind: TAB_KIND, title: () => 'Coexist QA', keepMounted: true,
    guide: [{ id: 'coexist', order: 31, icon: FixtureIcon, title: () => 'Coexist QA', description: () => 'Independent plugin input and decoration' }],
  }), 'coexist fixture: independent tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, FixturePanel))
}

export default { name, inject, apply }
