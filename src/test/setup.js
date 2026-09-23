import '@testing-library/jest-dom'
import { beforeEach, afterEach, vi } from 'vite-plus/test'

// A developer's .env holds real PostHog credentials, and Vite loads it in test
// mode too — which would mount the cookie banner inside every test that renders
// <App />, and its "Terms and Privacy" link would sit alongside the footer's legal links. Tests
// that are about the banner stub these back on themselves.
// The same goes for Supabase: a developer with a project configured would get the
// sandbox room controls in tests that a clean checkout does not, and the room tests
// stub these back on themselves.
beforeEach(() => {
  vi.stubEnv('VITE_POSTHOG_KEY', '')
  vi.stubEnv('VITE_POSTHOG_HOST', '')
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})
