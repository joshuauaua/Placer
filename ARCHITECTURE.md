# Placer - Architecture Documentation

## System Overview

Placer is a single-page React application that enables users to reimagine public spaces by overlaying visual assets onto Google Street View captures.

## Component Hierarchy

```
App.jsx (Root Orchestrator)
│
├── MapContainer.jsx
│   ├── Google Maps Instance
│   └── Street View Panorama
│
├── ImaginationCanvas.jsx
│   ├── Asset Library Panel
│   └── Konva Stage
│       ├── Background Layer (Street View capture)
│       └── Asset Layer
│           ├── Asset 1 (draggable, resizable, rotatable)
│           ├── Asset 2
│           └── ...
│
├── BeforeAfterSlider.jsx
│   ├── Before Image (original Street View)
│   ├── After Image (with canvas overlay)
│   └── Interactive Slider Handle
│
└── SidebarForm.jsx
    ├── Metadata Form
    │   ├── Title Input
    │   ├── Description Textarea
    │   ├── Existing Problems Textarea
    │   └── Proposed Solution Textarea
    └── Social Interactions
        ├── Upvote Button
        ├── Comments Section
        └── Share Button
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          App.jsx                            │
│                    (Central State Manager)                  │
│                                                             │
│  State:                                                     │
│  - currentView: 'map' | 'canvas' | 'comparison'            │
│  - capturedView: { position, pov, timestamp }              │
│  - availableAssets: Asset[]                                │
│  - canvasAssets: CanvasAsset[]                             │
│  - currentImagination: ImaginationData                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ MapContainer │    │ Canvas Editor│    │ Before/After │
│              │    │              │    │   Slider     │
│ Props:       │    │ Props:       │    │              │
│ - apiKey     │    │ - assets[]   │    │ Props:       │
│ - onCapture  │    │ - onChange   │    │ - before     │
│              │    │              │    │ - after      │
└──────────────┘    └──────────────┘    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ SidebarForm  │
                    │              │
                    │ Props:       │
                    │ - data       │
                    │ - onSave     │
                    │ - onUpvote   │
                    │ - onComment  │
                    │ - onShare    │
                    └──────────────┘
```

## Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                         │
│              (MapContainer, Canvas, Sidebar...)             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ async function calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   src/services/api.js                       │
│                   (Abstraction Layer)                       │
│                                                             │
│  Functions:                                                 │
│  - fetchAssets()                                           │
│  - fetchImaginations()                                     │
│  - saveImagination(data)                                   │
│  - upvoteImagination(id)                                   │
│  - addComment(id, comment)                                 │
│  - exportImagination(id)                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ localStorage API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Browser localStorage                     │
│                                                             │
│  Keys:                                                      │
│  - placemaking_imaginations                                │
│  - placemaking_assets                                      │
│  - placemaking_upvotes                                     │
│  - placemaking_comments                                    │
└─────────────────────────────────────────────────────────────┘

Note: Replace localStorage calls with HTTP fetch() to swap in real backend
```

## State Management Flow

### Workflow 1: Capturing a View

```
User navigates Street View
       │
       ▼
User clicks "Capture View"
       │
       ▼
MapContainer fires onCaptureView callback
       │
       ▼
App.jsx updates state:
  - setCapturedView(viewData)
  - setCurrentView('canvas')
       │
       ▼
ImaginationCanvas renders with captured view data
```

### Workflow 2: Adding Assets to Canvas

```
User clicks asset in library
       │
       ▼
ImaginationCanvas.handleAddAsset()
       │
       ▼
New canvas asset created with:
  - Unique ID
  - Position (centered)
  - Default size/rotation
       │
       ▼
onCanvasAssetsChange() callback fires
       │
       ▼
App.jsx updates state:
  - setCanvasAssets([...existing, newAsset])
       │
       ▼
Canvas re-renders with new asset
```

### Workflow 3: Saving Imagination

```
User fills form in SidebarForm
       │
       ▼
User clicks "Save Imagination"
       │
       ▼
SidebarForm fires onSave callback
       │
       ▼
App.jsx calls saveImagination() from api.js
       │
       ▼
api.js saves to localStorage:
  {
    id: generated,
    title, description, problems, solution,
    capturedView, canvasAssets,
    timestamp, upvotes, comments
  }
       │
       ▼
App.jsx updates currentImagination state
       │
       ▼
Alert confirms success
```

## React-Konva Canvas Architecture

### Stage Structure

```
<Stage> (1000x700px)
  │
  └── <Layer>
        │
        ├── <KonvaImage> (Background - Street View)
        │
        ├── <Asset> (Canvas Asset 1)
        │     ├── <KonvaImage> (Asset visual)
        │     └── <Transformer> (if selected)
        │
        ├── <Asset> (Canvas Asset 2)
        │     ├── <KonvaImage>
        │     └── <Transformer>
        │
        └── ...
