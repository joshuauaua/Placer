import { describe, it, expect, afterEach, vi } from 'vite-plus/test'
// The same specifier react-konva imports, so the vite.config.js alias swaps in
// the slim shim here exactly as it does in the production bundle.
import Konva from 'konva/lib/Core.js'

describe('konva-core-slim', () => {
  let stage

  afterEach(() => {
    stage?.destroy()
    stage = null
    vi.restoreAllMocks()
  })

  it('exposes the drag-and-drop registry that Konva.isDragging() reads', () => {
    expect(Konva.DD).toBeDefined()
    expect(Konva.isDragging()).toBe(false)
    expect(Konva.isTransforming()).toBe(false)
  })

  it('handles the first pointer move over a stage without throwing', () => {
    // jsdom has no 2D context, and Stage builds a buffer canvas on construction.
    const noop = () => {}
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      new Proxy({}, { get: () => noop }),
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    stage = new Konva.Stage({ container, width: 100, height: 100 })

    expect(() => {
      stage._pointermove(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }))
    }).not.toThrow()
  })
})
