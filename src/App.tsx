import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { UploadPage } from '@/pages/UploadPage'
import { ReviewFixPage } from '@/pages/ReviewFixPage'
import { MatchesPage } from '@/pages/MatchesPage'
import { RemindersDashboardPage } from '@/pages/RemindersDashboardPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { EvaluationPage } from '@/pages/EvaluationPage'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <UploadPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/review"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReviewFixPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/matches"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <MatchesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reminders"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <RemindersDashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AnalyticsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/eval"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <EvaluationPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