```

### Transformer Behavior

1. **Selection**: Click on asset → `setSelectedAssetId(asset.id)`
2. **Transformer Attachment**: `useEffect` attaches Transformer to selected asset
3. **User Interaction**:
   - Drag corners → Resize
   - Drag rotator → Rotate
   - Drag asset → Move
4. **Transform End**: `onTransformEnd` fires → Update asset in state
5. **Deselection**: Click empty area → `setSelectedAssetId(null)`

## Google Maps Integration

### Initialization Sequence

```
1. Component mounts → useEffect runs
2. Check if window.google exists
3. If not, dynamically load script:
   <script src="https://maps.googleapis.com/maps/api/js?key=..."></script>
4. Once loaded, initialize:
   - new google.maps.Map(mapRef.current, options)
   - new google.maps.StreetViewPanorama(streetViewRef.current, options)
5. Link map and panorama:
   - map.setStreetView(panorama)
6. Attach event listeners:
   - position_changed
   - pov_changed
7. Update React state on changes
```

## Performance Considerations

### Canvas Optimization

- **Image Caching**: `use-image` hook caches loaded images
- **Selective Rendering**: Only selected asset has Transformer
- **Event Delegation**: Stage-level click handler for deselection

### Maps Optimization

- **Script Loading**: Load Google Maps script once per session
- **Event Throttling**: Consider throttling position/pov updates
- **Cleanup**: Remove event listeners on unmount

### Asset Library

- **Lazy Loading**: Load assets on demand (future enhancement)
- **Placeholder Images**: Use data URIs or placeholder service
- **Asset Categories**: Group assets for better organization

## Security Considerations

### API Key Protection

- Store in `.env` file (not committed to git)
- Use `VITE_` prefix for Vite environment variables
- Consider domain restrictions in Google Cloud Console

### Data Validation

- Validate user inputs before saving
- Sanitize data when exporting
- Limit localStorage usage to prevent quota errors

## Future Backend Integration

### Replacing localStorage with Real API

Current (localStorage):
```javascript
export const saveImagination = async (data) => {
  await simulateDelay();
  const imaginations = JSON.parse(localStorage.getItem('...'));
  imaginations.push(data);
  localStorage.setItem('...', JSON.stringify(imaginations));
  return data;
};
```

Future (HTTP API):
```javascript
export const saveImagination = async (data) => {
  const response = await fetch('/api/imaginations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

**No component changes required!** The async/await interface remains identical.

## Error Handling Strategy

### Current Implementation

- Console logging for debugging
- Alert dialogs for user feedback
- Try-catch blocks in async operations

### Future Enhancements

- Toast notifications
- Error boundaries for component crashes
- Retry logic for failed operations
- Offline support with service workers

## Testing Strategy (Recommended)

### Unit Tests

- Service layer functions (api.js)
- Pure utility functions
- Component logic extraction

### Integration Tests

- Canvas interactions (drag, resize, rotate)
- Form submissions
- State updates

### E2E Tests

- Full user workflows
- Google Maps integration
- Cross-browser compatibility

## Deployment Considerations

### Environment Variables

- Development: `.env.local`
- Production: Set via hosting platform
- Never commit actual API keys

### Build Optimization

```bash
npm run build
```

- Code splitting (Vite automatic)
- Asset optimization
- Lazy loading routes/components

### Hosting Recommendations

- **Vercel**: Zero-config React hosting
- **Netlify**: Built-in CI/CD
- **GitHub Pages**: Free static hosting
- **AWS S3 + CloudFront**: Enterprise scale

## Dependencies Overview

| Package | Purpose | Version |
|---------|---------|---------|
| react | UI framework | ^19.x |
| react-dom | React DOM renderer | ^19.x |
| react-konva | Canvas manipulation | Latest |
| konva | HTML5 Canvas library | Latest |
| tailwindcss | CSS framework | ^3.x |
| @vis.gl/react-google-maps | Google Maps wrapper | Latest |
| use-image | Image loading hook | Latest |

## Development Guidelines

### Code Style

- Functional components only
- Hooks for state management
- Props destructuring
- Clear, descriptive variable names

### Component Design

- Single Responsibility Principle
- Props for configuration, callbacks for communication
- Self-contained styling with Tailwind
- Comprehensive JSDoc comments

### File Organization

- Components in `src/components/`
- Services in `src/services/`
- Utilities in `src/utils/` (if needed)
- Assets in `public/`

## Troubleshooting

### Google Maps Not Loading

- Check API key is set in `.env`
- Verify APIs are enabled in Google Cloud Console
- Check browser console for errors
- Ensure domain is allowed (if restrictions set)

### Canvas Assets Not Rendering

- Verify image URLs are accessible
- Check browser console for CORS errors
- Ensure `use-image` hook is loading images
- Check Konva Stage dimensions

### localStorage Quota Exceeded

- Clear old data: `localStorage.clear()`
- Implement data pagination
- Consider compression for large datasets
- Switch to IndexedDB for larger storage
