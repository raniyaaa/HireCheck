import { AppShell } from "@/components/app-shell"

// Every signed-in page shares the header and the auth gate.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>
}
