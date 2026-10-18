import type { ReactNode } from "react"

import { HeaderLogo } from "@/components/Header/HeaderLogo"
import { HeaderNav } from "@/components/Header/HeaderNav"
import { ThemeSwitcher } from "@/components/Header/ThemeSwitcher"

type HeaderProps = {
  // Auth-aware menu (sign-in CTA / user dropdown). Passed as a slot so
  // `components/` doesn't have to import from `features/auth`.
  userMenu: ReactNode
  // Search box, passed as a slot for the same reason. Its root element must
  // be a flex item of the bar below (it wraps onto its own row on small screens).
  search?: ReactNode
}

export function Header({ userMenu, search }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <HeaderLogo />
        <HeaderNav />
        {search}
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitcher />
          {userMenu}
        </div>
      </div>
    </header>
  )
}
