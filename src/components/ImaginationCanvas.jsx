/* PLACER — Imagination Canvas with built-in asset library */

import { useState, useRef, useEffect, useCallback } from 'react';
import posthog from 'posthog-js';
import { Stage, Layer, Circle, Text, Transformer, Image as KonvaImage } from 'react-konva/lib/ReactKonvaCore';
import 'konva/lib/shapes/Circle';
import 'konva/lib/shapes/Text';
import 'konva/lib/shapes/Transformer';
import 'konva/lib/shapes/Image';
import useImage from 'use-image';
import { THEME } from '../theme';
import { CAT } from '../theme';

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
        fontFamily="Helvetica"
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
  stageRef: externalStageRef = null
}) => {
  const t = THEME;
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const internalStageRef = useRef();
  const stageRef = externalStageRef || internalStageRef;
  const assetCounter = useRef(0);

  const handleAddAsset = (libraryAsset) => {
    assetCounter.current += 1;
    const newAsset = {
      id: `canvas-asset-${assetCounter.current}`,
      type: libraryAsset.type,
      label: libraryAsset.label,
      cat: libraryAsset.cat,
      icon: libraryAsset.icon,
      x: width / 2,
      y: height / 2,
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
    <div style={{ display: 'flex', height: '100%', background: t.page }}>
      {/* Canvas Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
        <div style={{ background: t.surface, borderRadius: 12, padding: 16, marginBottom: 16,
          border: `1px solid ${t.line}`, boxShadow: t.shadow, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>
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
                style={{ height: 34, padding: '0 14px', borderRadius: 8,
                  cursor: selectedAssetId ? 'pointer' : 'not-allowed',
                  background: '#D6452F', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13,
                  opacity: selectedAssetId ? 1 : 0.5 }}>
                Delete
              </button>
              <button
                onClick={() => onCanvasAssetsChange([])}
                disabled={canvasAssets.length === 0}
                style={{ height: 34, padding: '0 14px', borderRadius: 8,
                  cursor: canvasAssets.length > 0 ? 'pointer' : 'not-allowed',
                  background: t.lineStrong, color: t.ink, border: 'none', fontWeight: 700, fontSize: 13,
                  opacity: canvasAssets.length > 0 ? 1 : 0.5 }}>
                Clear All
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, background: t.surface, borderRadius: 12, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
          <Stage
            ref={stageRef}
            width={width}
            height={height}
            style={{
              background: backgroundImage ? '#000' : '#F6F3EC',
            }}
          >
            <Layer>
              {/* Background Image */}
              {backgroundImage && (
                <BackgroundImage src={backgroundImage} width={width} height={height} />
              )}
            </Layer>
            <Layer>
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
          </Stage>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: t.accent + '22', borderRadius: 8,
          borderLeft: `4px solid ${t.accent}`, fontSize: 13, color: t.ink }}>
          <strong>Tip:</strong> Click assets from the library to add them. Drag to move, use corner
          handles to resize, and the top handle to rotate. Press Delete to remove the selection.
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
                    {asset.icon ? (
                      <img src={asset.icon} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                    ) : (
                      cat.icon === 'tree' ? '🌳' : cat.icon === 'bench' ? '🪑' : cat.icon === 'light' ? '💡' :
                      cat.icon === 'play' ? '🎪' : cat.icon === 'cart' ? '🛒' : cat.icon === 'bike' ? '🚲' : '📦'
                    )}
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
