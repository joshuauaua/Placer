/* PLOT — Imagination Canvas with built-in asset library */

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Circle, Text, Transformer, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import { THEME } from '../theme';
import { CAT } from '../theme';

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
        fontFamily="Archivo"
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
  width = 1000,
  height = 700,
  backgroundImage = null
}) => {
  const t = THEME;
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const stageRef = useRef();
  const assetCounter = useRef(0);

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

    onCanvasAssetsChange([...canvasAssets, newAsset]);
    setSelectedAssetId(newAsset.id);
  };

  const handleAssetChange = (updatedAsset) => {
    const updatedAssets = canvasAssets.map(asset =>
      asset.id === updatedAsset.id ? updatedAsset : asset
    );
    onCanvasAssetsChange(updatedAssets);
  };

  const handleDeleteSelected = () => {
    if (selectedAssetId) {
      const filtered = canvasAssets.filter(asset => asset.id !== selectedAssetId);
      onCanvasAssetsChange(filtered);
      setSelectedAssetId(null);
    }
  };

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) {
      setSelectedAssetId(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAssetId) {
        e.preventDefault();
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssetId, canvasAssets]);

  return (
    <div style={{ display: 'flex', height: '100%', background: t.page }}>
      {/* Canvas Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
        <div style={{ background: t.surface, borderRadius: 12, padding: 16, marginBottom: 16,
          border: `1px solid ${t.line}`, boxShadow: t.shadow, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, color: t.inkDim, fontWeight: 600 }}>
            <span className="plot-disp" style={{ color: t.ink, fontWeight: 700 }}>{canvasAssets.length}</span> assets placed
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
              style={{ height: 34, padding: '0 14px', borderRadius: 8, cursor: selectedAssetId ? 'pointer' : 'not-allowed',
                background: '#D6452F', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, opacity: selectedAssetId ? 1 : 0.5 }}>
              Delete
            </button>
            <button
              onClick={() => onCanvasAssetsChange([])}
              disabled={canvasAssets.length === 0}
              style={{ height: 34, padding: '0 14px', borderRadius: 8, cursor: canvasAssets.length > 0 ? 'pointer' : 'not-allowed',
                background: t.lineStrong, color: t.ink, border: 'none', fontWeight: 700, fontSize: 13, opacity: canvasAssets.length > 0 ? 1 : 0.5 }}>
              Clear All
            </button>
          </div>
        </div>

        <div style={{ flex: 1, background: t.surface, borderRadius: 12, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.line}`, boxShadow: t.shadow }}>
          <Stage
            ref={stageRef}
            width={width}
            height={height}
            onMouseDown={handleStageClick}
            onTouchStart={handleStageClick}
            style={{ background: backgroundImage ? '#000' : '#F6F3EC' }}
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
          <strong>Tip:</strong> Click assets from the library to add them. Drag to move, use corner handles to resize. Press Delete to remove.
        </div>
      </div>

      {/* Asset Library Panel - RIGHT SIDE */}
      <div style={{ width: 340, background: t.chrome, borderLeft: `1px solid ${t.line}`,
        display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: t.ink, marginBottom: 16 }}>Asset Library</h3>

        <div style={{ flex: 1, overflowY: 'auto' }} className="plot-scroll">
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
