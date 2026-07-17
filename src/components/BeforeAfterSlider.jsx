import { useState, useRef, useEffect } from 'react';

/**
 * BeforeAfterSlider Component
 *
 * Interactive split-view slider to compare before (original Street View)
 * and after (with canvas overlay) states.
 *
 * Props:
 * - beforeImage: URL or element representing the before state
 * - afterImage: URL or element representing the after state
 * - width: Slider width
 * - height: Slider height
 */
const BeforeAfterSlider = ({
  beforeImage,
  afterImage,
  width = 800,
  height = 600
}) => {
  const [sliderPosition, setSliderPosition] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    // Clamp between 0 and 100
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !containerRef.current) return;

    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, sliderPosition]);

  return (
    <div className="flex flex-col">
      <div className="bg-white shadow-md p-4 mb-2 rounded-lg">
        <h3 className="text-lg font-bold text-gray-800 mb-2">Before / After Comparison</h3>
        <p className="text-sm text-gray-600">
          Drag the slider to compare the original space with your imagination
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden bg-gray-900 rounded-lg shadow-lg cursor-col-resize"
        style={{ width, height }}
      >
        {/* Before Image (Background) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${beforeImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm font-semibold">
            BEFORE
          </div>
        </div>

        {/* After Image (Clipped) */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
            backgroundImage: `url(${afterImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm font-semibold">
            AFTER
          </div>
        </div>

        {/* Slider Handle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-col-resize"
          style={{
            left: `${sliderPosition}%`,
            transform: 'translateX(-50%)'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          {/* Handle Circle */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-xl border-4 border-blue-500 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-500"
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

      <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-3 mt-2 text-sm">
        <strong>Tip:</strong> Click and drag the slider or handle to compare your changes
      </div>
    </div>
  );
};

export default BeforeAfterSlider;
