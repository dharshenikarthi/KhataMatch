import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookOpen, ShieldCheck, Sparkles, Lock, Mail, Store, AlertCircle, Loader2, ArrowRight } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopName, setShopName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { signIn, signUp, demoLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return
    }

    setIsLoading(true)

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, shopName)
        if (error) {
          setErrorMessage(error)
          setIsLoading(false)
          return
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setErrorMessage(error)
          setIsLoading(false)
          return
        }
      }

      navigate(from, { replace: true })
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoAccess = () => {
    demoLogin()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-700 to-emerald-500 text-white shadow-lg shadow-emerald-700/20 mb-1">
            <BookOpen className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            Khata<span className="text-emerald-600">Match</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            AI Ledger & UPI Reconciliation for Indian Shopkeepers
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
          <CardHeader className="space-y-1 pb-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setErrorMessage(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  !isSignUp ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setErrorMessage(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  isSignUp ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Shop / Business Name</label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <Input
                      type="text"
                      placeholder="e.g. Murugan Provision Store"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <Input
                    type="email"
                    required
                    placeholder="shopkeeper@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Password</label>
                  {!isSignUp && (
                    <span className="text-[11px] text-slate-400 font-medium">Min. 6 chars</span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-700/20 mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1.5">
                    <span>{isSignUp ? 'Create My Account' : 'Sign In to KhataMatch'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <span className="relative bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Or Instant Preview
              </span>
            </div>

            {/* Quick Demo Access Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleDemoAccess}
              className="w-full h-11 border-dashed border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl font-bold text-xs"
            >
              <Sparkles className="w-4 h-4 mr-2 text-emerald-600" />
              1-Click Demo Access (No Password Required)
            </Button>
          </CardContent>

          <CardFooter className="py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-center text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 mr-1.5" />
            <span>Row-Level Security & Private Encrypted Ledgers</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
