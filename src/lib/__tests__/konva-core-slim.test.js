import { describe, it, expect } from 'vite-plus/test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)

// Extract the identifier keys passed to Util._assign(Global, { ... }).
function assignedKeys(path) {
  const source = readFileSync(path, 'utf8')
  const body = source.match(/Util\._assign\(Global,\s*\{([\s\S]*?)\}\)/)[1]
  return new Set(
    body
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
}

// Modules the shim drops on purpose to trim the bundle.
const INTENTIONAL_DROPS = ['Animation', 'Tween', 'Easings', 'FastLayer']

describe('konva-core-slim shim', () => {
  it('assigns every _CoreInternals key except the intentional drops', () => {
    const upstream = assignedKeys(require.resolve('konva/lib/_CoreInternals.js'))
    const shim = assignedKeys(require.resolve('../konva-core-slim.js'))

    const expected = new Set(upstream)
    for (const key of INTENTIONAL_DROPS) expected.delete(key)

    // DD is inside `expected`, so a future trim that drops it fails here
    // instead of throwing in Konva.isDragging() on every pointer move.
    expect([...shim].sort()).toEqual([...expected].sort())
  })
})
