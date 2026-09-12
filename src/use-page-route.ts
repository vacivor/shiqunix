import { useEffect, useSyncExternalStore } from 'react'

const pages = ['keymap', 'lighting', 'fn', 'tester', 'logs'] as const
export type Page = typeof pages[number]

function readPage(): Page {
  const path = window.location.hash.slice(1).split('?')[0].replace(/^\//, '').replace(/\/$/, '')
  return pages.includes(path as Page) ? path as Page : 'keymap'
}
function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

// Hash paths work on GitHub Pages without server-side fallback rewrites.
export function usePageRoute() {
  const page = useSyncExternalStore(subscribe, readPage, () => 'keymap' as Page)
  useEffect(() => {
    const normalize = () => {
      const canonical = `#/${readPage()}`
      if (window.location.hash !== canonical) window.history.replaceState(null, '', canonical)
    }
    normalize()
    window.addEventListener('hashchange', normalize)
    return () => window.removeEventListener('hashchange', normalize)
  }, [])
  return page
}
