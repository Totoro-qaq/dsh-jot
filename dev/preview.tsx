import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JotApp } from '../src/client/App.js';

// Approximate DSH dark tokens so theme-dependent styles can be checked without a Host.
const darkTokens = `body[data-ds-dark-theme]{background:#1d1d1f;color-scheme:dark}
body[data-ds-dark-theme] .preview-frame{background:#232325}
body[data-ds-dark-theme] .preview-nav{background:#232325;border-color:#38383c;color:#e8e8ea}
body[data-ds-dark-theme] :is(.jot-app,.jot-overlay-root){--dsw-alias-bg-layer-1:#232325;--dsw-alias-label-primary:#e8e8ea;--dsw-alias-label-secondary:#9a9aa0;--dsw-alias-border-l3:#38383c;--dsw-alias-interactive-bg-hover:#ffffff14;--dsw-alias-button-primary-fill:#e8e8ea;--dsw-alias-button-primary-hover:#d0d0d4;--dsw-alias-label-primary-inverted:#232325;--dsw-alias-link:#7aa7ff;--dsw-alias-markdown-inline-code:#33343a;--dsw-alias-markdown-code-block:#2a2b30;--dsw-alias-toast-bg:#3a3b40}`;

function Preview() {
  const params = new URLSearchParams(location.search);
  const [compact, setCompact] = useState(params.get('mode') === 'compact');
  const [dark, setDark] = useState(params.get('theme') === 'dark');
  const [locale, setLocale] = useState<'zh' | 'en'>(params.get('lang') === 'en' ? 'en' : 'zh');
  useEffect(() => { document.body.toggleAttribute('data-ds-dark-theme', dark) }, [dark]);
  return <>
    <style>{darkTokens}</style>
    <nav className="preview-nav" aria-label="预览尺寸">
      <span>随记 <small>Jot</small></span>
      <div>
        <button onClick={() => setCompact(false)} aria-pressed={!compact}>工作台</button>
        <button onClick={() => setCompact(true)} aria-pressed={compact}>侧栏</button>
        <button onClick={() => setDark(value => !value)} aria-pressed={dark}>深色</button>
        <button onClick={() => setLocale(value => value === 'zh' ? 'en' : 'zh')} aria-pressed={locale === 'en'}>English</button>
      </div>
    </nav>
    <main className={compact ? 'preview-frame preview-compact' : 'preview-frame'}>
      <JotApp mode={compact ? 'compact' : 'wide'} locale={locale} onExpand={() => setCompact(false)} />
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
