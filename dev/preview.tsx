import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JotApp } from '../src/client/App.js';

function Preview() {
  const [compact, setCompact] = useState(new URLSearchParams(location.search).get('mode') === 'compact');
  return <>
    <nav className="preview-nav" aria-label="预览尺寸">
      <span>随记 <small>Jot</small></span>
      <div><button onClick={() => setCompact(false)} aria-pressed={!compact}>工作台</button><button onClick={() => setCompact(true)} aria-pressed={compact}>侧栏</button></div>
    </nav>
    <main className={compact ? 'preview-frame preview-compact' : 'preview-frame'}>
      <JotApp mode={compact ? 'compact' : 'wide'} onExpand={() => setCompact(false)} />
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
