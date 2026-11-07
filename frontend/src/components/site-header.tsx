"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon, LogOutIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BackendStatusIndicator } from "@/components/backend-status"
import { LogoMark } from "@/components/shared"
import { useAuth, type AuthUser } from "@/lib/auth"
import { cn } from "@/lib/utils"

export function SiteHeader({ user }: { user: AuthUser }) {
  const pathname = usePathname()
  const links = [
    { href: "/", label: "Screening" },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ]

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <Link href="/" aria-label="HireCheck home" className="flex items-center gap-2 rounded-md font-semibold tracking-tight">
          <LogoMark />
          <span className="hidden min-[420px]:inline">HireCheck</span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <BackendStatusIndicator />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function UserMenu({ user }: { user: AuthUser }) {
  const { signOut } = useAuth()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 md:px-2" aria-label={`Account menu for ${user.username}`}>
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground"
          >
            {initials(user.username)}
          </span>
          <span className="hidden max-w-32 truncate text-sm md:inline">{user.username}</span>
          <ChevronDownIcon className="hidden text-muted-foreground md:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{user.username}</p>
          <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()}>
          <LogOutIcon aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
