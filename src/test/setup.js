import '@testing-library/jest-dom'
import { beforeEach, afterEach, vi } from 'vite-plus/test'

// A developer's .env holds real PostHog credentials, and Vite loads it in test
// mode too — which would mount the cookie banner inside every test that renders
// <App />, and its "Privacy Policy" link would collide with the footer's. Tests
// that are about the banner stub these back on themselves.
beforeEach(() => {
  vi.stubEnv('VITE_POSTHOG_KEY', '')
  vi.stubEnv('VITE_POSTHOG_HOST', '')
  // Same reason, and it matters more here: with these set, saveSurveyResponse
  // would insert every test submission into the real survey_responses table.
  // Unset, it falls back to localStorage. Tests about Supabase stub them back on.
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})
