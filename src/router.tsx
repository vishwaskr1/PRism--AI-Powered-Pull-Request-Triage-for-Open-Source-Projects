import { createContext, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from "react"

type RouterContextValue = {
  location: string
  navigate: (to: string, options?: { replace?: boolean }) => void
}

const RouterContext = createContext<RouterContextValue | null>(null)

export function BrowserRouter({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(() => `${window.location.pathname}${window.location.search}${window.location.hash}`)

  useEffect(() => {
    const handlePopState = () => setLocation(`${window.location.pathname}${window.location.search}${window.location.hash}`)
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const value = useMemo<RouterContextValue>(() => ({
    location,
    navigate(to, options) {
      if (options?.replace) window.history.replaceState(null, "", to)
      else window.history.pushState(null, "", to)
      setLocation(`${window.location.pathname}${window.location.search}${window.location.hash}`)
      window.scrollTo({ top: 0, behavior: "auto" })
    },
  }), [location])

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useNavigate() {
  const router = useContext(RouterContext)
  if (!router) throw new Error("useNavigate must be used inside BrowserRouter")
  return router.navigate
}

export function useLocation() {
  const router = useContext(RouterContext)
  if (!router) throw new Error("useLocation must be used inside BrowserRouter")
  return router.location
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean }

export function Link({ to, replace, onClick, target, ...props }: LinkProps) {
  const navigate = useNavigate()
  return <a
    {...props}
    href={to}
    target={target}
    onClick={(event) => {
      onClick?.(event)
      if (event.defaultPrevented || target || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      navigate(to, { replace })
    }}
  />
}
