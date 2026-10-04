import { writeFile } from 'node:fs/promises'
import { JOT_ACTION_ICON_NAMES } from '../src/client/icons.tsx'
import { actionIconSvg } from './icon-assets.tsx'

// Regenerate assets/icons from src/client/icons.tsx: `pnpm icons`.
for (const name of JOT_ACTION_ICON_NAMES) await writeFile(new URL(`../assets/icons/${name}.svg`, import.meta.url), actionIconSvg(name))
console.log(`Wrote ${JOT_ACTION_ICON_NAMES.length} action icons.`)
