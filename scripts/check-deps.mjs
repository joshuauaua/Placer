#!/usr/bin/env node
// Fails if node_modules does not match package-lock.json exactly. `npm audit`
// resolves the tree from the lockfile, not from disk, so it cannot catch this.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..')
const lockPath = join(root, 'package-lock.json')

if (!existsSync(lockPath)) {
  console.error('deps:check: package-lock.json not found')
  process.exit(1)
}
if (!existsSync(join(root, 'node_modules'))) {
  console.error('deps:check: node_modules is missing — run `npm ci`')
  process.exit(1)
}

const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
const problems = []
let checked = 0
let skippedOptional = 0

for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/')) continue
  if (entry.link || !entry.version) continue
  const pkgJson = join(root, path, 'package.json')
  if (!existsSync(pkgJson)) {
    // Platform-specific optional deps (fsevents, the oxlint/rolldown native
    // bindings) are absent by design on any given OS.
    if (entry.optional) {
      skippedOptional++
      continue
    }
    problems.push(`${path}: missing (locked ${entry.version})`)
    continue
  }
  checked++
  const installed = JSON.parse(readFileSync(pkgJson, 'utf8')).version
  if (installed !== entry.version) {
    problems.push(`${path}: installed ${installed} != locked ${entry.version}`)
  }
}

// npm's hidden lockfile records what it actually installed, so it is the
// cheapest way to spot packages that the real lockfile no longer wants.
const hiddenPath = join(root, 'node_modules', '.package-lock.json')
if (existsSync(hiddenPath)) {
  const hidden = JSON.parse(readFileSync(hiddenPath, 'utf8'))
  for (const path of Object.keys(hidden.packages ?? {})) {
    if (!lock.packages[path]) problems.push(`${path}: installed but not in package-lock.json`)
  }
}

if (problems.length) {
  console.error(`deps:check: node_modules is out of sync with package-lock.json (${problems.length} problem(s)):`)
  for (const p of problems.slice(0, 40)) console.error(`  - ${p}`)
  if (problems.length > 40) console.error(`  ... and ${problems.length - 40} more`)
  console.error('\nRun `npm ci` to install exactly what the lockfile specifies.')
  process.exit(1)
}

console.log(
  `deps:check: OK — ${checked} package(s) match package-lock.json ` +
    `(${skippedOptional} optional not installed on this platform)`,
)
