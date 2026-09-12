/* PLACER — Imagination Canvas with built-in asset library */

import { useState, useRef, useEffect, useCallback } from 'react';
import posthog from 'posthog-js';
import { Stage, Layer, Circle, Line, Text, Transformer, Image as KonvaImage } from 'react-konva/lib/ReactKonvaCore';
import 'konva/lib/shapes/Circle';
import 'konva/lib/shapes/Line';
import 'konva/lib/shapes/Text';
import 'konva/lib/shapes/Transformer';
import 'konva/lib/shapes/Image';
import useImage from 'use-image';
import { THEME } from '../theme';
import { CAT } from '../theme';
import {
  DEFAULT_LINE_CLASS,
  LINE_CLASS_LIST,
  lineClass,
  sortByRenderOrder,
} from '../lib/lineClasses';

// A click in draw mode that travels less than this is treated as a stray click
// rather than a zero-length line.
const MIN_LINE_LENGTH = 4;

// Thin strokes are hard to hit precisely, so widen the invisible hit area.
const LINE_HIT_WIDTH = 14;

// Pixel size the wide capture is fetched at (see DEFAULT_SIZE in staticMaps).
// Tile planning needs it to work out how far below centre to aim.
const DETECT_WIDE_SIZE = { width: 640, height: 448 };

const Asset = ({ asset, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  const cat = CAT[asset.cat] || CAT.green;

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Circle
        ref={shapeRef}
        x={asset.x}
        y={asset.y}
        radius={asset.scale * 40}
        fill={cat.color}
        opacity={0.8}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...asset,
            x: e.target.x(),
            y: e.target.y()
          });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();

          onChange({
            ...asset,
            x: node.x(),
            y: node.y(),
            scale: asset.scale * scaleX
          });

          node.scaleX(1);
          node.scaleY(1);
        }}
      />
      <Text
        x={asset.x - 30}
        y={asset.y - 8}
        text={asset.label}
        fontSize={14}
        fontFamily="Helvetica"
        fill="#ffffff"
        align="center"
        width={60}
        listening={false}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
        />
      )}
    </>
  );
};

const DrawnLine = ({ line, isSelected, onSelect }) => {
  const cls = lineClass(line.cls);

  return (
    <Line
      points={line.points}
      stroke={cls.color}
      strokeWidth={isSelected ? cls.stroke + 3 : cls.stroke}
      closed={!!line.closed}
      lineCap="round"
      lineJoin="round"
      hitStrokeWidth={LINE_HIT_WIDTH}
      shadowColor="#000000"
      shadowBlur={isSelected ? 8 : 0}
      shadowOpacity={isSelected ? 0.9 : 0}
      onClick={onSelect}
      onTap={onSelect}
    />
  );
};

const BackgroundImage = ({ src, width, height }) => {
  const [image] = useImage(src);

  if (!image) return null;

  return (
    <KonvaImage
      image={image}
      width={width}
      height={height}
      listening={false}
    />
  );
};

