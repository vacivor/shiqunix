const shiftedSymbols: Record<string, string> = {
  '`': '~', '1': '!', '2': '@', '3': '#', '4': '$', '5': '%',
  '6': '^', '7': '&', '8': '*', '9': '(', '0': ')', '-': '_',
  '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '"',
  ',': '<', '.': '>', '/': '?',
}

export function KeyLegend({ label }: { label: string }) {
  const base = label === '~' ? '`' : label === '−' ? '-' : label
  const shifted = shiftedSymbols[base]
  return <span className={`key-legend ${shifted ? 'dual-legend' : ''}`}>
    {shifted && <span>{shifted}</span>}
    <span>{base}</span>
  </span>
}
