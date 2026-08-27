import '@testing-library/jest-dom'
import { beforeEach, afterEach, vi } from 'vite-plus/test'

// A developer's .env holds real PostHog credentials, and Vite loads it in test
// mode too — which would mount the cookie banner inside every test that renders
// <App />, and its "Privacy Policy" link would collide with the footer's. Tests
// that are about the banner stub these back on themselves.
beforeEach(() => {
  vi.stubEnv('VITE_POSTHOG_KEY', '')
  vi.stubEnv('VITE_POSTHOG_HOST', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})
