/* PLACER — Imagination Canvas with built-in asset library, and a pen.
 *
 * The stage is `width` × `height` in its own units, which is the shape of the photo it
 * shows, and is drawn as large as fits the space it has without changing that shape,
 * so the photo is never stretched or cut. Assets and drawn lines are kept in stage
 * units, whatever size it is shown at.
 *
 * Given `onLinesChange`, a Pen button over the library opens DrawingTools, and while it
 * is open the pointer draws on the photo instead of moving assets. The lines go on a
 * layer of their own over everything, so the eraser rubs out drawing and nothing else.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import posthog from 'posthog-js';
import { Stage, Layer, Circle, Line, Text, Transformer, Image as KonvaImage } from 'react-konva/lib/ReactKonvaCore';
import 'konva/lib/shapes/Circle';
import 'konva/lib/shapes/Text';
import 'konva/lib/shapes/Transformer';
import 'konva/lib/shapes/Image';
import 'konva/lib/shapes/Line';
import useImage from 'use-image';
import { THEME } from '../theme';
import { CAT, CAT_LIST } from '../theme';
import { Icon } from './Icon';
import { DEFAULT_BRUSH, DrawingTools } from './DrawingTools';

const Asset = ({ asset, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  const cat = CAT[asset.cat] || CAT.green;
  const radius = asset.scale * 40;
  const rotation = asset.rotation || 0;
  const [image] = useImage(asset.icon || '');

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
    // Re-attach whenever the icon finishes loading too: that swaps the rendered
    // node from the fallback Circle to the Image (see `shape` below), and without
    // this the Transformer keeps pointing at the now-detached old node.
  }, [isSelected, Boolean(image)]);

  const handleDragEnd = (e) => {
    onChange({
      ...asset,
      x: e.target.x(),
      y: e.target.y()
    });
  };

  // Resize and rotate both land here: the Transformer only ever moves the node's
  // own scaleX/scaleY/rotation, so this reads those back into the asset (folding
  // scale into our own radius-driven `scale` field) and resets the node's scale to
  // 1 so next render's radius-derived width/height is the only source of size.
  const handleTransformEnd = () => {
    const node = shapeRef.current;
    const scaleX = node.scaleX();

    onChange({
      ...asset,
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scale: asset.scale * scaleX
    });

    node.scaleX(1);
    node.scaleY(1);
  };

  const commonProps = {
    ref: shapeRef,
    x: asset.x,
    y: asset.y,
    rotation,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd
  };

  let shape;
  if (image) {
    // Fit the artwork inside the same diameter the old color circle used, so
    // resizing/rotating feels the same as before — just without the swatch.
    const diameter = radius * 2;
    const fit = Math.min(diameter / image.width, diameter / image.height);
    const iconWidth = image.width * fit;
    const iconHeight = image.height * fit;

    shape = (
      <KonvaImage
        {...commonProps}
        image={image}
        width={iconWidth}
        height={iconHeight}
        offsetX={iconWidth / 2}
        offsetY={iconHeight / 2}
      />
    );
  } else {
    // No artwork for this asset type (e.g. Play) — fall back to the color
    // swatch so it stays visible and selectable on the canvas.
    shape = <Circle {...commonProps} radius={radius} fill={cat.color} opacity={0.8} />;
  }

  return (
    <>
      {shape}
      <Text
        x={asset.x - 30}
        y={asset.y + radius + 6}
        text={asset.label}
        fontSize={14}
        fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
        fill={cat.color}
        align="center"
        width={60}
        listening={false}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
        />
      )}
    </>
  );
};

const BackgroundImage = ({ src, width, height }) => {
  const [image] = useImage(src);

  if (!image) return null;

  // Cover-fit: scale uniformly to fill the stage and crop whatever overflows,
  // rather than stretching to width/height. A capture's aspect ratio doesn't
  // always match the stage's (the plain-map toPng fallback in MapContainer
  // takes on the map div's on-screen size, not a fixed ratio), and stretching
  // it to fit would skew the photo instead of just cropping it.
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  return (
    <KonvaImage
      image={image}
      x={(width - drawWidth) / 2}
      y={(height - drawHeight) / 2}
      width={drawWidth}
      height={drawHeight}
      listening={false}
    />
  );
};

const ImaginationCanvas = ({
  availableAssets = [],
  canvasAssets = [],
  onCanvasAssetsChange,
  width = 1000,
  height = 700,
  backgroundImage = null,
  // Optional: parent-owned ref, so a caller can export the composite via
  // stage.toDataURL(). A plain prop rather than forwardRef, because this component
  // is consumed through lazy() + Suspense.
  stageRef: externalStageRef = null,
  // Fit the width it is given rather than fill a full-screen step: the stage is drawn
  // smaller, its assets still placed in its own width × height, and the library goes
  // under it when there is no room beside it. For a project's page (IdeaVisualizerOnPage).
  fit = false,
  // What has been drawn, as [{ id, tool, color, size, opacity, points }], and where to
  // report a change. Without onLinesChange there is no pen.
  lines = [],
  onLinesChange = null,
}) => {
  const t = THEME;
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const internalStageRef = useRef();
  const stageRef = externalStageRef || internalStageRef;
  const assetCounter = useRef(0);
  const areaRef = useRef(null);
  const drawLayerRef = useRef(null);
  // The space the stage has, so it can be drawn as large as fits.
  const [area, setArea] = useState(null);
  const canDraw = typeof onLinesChange === 'function';
  const [penOpen, setPenOpen] = useState(false);
  const [brush, setBrush] = useState(DEFAULT_BRUSH);
  // The line being drawn, kept here until the pointer lifts so each move does not
  // re-render the whole flow.
  const [liveLine, setLiveLine] = useState(null);
  const lineCounter = useRef(0);
  const drawing = canDraw && penOpen;

  useEffect(() => {
    if (!areaRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setArea({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) });
    });
    observer.observe(areaRef.current);
    return () => observer.disconnect();
  }, []);
  // One scale for both axes, so the photo keeps its shape: as large as fits, never
  // larger than its own size. A page that fits its width only lets the height follow.
  const ratio = area && area.width > 0
    ? Math.max(0.05, Math.min(1, area.width / width, fit || !(area.height > 0) ? Infinity : area.height / height))
    : 1;

  // Pointer positions in stage units, whatever size the stage is shown at.
  const pointer = () => {
    const stage = stageRef.current;
    const position = stage?.getPointerPosition?.();
    if (!position) return null;
    return { x: position.x / ratio, y: position.y / ratio };
  };

  const startLine = () => {
    if (!drawing) return;
    const at = pointer();
    if (!at) return;
    lineCounter.current += 1;
    setLiveLine({
      id: `line-${Date.now()}-${lineCounter.current}`,
      tool: brush.tool,
      color: brush.color,
      size: brush.size,
      opacity: brush.opacity,
      points: [at.x, at.y, at.x, at.y],
    });
  };

  const extendLine = () => {
    if (!liveLine) return;
    const at = pointer();
    if (!at) return;
    setLiveLine((line) => line && { ...line, points: [...line.points, at.x, at.y] });
  };

  const endLine = () => {
    if (!liveLine) return;
    onLinesChange([...lines, liveLine]);
    posthog.capture('canvas_line_drawn', { tool: liveLine.tool, total_lines: lines.length + 1 });
    setLiveLine(null);
  };

  const openPen = (open) => {
    setPenOpen(open);
    // Drawing and moving assets do not mix: the selection goes while the pen is out.
    if (open) setSelectedAssetId(null);
  };

  const handleAddAsset = (libraryAsset) => {
    assetCounter.current += 1;
    const newAsset = {
      id: `canvas-asset-${assetCounter.current}`,
      type: libraryAsset.type,
      label: libraryAsset.label,
      cat: libraryAsset.cat,
      icon: libraryAsset.icon,
      // Each new one a step along from the last, so several added in a row do not hide
      // under one another.
      x: width / 2 + ((canvasAssets.length % 5) - 2) * 60,
      y: height / 2 + ((Math.floor(canvasAssets.length / 5) % 3) - 1) * 60,
      scale: 1,
      rotation: 0
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
    if (selectedAssetId) {
      const filtered = canvasAssets.filter(asset => asset.id !== selectedAssetId);
      onCanvasAssetsChange(filtered);
      setSelectedAssetId(null);
    }
  }, [selectedAssetId, canvasAssets, onCanvasAssetsChange]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAssetId) {
        e.preventDefault();
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAssetId, handleDeleteSelected]);

  return (
    <div style={{ display: 'flex', height: fit ? 'auto' : '100%', background: t.page, flexWrap: fit ? 'wrap' : 'nowrap' }}>
      {/* Canvas Area */}
      <div style={{ flex: fit ? '999 1 520px' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 16 }}>
        <div style={{ background: t.surface, borderRadius: 12, padding: 16, marginBottom: 16,
          border: `1px solid ${t.line}`, boxShadow: t.shadow, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 500 }}>
              <span className="placer-disp" style={{ color: t.ink, fontWeight: 700 }}>{canvasAssets.length}</span> assets placed
              {selectedAssetId && (
                <span style={{ marginLeft: 16, color: t.accent }}>
                  Selected: {canvasAssets.find(a => a.id === selectedAssetId)?.label}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDeleteSelected}
                disabled={!selectedAssetId}
                style={{ height: 34, padding: '0 14px', borderRadius: 12,
                  cursor: selectedAssetId ? 'pointer' : 'not-allowed',
                  background: '#B3261E', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13,
                  opacity: selectedAssetId ? 1 : 0.5 }}>
                Delete
              </button>
              <button
                onClick={() => onCanvasAssetsChange([])}
                disabled={canvasAssets.length === 0}
                style={{ height: 34, padding: '0 14px', borderRadius: 12,
                  cursor: canvasAssets.length > 0 ? 'pointer' : 'not-allowed',
                  background: t.lineStrong, color: t.ink, border: 'none', fontWeight: 700, fontSize: 13,
                  opacity: canvasAssets.length > 0 ? 1 : 0.5 }}>
                Clear All
              </button>
            </div>
          </div>
        </div>

        <div ref={areaRef} style={{ flex: 1, minHeight: fit ? undefined : 0, background: t.surface, borderRadius: 12, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
          <Stage
            ref={stageRef}
            width={width * ratio}
            height={height * ratio}
            scaleX={ratio}
            scaleY={ratio}
            onMouseDown={startLine}
            onTouchStart={startLine}
            onMouseMove={extendLine}
            onTouchMove={extendLine}
            onMouseUp={endLine}
            onTouchEnd={endLine}
            onMouseLeave={endLine}
            style={{
              background: backgroundImage ? '#000' : '#F6F3EC',
              cursor: drawing ? 'crosshair' : undefined,
              // While drawing, a finger draws rather than scrolls the page.
              touchAction: drawing ? 'none' : undefined,
            }}
          >
            <Layer>
              {/* Background Image */}
              {backgroundImage && (
                <BackgroundImage src={backgroundImage} width={width} height={height} />
              )}
            </Layer>
            <Layer listening={!drawing}>
              {canvasAssets.map((asset) => (
                <Asset
                  key={asset.id}
                  asset={asset}
                  isSelected={asset.id === selectedAssetId}
                  onSelect={() => setSelectedAssetId(asset.id)}
                  onChange={handleAssetChange}
                />
              ))}
            </Layer>
            {canDraw && (
              <Layer ref={drawLayerRef} listening={false}>
                {[...lines, ...(liveLine ? [liveLine] : [])].map((line) => (
                  <Line
                    key={line.id}
                    points={line.points}
                    stroke={line.tool === 'eraser' ? '#000000' : line.color}
                    strokeWidth={line.size}
                    opacity={line.tool === 'eraser' ? 1 : line.opacity}
                    lineCap="round"
                    lineJoin="round"
                    tension={0.4}
                    globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'}
                  />
                ))}
              </Layer>
            )}
          </Stage>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: t.surfaceAlt, borderRadius: 12,
          borderLeft: `4px solid ${t.accent}`, fontSize: 13, color: t.ink }}>
          {drawing ? (
            <><strong>Drawing:</strong> drag on the photo to draw. Pick a colour, thickness and opacity in the
              pen card, or switch to the eraser to rub out a line. Close the pen card to move assets again.</>
          ) : (
            <><strong>Tip:</strong> Click assets from the library to add them. Drag to move, use corner
              handles to resize, and the top handle to rotate. Press Delete to remove the selection.
              {canDraw && ' Use the pen to colour and doodle on the photo.'}</>
          )}
        </div>
      </div>

      {/* Asset Library Panel - RIGHT SIDE */}
      <div style={{ width: fit ? 'auto' : 340, flex: fit ? '1 1 260px' : undefined, background: t.chrome,
        borderLeft: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column',
        height: fit ? 'auto' : '100%', maxHeight: fit ? 560 : undefined, padding: 16 }}>
        {canDraw && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button type="button" aria-pressed={penOpen} onClick={() => openPen(!penOpen)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px',
                borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--placer-font)', fontSize: 14, fontWeight: 700,
                border: `1.5px solid ${penOpen ? '#3A39FF' : t.ink}`,
                background: penOpen ? '#3A39FF' : t.surface, color: penOpen ? '#FFFFFF' : t.ink }}>
              <Icon name="pencil" size={16} stroke={2} />Pen
              {lines.length > 0 && (
                <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>
                  · {lines.length}<span className="placer-visually-hidden"> {lines.length === 1 ? 'line' : 'lines'} drawn</span>
                </span>
              )}
            </button>
          </div>
        )}
        {drawing && (
          <DrawingTools t={t} brush={brush} onBrushChange={setBrush} canUndo={lines.length > 0}
            onUndo={() => onLinesChange(lines.slice(0, -1))} onClear={() => onLinesChange([])}
            onClose={() => openPen(false)} />
        )}
        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginBottom: 16 }}>Asset Library</h3>

        <div style={{ flex: 1, overflowY: 'auto' }} className="placer-scroll">
          {/* Grouped under the categories the description picks from, in their order. */}
          {CAT_LIST.map((category) => {
            const inCategory = availableAssets.filter((asset) => asset.cat === category.key);
            if (inCategory.length === 0) return null;
            return (
              <section key={category.key} aria-label={category.label} style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: t.inkDim, margin: '0 0 10px' }}>
                  {category.label}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {inCategory.map((asset) => (
                    <button
                      key={asset.type}
                      type="button"
                      onClick={() => handleAddAsset(asset)}
                      style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 12, padding: 12, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 60, borderRadius: 12, background: category.color + '0F',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                        {asset.icon ? (
                          <img src={asset.icon} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                        ) : '📦'}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, textAlign: 'center' }}>
                        {asset.label}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ImaginationCanvas;
