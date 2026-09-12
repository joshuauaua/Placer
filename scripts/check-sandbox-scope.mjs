#!/usr/bin/env node
// Fails if a change reaches outside the Sandbox.
//
// The Sandbox is the part of PLACER open to contributions; the rest of the app is
// not. GitHub has no way to grant write access to a directory, so the boundary
// cannot be a permission — it is this check, plus the code-owner review on the
// branch. Neither is a security control on its own: a reviewer is. What this does
// is tell somebody within a minute of opening a pull request that they have edited
// something that was never going to be accepted, instead of after a round of review.
//
// Paths come from argv, or on stdin one per line:
//
//   node scripts/check-sandbox-scope.mjs src/sandbox/experiments.js
//   git diff --name-only main...HEAD | node scripts/check-sandbox-scope.mjs
//
// Exit 0 when every path is inside the Sandbox, 1 otherwise. An empty list passes:
// a pull request that changes nothing is not this script's problem.

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/*
 * What a contribution may touch.
 *
 * Enough to add a whole new experiment: a component, a pure logic module beside the
 * others, the register entry that makes it appear, and tests for all of it.
 */
const ALLOWED = [
  // The register, and the experiments themselves.
  'src/sandbox/**',
  'src/components/sandbox/**',
  'src/components/SandboxPage.jsx',
  'src/components/SandboxLayout.jsx',
  'src/components/__tests__/Sandbox*.test.jsx',
  // Where a NEW experiment's arithmetic goes. src/lib itself cannot be opened
  // wholesale — it also holds the OpenCV image processing, the Street View geometry
  // and the maps code — and an allowlist that named only the modules that exist
  // today would reject the one thing a contributor is most likely to add. So new
  // pure modules get a directory of their own, and it is open.
  'src/lib/sandbox/**',
  // The four that predate that split, and their tests.
  'src/lib/streetSection.js',
  'src/lib/desireLines.js',
  'src/lib/reachGrid.js',
  'src/lib/budgetBallot.js',
  'src/lib/__tests__/streetSection.test.js',
  'src/lib/__tests__/desireLines.test.js',
  'src/lib/__tests__/reachGrid.test.js',
  'src/lib/__tests__/budgetBallot.test.js',
]

/*
 * Carved back out again. These sit inside the directories above but are not
 * experiment code: they are the room layer, and what they get wrong is not a
 * wonky diagram but who can read a stranger's data. Row-level security lives in
 * supabase/rooms.sql and is reviewed with it.
 */
const DENIED = [
  'src/sandbox/rooms.js',
  'src/sandbox/__tests__/rooms.test.js',
  'src/components/sandbox/RoomBar.jsx',
  'src/components/sandbox/useRoom.js',
]

/** A glob with `*` (within a segment) and `**` (any depth) as a RegExp. */
function toRegExp(glob) {
  let source = ''
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i]
    if (char === '*') {
      if (glob[i + 1] === '*') {
        // `**/` swallows the slash too, so the pattern also matches zero directories.
        if (glob[i + 2] === '/') {
          source += '(?:.*/)?'
          i += 2
        } else {
          source += '.*'
          i += 1
        }
      } else {
        source += '[^/]*'
      }
    } else if ('\\^$.|?+()[]{}'.includes(char)) {
      source += `\\${char}`
    } else {
      source += char
    }
  }
  return new RegExp(`^${source}$`)
}

const allowed = ALLOWED.map(toRegExp)
const denied = DENIED.map(toRegExp)

/** True when this path is inside the contributable Sandbox. */
export function isInScope(path) {
  // Denials win, so a file inside an allowed directory can still be held back.
  if (denied.some((pattern) => pattern.test(path))) return false
  return allowed.some((pattern) => pattern.test(path))
}

function readStdin() {
  try {
    // Synchronous, because this runs as a one-shot script in CI and has nothing
    // else to be getting on with. Throws when there is no stdin to read.
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

// Only when run as a script, so a test can import isInScope without this firing.
const runAsScript =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (runAsScript) {
  const fromArgs = process.argv.slice(2)
  const paths = (fromArgs.length > 0 ? fromArgs : readStdin().split('\n'))
    .map((line) => line.trim())
    .filter(Boolean)

  const outside = paths.filter((path) => !isInScope(path))

  if (outside.length > 0) {
    console.error(
      `sandbox:scope: ${outside.length} of ${paths.length} changed file(s) are outside the Sandbox:`,
    )
    for (const path of outside.slice(0, 40)) console.error(`  - ${path}`)
    if (outside.length > 40) console.error(`  ... and ${outside.length - 40} more`)
    console.error(
      '\nContributions are limited to the Sandbox. See CONTRIBUTING.md for what that' +
        '\ncovers, and open an issue for anything that needs a change outside it.',
    )
    process.exit(1)
  }

  console.log(`sandbox:scope: OK — ${paths.length} changed file(s), all inside the Sandbox`)
}
