"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Callout, Caption, FullPageLoader } from "@/components/display"
import { useBackendHealth } from "@/hooks/use-backend-health"
import { ApiError, BACKEND_URL, login, signup, type AuthResponse } from "@/lib/api"
import { clearFlashMessage, readFlashMessage, useAuth } from "@/lib/auth"

export function LoginView() {
  const router = useRouter()
  const { ready, user, signIn } = useAuth()

  // Already logged in (or just logged in) → go to the app.
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
    <main className="min-h-svh px-4 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tight">🔍 HireCheck ATS</h1>
        <Caption className="mt-1">AI-Powered Resume Screening Platform</Caption>

        {flash && (
          <Callout variant="warning" className="mt-6">
            🔒 {flash}
          </Callout>
        )}

        <div className="mt-6">
          {online === null && (
            <Callout variant="info">
              <span className="flex items-start gap-2">
                <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
                <span>
                  Connecting to the backend… If it has been idle, it can take up to a minute to wake up.
                </span>
              </span>
            </Callout>
          )}

          {online === false && (
            <div className="space-y-3">
              <Callout variant="error">
                ❌ Backend not reachable at <code className="font-mono">{BACKEND_URL}</code>
                {"\n\n"}For local development, start it with:{"\n"}
                <code className="font-mono">uvicorn backend.main:app --reload --port 8000</code>
              </Callout>
              <Button variant="outline" onClick={() => void recheck()}>
                Retry
              </Button>
            </div>
          )}

          {online === true && (
            <Tabs defaultValue="login">
              <TabsList variant="line">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-4">
                <LoginForm onAuthenticated={onAuthenticated} />
              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                <SignupForm onAuthenticated={onAuthenticated} />
              </TabsContent>
            </Tabs>
          )}
        </div>
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
      setWarning("Please enter both username and password")
      return
    }
    setPending(true)
    try {
      const res = await login(username, password)
      setPassword("")
      toast.success(`Welcome back, ${res.username}!`)
      onAuthenticated(res)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="login-username">Username</Label>
          <Input
            id="login-username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {warning && <Callout variant="warning">{warning}</Callout>}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {pending ? "Logging in…" : "Log In"}
        </Button>
      </form>
      {error && <Callout variant="error">{error}</Callout>}
    </div>
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
      setWarning("Please fill in all fields")
      return
    }
    if (password.length < 6) {
      setWarning("Password must be at least 6 characters")
      return
    }
    setPending(true)
    try {
      const res = await signup(username, password, role)
      setPassword("")
      toast.success(`Account created! Welcome, ${res.username}!`)
      onAuthenticated(res)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="signup-username">Choose a username</Label>
          <Input
            id="signup-username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">Choose a password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            aria-describedby="signup-password-help"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Caption className="text-xs">
            <span id="signup-password-help">Minimum 6 characters</span>
          </Caption>
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-role">Account type</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="signup-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recruiter">recruiter</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {warning && <Callout variant="warning">{warning}</Callout>}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {pending ? "Creating account…" : "Create Account"}
        </Button>
      </form>
      {error && <Callout variant="error">{error}</Callout>}
    </div>
  )
}
