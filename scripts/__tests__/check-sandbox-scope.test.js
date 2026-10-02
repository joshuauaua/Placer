import { describe, it, expect } from 'vite-plus/test'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isInScope } from '../check-sandbox-scope.mjs'

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), '../check-sandbox-scope.mjs')

/** Run the script over some paths, the way the workflow does. */
function run(paths) {
  try {
    const stdout = execFileSync('node', [scriptPath, ...paths], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout, stderr: '' }
  } catch (error) {
    return { code: error.status, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }
  }
}

describe('what a Toolkit contribution may change', () => {
  it('takes the register, so a new tool can appear in the gallery', () => {
    expect(isInScope('src/toolkit/tools.js')).toBe(true)
    expect(isInScope('src/toolkit/__tests__/tools.test.js')).toBe(true)
  })

  it('takes the tools themselves, including one that does not exist yet', () => {
    expect(isInScope('src/components/toolkit/BudgetBallot.jsx')).toBe(true)
    expect(isInScope('src/components/toolkit/TreeCanopy.jsx')).toBe(true)
  })

  it('takes the Toolkit chrome and its tests', () => {
    expect(isInScope('src/components/ToolkitPage.jsx')).toBe(true)
    expect(isInScope('src/components/ToolLayout.jsx')).toBe(true)
    expect(isInScope('src/components/__tests__/ToolkitTools.test.jsx')).toBe(true)
    expect(isInScope('src/components/__tests__/ToolSiteMapping.test.jsx')).toBe(true)
  })

  it('takes the four pure modules the tools do their arithmetic in', () => {
    for (const name of ['streetSection', 'desireLines', 'reachGrid', 'budgetBallot']) {
      expect(isInScope(`src/lib/${name}.js`)).toBe(true)
      expect(isInScope(`src/lib/__tests__/${name}.test.js`)).toBe(true)
    }
  })

  it('takes a new tool\'s own pure module, which is the commonest change', () => {
    expect(isInScope('src/lib/toolkit/treeCanopy.js')).toBe(true)
    expect(isInScope('src/lib/toolkit/__tests__/treeCanopy.test.js')).toBe(true)
  })

  it('accepts a whole new tool in one go', () => {
    // Exactly the five files CONTRIBUTING.md asks for. If this ever fails, the
    // instructions and the boundary have drifted apart.
    for (const path of [
      'src/components/toolkit/TreeCanopy.jsx',
      'src/lib/toolkit/treeCanopy.js',
      'src/lib/toolkit/__tests__/treeCanopy.test.js',
      'src/toolkit/tools.js',
      'src/components/__tests__/ToolkitTools.test.jsx',
    ]) {
      expect(isInScope(path)).toBe(true)
    }
  })
})

describe('what it may not', () => {
  it('refuses the room layer, even though it sits among the tools', () => {
    // These are the reason the check has a denylist at all: they are inside
    // directories that are otherwise open, and what they get wrong is who can read
    // somebody else's data.
    expect(isInScope('src/components/toolkit/RoomBar.jsx')).toBe(false)
    expect(isInScope('src/components/toolkit/useRoom.js')).toBe(false)
    expect(isInScope('src/toolkit/rooms.js')).toBe(false)
    expect(isInScope('src/toolkit/__tests__/rooms.test.js')).toBe(false)
  })

  it('refuses the row-level security rules', () => {
    expect(isInScope('supabase/rooms.sql')).toBe(false)
    expect(isInScope('supabase/schema.sql')).toBe(false)
  })

  it('refuses the services, where the keys and the queries are', () => {
    expect(isInScope('src/services/rooms.js')).toBe(false)
    expect(isInScope('src/services/supabase.js')).toBe(false)
    expect(isInScope('src/services/api.js')).toBe(false)
  })

  it('refuses the rest of src/lib, which is image processing and maps', () => {
    for (const path of [
      'src/lib/detectLines.js',
      'src/lib/opencvLoader.js',
      'src/lib/panoStitch.js',
      'src/lib/staticMaps.js',
      'src/lib/clipboard.js',
      'src/lib/__tests__/panoGeometry.test.js',
    ]) {
      expect(isInScope(path)).toBe(false)
    }
  })

  it('refuses the app shell and anything shared across it', () => {
    for (const path of [
      'src/App.jsx',
      'src/theme.js',
      'src/index.css',
      'src/components/UI.jsx',
      'src/components/Icon.jsx',
      'src/legal.js',
      'src/components/GdprPage.jsx',
    ]) {
      expect(isInScope(path)).toBe(false)
    }
  })

  it('refuses the things that decide what runs, and where', () => {
    for (const path of [
      '.github/workflows/pull-request.yml',
      '.github/CODEOWNERS',
      'scripts/check-sandbox-scope.mjs',
      'package.json',
      'package-lock.json',
      'vercel.json',
      'vite.config.js',
      'index.html',
      '.env.example',
    ]) {
      expect(isInScope(path)).toBe(false)
    }
  })

  it('is not fooled by a path that merely looks like the Toolkit', () => {
    expect(isInScope('src/toolkits/thing.js')).toBe(false)
    expect(isInScope('docs/src/toolkit/tools.js')).toBe(false)
    expect(isInScope('src/components/ToolkitPage.jsx.bak')).toBe(false)
    expect(isInScope('src/lib/budgetBallot.js.orig')).toBe(false)
  })
})

describe('the script the workflow runs', () => {
  it('passes a change that stays inside, and says how many files it saw', () => {
    const { code, stdout } = run(['src/toolkit/tools.js', 'src/lib/budgetBallot.js'])

    expect(code).toBe(0)
    expect(stdout).toMatch(/OK — 2 changed file\(s\)/)
  })

  it('fails a change that reaches out, and names only the offenders', () => {
    const { code, stderr } = run(['src/toolkit/tools.js', 'src/App.jsx', 'supabase/rooms.sql'])

    expect(code).toBe(1)
    expect(stderr).toContain('2 of 3 changed file(s) are outside the Toolkit')
    expect(stderr).toContain('src/App.jsx')
    expect(stderr).toContain('supabase/rooms.sql')
    // The one that was fine is not listed as a problem.
    expect(stderr).not.toContain('- src/toolkit/tools.js')
  })

  it('points at CONTRIBUTING.md rather than just refusing', () => {
    const { stderr } = run(['src/App.jsx'])

    expect(stderr).toContain('CONTRIBUTING.md')
  })

  it('passes an empty list, which is not its problem to police', () => {
    expect(run([]).code).toBe(0)
  })
})
