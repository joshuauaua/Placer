import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * BeforeAfterSlider Component
 *
 * Interactive split-view slider to compare before (original Street View)
 * and after (with canvas overlay) states.
 *
 * Props:
 * - t: Theme object (from src/theme.js)
 * - beforeImage: URL or element representing the before state
 * - afterImage: URL or element representing the after state
 * - width: Slider width
 * - height: Slider height
 */
const BeforeAfterSlider = ({
  t,
  beforeImage,
  afterImage,
  width = 800,
  height = 600
}) => {
  const [sliderPosition, setSliderPosition] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDraggingRef.current = true;
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    // Clamp between 0 and 100
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDraggingRef.current || !containerRef.current) return;

    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleTouchMove, handleMouseUp]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: t.surface, boxShadow: t.shadow, padding: 16, marginBottom: 8, borderRadius: 12 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 8 }}>Before / After Comparison</h3>
        <p style={{ fontSize: 14, color: t.inkDim }}>
          Drag the slider to compare the original space with your imagination
        </p>
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative', overflow: 'hidden', background: t.chrome,
          borderRadius: 12, boxShadow: t.shadow, cursor: 'col-resize',
          width, height
        }}
      >
        {/* Before Image (Background) */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${beforeImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div style={{
            position: 'absolute', top: 16, left: 16,
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            padding: '4px 12px', borderRadius: 999, fontSize: 14, fontWeight: 600
          }}>
            BEFORE
          </div>
        </div>

        {/* After Image (Clipped) */}
        <div
          style={{
            position: 'absolute', inset: 0,
            clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
            backgroundImage: `url(${afterImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            padding: '4px 12px', borderRadius: 999, fontSize: 14, fontWeight: 600
          }}>
            AFTER
          </div>
        </div>

        {/* Slider Handle */}
        <div
          style={{
            position: 'absolute', top: 0, bottom: 0, width: 4,
            background: '#fff', boxShadow: t.shadow, cursor: 'col-resize',
            left: `${sliderPosition}%`,
            transform: 'translateX(-50%)'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          {/* Handle Circle */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 48, height: 48, background: '#fff', borderRadius: '50%',
            boxShadow: t.shadow, border: `4px solid ${t.accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg
              width={24}
              height={24}
              style={{ color: t.accent }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9l4-4 4 4m0 6l-4 4-4-4"
              />
            </svg>
          </div>
        </div>
      </div>

      <div style={{
        background: t.surfaceAlt, borderLeft: `4px solid ${t.accent}`, color: t.ink,
        padding: 12, marginTop: 8, fontSize: 14
      }}>
        <strong>Tip:</strong> Click and drag the slider or handle to compare your changes
      </div>
    </div>
  );
};

export default BeforeAfterSlider;
