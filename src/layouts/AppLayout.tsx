import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Upload, CheckCircle2, GitMerge, BellRing, BookOpen, ShieldCheck, Settings, LogOut, Store, BarChart3, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { ProfileModal } from '@/components/common/ProfileModal'
import { Button } from '@/components/ui/button'

interface AppLayoutProps {
  children: React.ReactNode
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut, isDemoMode } = useAuth()
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const navItems = [
    { path: '/', label: '1. Upload', icon: Upload, description: 'Ledger & Statement' },
    { path: '/review', label: '2. Review & Fix', icon: CheckCircle2, description: 'Verify Entries' },
    { path: '/matches', label: '3. Matches', icon: GitMerge, description: 'Reconcile UPI' },
    { path: '/reminders', label: '4. Dashboard', icon: BellRing, description: 'Reminders & Follow-ups' },
    { path: '/analytics', label: '5. Analytics', icon: BarChart3, description: 'Financial Insights' },
    { path: '/eval', label: 'Eval', icon: FlaskConical, description: 'Accuracy Benchmark' },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/30 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900 font-sans">Khata<span className="text-emerald-600">Match</span></span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">AI</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  {profile?.shop_name ? profile.shop_name : 'AI Ledger & UPI Reconciliation'}
                </p>
              </div>
            </Link>

            {/* Stepper Navigation for Desktop */}
            <nav className="hidden md:flex items-center space-x-1 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                const Icon = item.icon
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
                      isActive
                        ? "bg-white text-emerald-800 shadow-sm border border-slate-200/60"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isActive ? "text-emerald-600" : "text-slate-400")} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Safe AI Badge & User Controls */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="hidden lg:flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200/80 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Human in Control</span>
              </div>

              {/* Profile & Shop Settings Trigger */}
              <button
                onClick={() => setIsProfileOpen(true)}
                title="Shop Settings & Preferences"
                className="flex items-center space-x-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
              >
                <Store className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">{profile?.shop_name || 'My Shop'}</span>
                <Settings className="w-3 h-3 text-slate-400 ml-0.5" />
              </button>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 bg-white py-2 px-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors",
                  isActive ? "text-emerald-600 font-bold" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Icon className={cn("w-4 h-4 mb-0.5", isActive ? "text-emerald-600" : "text-slate-400")} />
                <span>{item.label.split('. ')[1]}</span>
              </Link>
            )
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 KhataMatch. Built for Indian Shopkeepers, Tailors & Freelancers.</p>
          <div className="flex items-center space-x-3 text-slate-400">
            <span>🔒 Row-Level Security</span>
            <span>•</span>
            <span>📱 WhatsApp Click-to-Chat</span>
            <span>•</span>
            <span>⚡ Supabase Auth</span>
          </div>
        </div>
      </footer>

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  )
}
