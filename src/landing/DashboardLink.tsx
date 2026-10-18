import type { AnchorHTMLAttributes, ReactNode } from "react"
import { DASHBOARD_URL, dashboardHref } from "./content"
import { Link } from "../router"

type DashboardLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  repoUrl?: string
  children: ReactNode
}

export function DashboardLink({ repoUrl, children, ...props }: DashboardLinkProps) {
  const to = dashboardHref(repoUrl)
  if (/^https?:\/\//i.test(DASHBOARD_URL)) {
    return <a {...props} href={to}>{children}</a>
  }
  return <Link {...props} to={to}>{children}</Link>
}
