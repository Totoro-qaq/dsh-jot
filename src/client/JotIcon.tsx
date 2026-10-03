export interface JotIconProps {
  /** The native sidebar asks for 16px expanded and 18px in its compact rail. */
  size?: number
  active?: boolean
  className?: string
}

/** Bamboo cover, warm paper and a golden bookmark; fills remain legible at 16px. */
export function JotIcon({ size = 18, active = false, className }: JotIconProps) {
  return <svg viewBox="0 0 24 24" width={size} height={size} className={className}
    aria-hidden="true" focusable="false" style={{ display: 'block', flex: 'none' }}>
    <rect x="3.5" y="2.5" width="17" height="19" rx="2.5" fill={active ? '#28765F' : '#3B8C76'} />
    <path d="M7 2.5v19H6a2.5 2.5 0 0 1-2.5-2.5V5A2.5 2.5 0 0 1 6 2.5h1Z" fill="#185F50" />
    <rect x="7" y="4" width="12" height="16" rx="1.25" fill="#FFF9EA" />
    <path d="M14 4h3v6l-1.5-1-1.5 1V4Z" fill="#E6AD54" />
    <path d="M9.5 12.5h7M9.5 16h5" fill="none" stroke="#286B5D" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
}
