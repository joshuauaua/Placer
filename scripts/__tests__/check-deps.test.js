import { describe, it, expect, afterEach } from 'vite-plus/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), '../check-deps.mjs')

function makeRoot() {
  return mkdtempSync(join(tmpdir(), 'check-deps-'))
}

function writeLock(root, packages) {
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ packages }))
}

function writePackage(root, path, version) {
  mkdirSync(join(root, path), { recursive: true })
  writeFileSync(join(root, path, 'package.json'), JSON.stringify({ version }))
}

function run(root) {
  try {
    const stdout = execFileSync('node', [scriptPath, root], { encoding: 'utf8' })
    return { status: 0, stdout, stderr: '' }
  } catch (error) {
    return { status: error.status, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }
  }
}

const roots = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('check-deps', () => {
  it('exits 0 when installed versions match the lockfile', () => {
    const root = makeRoot()
    roots.push(root)
    mkdirSync(join(root, 'node_modules'))
    writeLock(root, { 'node_modules/foo': { version: '1.0.0' } })
    writePackage(root, 'node_modules/foo', '1.0.0')

    const result = run(root)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('OK')
  })

  it('exits 1 when an installed version differs from the lockfile', () => {
    const root = makeRoot()
    roots.push(root)
    mkdirSync(join(root, 'node_modules'))
    writeLock(root, { 'node_modules/foo': { version: '2.0.0' } })
    writePackage(root, 'node_modules/foo', '1.0.0')

    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('node_modules/foo: installed 1.0.0 != locked 2.0.0')
  })

  it('exits 1 when a non-optional locked package has no directory', () => {
    const root = makeRoot()
    roots.push(root)
    mkdirSync(join(root, 'node_modules'))
    writeLock(root, { 'node_modules/foo': { version: '1.0.0' } })

    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('node_modules/foo: missing (locked 1.0.0)')
  })

  it('exits 0 when an optional locked package has no directory', () => {
    const root = makeRoot()
    roots.push(root)
    mkdirSync(join(root, 'node_modules'))
    writeLock(root, { 'node_modules/foo': { version: '1.0.0', optional: true } })

    const result = run(root)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('OK')
  })

  it('exits 1 when node_modules/.package-lock.json lists a package absent from package-lock.json', () => {
    const root = makeRoot()
    roots.push(root)
    mkdirSync(join(root, 'node_modules'))
    writeLock(root, {})
    writeFileSync(
      join(root, 'node_modules', '.package-lock.json'),
      JSON.stringify({ packages: { 'node_modules/foo': { version: '1.0.0' } } }),
    )

    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('node_modules/foo: installed but not in package-lock.json')
  })

  it('exits 1 when node_modules is missing entirely', () => {
    const root = makeRoot()
    roots.push(root)
    writeLock(root, {})

    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('run `npm ci`')
  })
})