const ImaginationCanvas = ({
  availableAssets = [],
  canvasAssets = [],
  onCanvasAssetsChange,
  lines = [],
  onLinesChange,
  capturedView = null,
  apiKey = '',
  width = 1000,
  height = 700,
  backgroundImage = null,
  // Optional: parent-owned ref, so a caller can export the composite via
  // stage.toDataURL(). A plain prop rather than forwardRef, because this component
  // is consumed through lazy() + Suspense.
  stageRef: externalStageRef = null
}) => {
  const t = THEME;
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [tool, setTool] = useState('select');
  const [activeClass, setActiveClass] = useState(DEFAULT_LINE_CLASS);
  // The segment being dragged out, before it is committed on mouse-up.
  const [draft, setDraft] = useState(null);
  // 'idle' | 'loading' (fetching the ~4 MB detector) | 'detecting'
  const [detectPhase, setDetectPhase] = useState('idle');
  const [detectNote, setDetectNote] = useState(null);
  const internalStageRef = useRef();
  const stageRef = externalStageRef || internalStageRef;
  const assetCounter = useRef(0);
  const lineCounter = useRef(0);

  const handleAutoDetect = async () => {
    if (!backgroundImage || detectPhase !== 'idle') return;

    setDetectNote(null);
    setDetectPhase('loading');
    try {
      // Split into two phases because the first call downloads and instantiates
      // several megabytes of WASM, which reads as a hang without its own label.
      const { loadOpenCv, detectLines } = await import('../lib/detectLines');
      await loadOpenCv();
      setDetectPhase('detecting');

      // A street view capture can be re-fetched as several narrower tiles, which
      // resolve the same scene ~2x more finely than the single wide shot. Skipped
      // for map captures and when no key is available; detection then falls back
      // to the wide image alone.
      const canTile =
        !!apiKey && capturedView?.source === 'streetview' && !!capturedView?.position
        && Number.isFinite(capturedView?.fov);

      let tileSources;
      if (canTile) {
        const { streetViewTileUrls } = await import('../lib/staticMaps');
        tileSources = streetViewTileUrls({
          apiKey,
          location: capturedView.position,
          heading: capturedView.pov?.heading,
          pitch: capturedView.pov?.pitch ?? 0,
          fov: capturedView.fov,
          wideSize: DETECT_WIDE_SIZE,
        }).map(({ url, tile }) => ({ tile, source: url }));
      }

      const { lines: detected, stats } = await detectLines(backgroundImage, {
        stageWidth: width,
        stageHeight: height,
        wideFov: capturedView?.fov ?? 90,
        tileSources,
      });

      // Detected lines are ordinary lines from here on — selectable, deletable,
      // indistinguishable from hand-drawn ones. Prefixed ids keep them from
      // colliding with the manual counter.
      onLinesChange?.([
        ...lines,
        ...detected.map((line, i) => ({ ...line, id: `detected-${Date.now()}-${i}` })),
      ]);

      const parts = [`${detected.length} lines`];
      if (stats.tiles > 0) {
        parts.push(`${stats.tiles} high-res tiles`);
      }
      if (stats.mergedAway > 0) {
        parts.push(`${stats.mergedAway} duplicate segments merged`);
      }
      if (stats.markingSkipped) {
        parts.push('lane markings skipped — pavement too bright to tell from paint');
      } else if (stats.markingVMin > 175) {
        parts.push(`marking threshold raised to ${stats.markingVMin}`);
      }
      posthog.capture('canvas_lines_auto_detected', {
        lines_detected: detected.length,
        tiles_used: stats.tiles ?? 0,
        merged_away: stats.mergedAway ?? 0,
      });
      setDetectNote(parts.join(' · '));
    } catch (error) {
      console.error('Auto-detect failed:', error);
      setDetectNote('Auto-detect failed — see the console for details.');
    } finally {
      setDetectPhase('idle');
    }
  };

  const handleAddAsset = (libraryAsset) => {
    assetCounter.current += 1;
    const newAsset = {
      id: `canvas-asset-${assetCounter.current}`,
      type: libraryAsset.type,
      label: libraryAsset.label,
      cat: libraryAsset.cat,
      x: width / 2,
      y: height / 2,
      scale: 1
    };

    posthog.capture('canvas_asset_added', {
      asset_type: libraryAsset.type,
      asset_category: libraryAsset.cat,
      total_assets: canvasAssets.length + 1,
    });
    onCanvasAssetsChange([...canvasAssets, newAsset]);
    setSelectedAssetId(newAsset.id);
  };

  const handleAssetChange = (updatedAsset) => {
    const updatedAssets = canvasAssets.map(asset =>
      asset.id === updatedAsset.id ? updatedAsset : asset
    );
    onCanvasAssetsChange(updatedAssets);
  };

  const handleDeleteSelected = useCallback(() => {
    if (selectedLineId) {
      onLinesChange?.(lines.filter(line => line.id !== selectedLineId));
      setSelectedLineId(null);
      return;
    }
    if (selectedAssetId) {
      const filtered = canvasAssets.filter(asset => asset.id !== selectedAssetId);
      onCanvasAssetsChange(filtered);
      setSelectedAssetId(null);
    }
  }, [selectedLineId, lines, onLinesChange, selectedAssetId, canvasAssets, onCanvasAssetsChange]);

  // Konva reports pointer position via the stage. Returns null when there is no
  // live stage (e.g. jsdom), so callers can bail rather than draw at NaN.
  const pointerPos = (e) => e?.target?.getStage?.()?.getPointerPosition?.() ?? null;

  const handleStageMouseDown = (e) => {
    if (tool === 'draw') {
      const p = pointerPos(e);
      if (!p) return;
      setSelectedAssetId(null);
      setSelectedLineId(null);
      setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }

    // Select mode: a press on empty canvas clears the selection. Guarded with
    // an optional call because the target is not always a Konva node.
    if (e?.target && e.target === e.target.getStage?.()) {
      setSelectedAssetId(null);
      setSelectedLineId(null);
    }
  };

  const handleStageMouseMove = (e) => {
    if (!draft) return;
    const p = pointerPos(e);
    if (!p) return;
    setDraft(current => (current ? { ...current, x2: p.x, y2: p.y } : current));
  };

  const handleStageMouseUp = () => {
    if (!draft) return;
    const { x1, y1, x2, y2 } = draft;
    setDraft(null);

    if (Math.hypot(x2 - x1, y2 - y1) < MIN_LINE_LENGTH) return;

    lineCounter.current += 1;
    const newLine = {
      id: `line-${lineCounter.current}`,
      cls: activeClass,
      points: [x1, y1, x2, y2],
      closed: false,
    };
    onLinesChange?.([...lines, newLine]);
    setSelectedLineId(newLine.id);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedAssetId || selectedLineId)) {
        e.preventDefault();
        handleDeleteSelected();
      }
      // Escape abandons an in-progress drag and returns to selecting.
      if (e.key === 'Escape') {
        setDraft(null);
        setTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAssetId, selectedLineId, handleDeleteSelected]);

  return (
    <div style={{ display: 'flex', height: '100%', background: t.page }}>
      {/* Canvas Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
        <div style={{ background: t.surface, borderRadius: 12, padding: 16, marginBottom: 16,
          border: `1px solid ${t.line}`, boxShadow: t.shadow, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>
              <span className="placer-disp" style={{ color: t.ink, fontWeight: 700 }}>{canvasAssets.length}</span> assets placed
              <span style={{ margin: '0 8px', color: t.inkFaint }}>·</span>
              <span className="placer-disp" style={{ color: t.ink, fontWeight: 700 }}>{lines.length}</span> lines
              {selectedAssetId && (
                <span style={{ marginLeft: 16, color: t.accent }}>
                  Selected: {canvasAssets.find(a => a.id === selectedAssetId)?.label}
                </span>
              )}
              {selectedLineId && (
                <span style={{ marginLeft: 16, color: t.accent }}>
                  Selected: {lineClass(lines.find(l => l.id === selectedLineId)?.cls).label}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDeleteSelected}
                disabled={!selectedAssetId && !selectedLineId}
                style={{ height: 34, padding: '0 14px', borderRadius: 8,
                  cursor: selectedAssetId || selectedLineId ? 'pointer' : 'not-allowed',
                  background: '#D6452F', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13,
                  opacity: selectedAssetId || selectedLineId ? 1 : 0.5 }}>
                Delete
              </button>
              <button
                onClick={() => { onCanvasAssetsChange([]); onLinesChange?.([]); }}
                disabled={canvasAssets.length === 0 && lines.length === 0}
                style={{ height: 34, padding: '0 14px', borderRadius: 8,
                  cursor: canvasAssets.length > 0 || lines.length > 0 ? 'pointer' : 'not-allowed',
                  background: t.lineStrong, color: t.ink, border: 'none', fontWeight: 700, fontSize: 13,
                  opacity: canvasAssets.length > 0 || lines.length > 0 ? 1 : 0.5 }}>
                Clear All
              </button>
            </div>
          </div>

          {/* Line tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            borderTop: `1px solid ${t.line}`, paddingTop: 12 }}>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${t.line}` }}>
              {['select', 'draw'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setTool(mode); setDraft(null); }}
                  aria-pressed={tool === mode}
                  style={{ height: 32, padding: '0 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    background: tool === mode ? t.primaryBg : 'transparent',
                    color: tool === mode ? t.primaryFg : t.inkDim, textTransform: 'capitalize' }}>
                  {mode}
                </button>
              ))}
            </div>

            <span style={{ width: 1, height: 22, background: t.line }} />

            {LINE_CLASS_LIST.map((cls) => {
              const on = activeClass === cls.key;
              return (
                <button
                  key={cls.key}
                  onClick={() => { setActiveClass(cls.key); setTool('draw'); }}
                  aria-pressed={on}
                  title={cls.hint}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 11px',
                    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: on ? 800 : 600,
                    border: `1.5px solid ${on ? cls.color : t.line}`,
                    background: on ? cls.color + '22' : 'transparent', color: t.ink }}>
                  <span style={{ width: 14, height: 4, borderRadius: 2, background: cls.color }} />
                  {cls.label}
                </button>
              );
            })}

            <div style={{ flex: 1 }} />

            <button
              onClick={handleAutoDetect}
              disabled={!backgroundImage || detectPhase !== 'idle'}
              title={backgroundImage
                ? 'Find road edges, kerbs and vegetation in the photo'
                : 'Capture a street view first'}
              style={{ height: 32, padding: '0 14px', borderRadius: 8,
                cursor: backgroundImage && detectPhase === 'idle' ? 'pointer' : 'not-allowed',
                border: 'none', background: t.primaryBg, color: t.primaryFg,
                fontWeight: 700, fontSize: 13,
                opacity: backgroundImage && detectPhase === 'idle' ? 1 : 0.5 }}>
              {detectPhase === 'loading'
                ? 'Loading detector (~4 MB)…'
                : detectPhase === 'detecting'
                  ? 'Detecting…'
                  : 'Auto-detect lines'}
            </button>
          </div>

          {detectNote && (
            <div role="status" style={{ fontSize: 12.5, color: t.inkDim, fontWeight: 600 }}>
              {detectNote}
            </div>
          )}
        </div>

        <div style={{ flex: 1, background: t.surface, borderRadius: 12, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
          <Stage
            ref={stageRef}
            width={width}
            height={height}
            onMouseDown={handleStageMouseDown}
            onTouchStart={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onTouchMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onTouchEnd={handleStageMouseUp}
            onMouseLeave={handleStageMouseUp}
            style={{
              background: backgroundImage ? '#000' : '#F6F3EC',
              cursor: tool === 'draw' ? 'crosshair' : 'default',
            }}
          >
            <Layer>
              {/* Background Image */}
              {backgroundImage && (
                <BackgroundImage src={backgroundImage} width={width} height={height} />
              )}
            </Layer>
            {/* Line overlay — sorted so vegetation outlines sit above road lines,
                matching the Python renderer's z-order. */}
            <Layer>
              {sortByRenderOrder(lines).map((line) => (
                <DrawnLine
                  key={line.id}
                  line={line}
                  isSelected={line.id === selectedLineId}
                  onSelect={() => {
                    if (tool !== 'draw') {
                      setSelectedLineId(line.id);
                      setSelectedAssetId(null);
                    }
                  }}
                />
              ))}
              {draft && (
                <Line
                  points={[draft.x1, draft.y1, draft.x2, draft.y2]}
                  stroke={lineClass(activeClass).color}
                  strokeWidth={lineClass(activeClass).stroke}
                  dash={[7, 5]}
                  lineCap="round"
                  listening={false}
                />
              )}
            </Layer>
            <Layer>
              {canvasAssets.map((asset) => (
                <Asset
                  key={asset.id}
                  asset={asset}
                  isSelected={asset.id === selectedAssetId}
                  onSelect={() => {
                    // In draw mode a press is starting a line, not picking an asset.
                    if (tool !== 'draw') {
                      setSelectedAssetId(asset.id);
                      setSelectedLineId(null);
                    }
                  }}
                  onChange={handleAssetChange}
                />
              ))}
            </Layer>
          </Stage>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: t.accent + '22', borderRadius: 8,
          borderLeft: `4px solid ${t.accent}`, fontSize: 13, color: t.ink }}>
          <strong>Tip:</strong> Click assets from the library to add them. Drag to move, use corner
          handles to resize. In <strong>Draw</strong> mode, pick a line type and drag across the
          photo to mark a road edge, kerb, or tree outline. Press Delete to remove the selection,
          Escape to leave Draw mode.
        </div>
      </div>

      {/* Asset Library Panel - RIGHT SIDE */}
      <div style={{ width: 340, background: t.chrome, borderLeft: `1px solid ${t.line}`,
        display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: t.ink, marginBottom: 16 }}>Asset Library</h3>

        <div style={{ flex: 1, overflowY: 'auto' }} className="placer-scroll">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {availableAssets.map((asset) => {
              const cat = CAT[asset.cat];
              return (
                <button
                  key={asset.type}
                  onClick={() => handleAddAsset(asset)}
                  style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 10, padding: 12, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 8, background: cat.color + '22',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                    {cat.icon === 'tree' ? '🌳' : cat.icon === 'bench' ? '🪑' : cat.icon === 'light' ? '💡' :
                     cat.icon === 'play' ? '🎪' : cat.icon === 'cart' ? '🛒' : cat.icon === 'bike' ? '🚲' : '📦'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, textAlign: 'center' }}>
                    {asset.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImaginationCanvas;
