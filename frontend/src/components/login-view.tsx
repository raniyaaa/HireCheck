"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Field, FullPageLoader, LogoMark, Notice } from "@/components/shared"
import { useBackendHealth } from "@/hooks/use-backend-health"
import { ApiError, BACKEND_URL, login, signup, type AuthResponse } from "@/lib/api"
import { clearFlashMessage, readFlashMessage, useAuth } from "@/lib/auth"

export function LoginView() {
  const router = useRouter()
  const { ready, user, signIn } = useAuth()

  // Already signed in (or just signed in) → go to the app.
  useEffect(() => {
    if (ready && user) router.replace("/")
  }, [ready, user, router])

  if (!ready) return <FullPageLoader />
  if (user) return <FullPageLoader label="Signing you in…" />
  return <LoginScreen onAuthenticated={signIn} />
}

function errorText(err: unknown): string {
  if (err instanceof ApiError && err.kind !== "http") return `Connection error: ${err.message}`
  return err instanceof Error ? err.message : String(err)
}

// Only ever mounted on the client (after `ready`), so reading sessionStorage
// in a state initializer can't cause a hydration mismatch.
function LoginScreen({ onAuthenticated }: { onAuthenticated: (res: AuthResponse) => void }) {
  const { online, recheck } = useBackendHealth({ poll: false })
  const [flash] = useState(readFlashMessage)

  useEffect(() => {
    clearFlashMessage()
  }, [])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10 sm:py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoMark className="size-10" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Sign in to HireCheck</h1>
            <p className="text-sm text-muted-foreground">AI-powered resume screening</p>
          </div>
        </div>

        {flash && <Notice variant="warning">{flash}</Notice>}

        <Card>
          <CardContent>
            {online === null && (
              <Notice
                variant="info"
                icon={<Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin text-blue-600" aria-hidden />}
                title="Connecting to the backend…"
              >
                If it has been idle, this can take up to a minute.
              </Notice>
            )}

            {online === false && (
              <div className="space-y-4">
                <Notice variant="error" title="Can't reach the backend">
                  Tried <code className="font-mono text-xs wrap-anywhere">{BACKEND_URL}</code>. For local
                  development, start it with{" "}
                  <code className="font-mono text-xs">uvicorn backend.main:app --reload --port 8000</code>.
                </Notice>
                <Button variant="outline" className="w-full" onClick={() => void recheck()}>
                  Try again
                </Button>
              </div>
            )}

            {online === true && (
              <Tabs defaultValue="login" className="gap-5">
                <TabsList className="w-full">
                  <TabsTrigger value="login">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <LoginForm onAuthenticated={onAuthenticated} />
                </TabsContent>
                <TabsContent value="signup">
                  <SignupForm onAuthenticated={onAuthenticated} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function LoginForm({ onAuthenticated }: { onAuthenticated: (res: AuthResponse) => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setWarning(null)
    setError(null)
    if (!username || !password) {
      setWarning("Enter both your username and password.")
      return
    }
    setPending(true)
    try {
      const res = await login(username, password)
      setPassword("")
      toast.success(`Welcome back, ${res.username}`)
      onAuthenticated(res)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field id="login-username" label="Username">
        <Input id="login-username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </Field>
      <Field id="login-password" label="Password">
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {warning && <Notice variant="warning">{warning}</Notice>}
      {error && <Notice variant="error">{error}</Notice>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}

function SignupForm({ onAuthenticated }: { onAuthenticated: (res: AuthResponse) => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("recruiter")
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setWarning(null)
    setError(null)
    if (!username || !password) {
      setWarning("Fill in every field.")
      return
    }
    if (password.length < 6) {
      setWarning("Password must be at least 6 characters.")
      return
    }
    setPending(true)
    try {
      const res = await signup(username, password, role)
      setPassword("")
      toast.success(`Account created. Welcome, ${res.username}`)
      onAuthenticated(res)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field id="signup-username" label="Username" hint="At least 3 characters.">
        <Input
          id="signup-username"
          autoComplete="username"
          aria-describedby="signup-username-hint"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>
      <Field id="signup-password" label="Password" hint="At least 6 characters.">
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          aria-describedby="signup-password-hint"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field id="signup-role" label="Account type">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="signup-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recruiter">Recruiter</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {warning && <Notice variant="warning">{warning}</Notice>}
      {error && <Notice variant="error">{error}</Notice>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  )
}
