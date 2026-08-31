# Placer

An interactive web application for reimagining public spaces using Google Maps Street View and HTML5 Canvas manipulation.

## Features

- **Google Maps & Street View Integration**: Navigate to any location and capture the view
- **Interactive Canvas Editor**: Drag, resize, and rotate visual assets (trees, benches, etc.) on top of Street View
- **Before/After Comparison**: Interactive slider to compare original and reimagined spaces
- **Project Management**: Save, upvote, comment, and share your placemaking visions
- **Asset Library**: Pre-loaded visual assets for common placemaking elements

## Tech Stack

- **React** (Vite) - Fast, modern React development
- **Tailwind CSS** - Utility-first CSS framework
- **React-Konva** - React wrapper for HTML5 Canvas manipulation
- **Google Maps JavaScript API** - Maps and Street View integration
- **localStorage** - Mock persistence layer (easily swappable for real backend)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Google Maps API Key with Maps JavaScript API and Street View enabled

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd Placer
```

2. Install dependencies:
```bash
npm install
```

Re-run `npm ci` after pulling a commit that changes `package-lock.json` — `npm audit`
reads the lockfile, not `node_modules`, so it reports a clean tree even while an outdated
(and possibly vulnerable) build stays installed. Run `npm run deps:check` at any time to
confirm `node_modules` matches the lockfile.

Optionally, opt in to a warn-only post-merge hook that runs this check automatically after
every `git pull`/`git merge`:
```bash
git config core.hooksPath .githooks
```
The hook only prints a warning if drift is detected — it never blocks a merge, and does
nothing until you run the command above.

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Add your Google Maps API key to `.env`:
```
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### Getting a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Street View Static API (optional)
4. Create credentials (API Key)
5. Copy the API key to your `.env` file

### Running the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Running the Tests

```bash
npm run test:run     # unit and component tests (vitest, jsdom)
npm run test:e2e     # end-to-end tests (Playwright, Chromium)
npm run test:e2e:ui  # the same suite in Playwright's UI mode
```

The first E2E run needs a browser: `npx playwright install chromium`.

The E2E suite lives in `e2e/` and covers what jsdom cannot — drawing on the Konva
canvas, lazy route chunks, `/sandbox/<experiment>` URLs, and consent surviving a
reload. Two things about how it runs:

- **It builds the app itself.** `playwright.config.js` runs
  `npm run build -- -m e2e` and serves the result with `vp preview`, so the specs
  test the built app rather than the dev server. `-m e2e` loads `.env.e2e`, which
  overrides your `.env`: a run on your machine sees the same empty Google Maps key
  and placeholder PostHog credentials CI does.
- **Nothing leaves the browser.** The fixtures in `e2e/fixtures/app.js` abort every
  request that is not to the preview server, and the create-flow spec injects a stub
  of the small part of the Maps JS API that `MapContainer` uses instead of a real
  key — which is also what keeps a CI run free of secrets. `map.e2e.js` covers the
  keyless map on purpose, since that is what a misconfigured deployment looks like.

Specs are named `*.e2e.js`, not `*.spec.js`, which is what keeps vitest and
Playwright from collecting each other's files.

`.github/workflows/e2e.yml` runs the suite on every pull request and on pushes to
`Development`, and attaches the HTML report as a build artifact.

## Project Structure

```
Placer/
├── src/
│   ├── components/
│   │   ├── MapContainer.jsx          # Google Maps & Street View
│   │   ├── ImaginationCanvas.jsx     # React-Konva canvas editor
│   │   ├── SidebarForm.jsx           # Project metadata form
│   │   └── BeforeAfterSlider.jsx     # Before/After comparison slider
│   ├── services/
│   │   └── api.js                    # localStorage mock API layer
│   ├── App.jsx                       # Main application orchestrator
│   ├── main.jsx                      # React entry point
│   └── index.css                     # Tailwind CSS imports
├── public/                           # Static assets
├── e2e/                              # Playwright end-to-end specs (*.e2e.js)
├── .env.example                      # Environment variables template
├── .env.e2e                          # Environment the E2E suite builds against
└── package.json
```

## Architecture Highlights

### No Backend - Mock API Service

All data persistence is handled through `src/services/api.js`, which uses `localStorage` and async/await patterns. This design allows you to:

- Develop the full UI without a backend
- Easily swap to real API calls later by replacing the service implementation
- Test all features locally without network dependencies

Example service function:
```javascript
export const saveImagination = async (imaginationData) => {
  await simulateDelay(); // Mimics network latency
  // localStorage operations...
  return savedData;
};
```

### React-Konva Canvas Architecture

The `ImaginationCanvas` component uses React-Konva for powerful canvas manipulation:

- **Stage**: The main canvas container
- **Layer**: Canvas drawing layer
- **Image**: Individual asset nodes
- **Transformer**: Handles resize, rotate, and transform operations

Each asset is independently selectable, draggable, and transformable using Konva's built-in transformer handles.

### Component Communication

The App.jsx orchestrates all components through props and callbacks:

- **State Management**: Centralized in App.jsx using React hooks
- **View Routing**: Simple state-based view switching (map → canvas → comparison)
- **Data Flow**: Unidirectional, props down, callbacks up

## Usage Workflow

1. **Navigate**: Use Google Maps and Street View to find your location
2. **Capture**: Click "Capture View for Imagination" to lock the current view
3. **Edit**: Add assets from the library by clicking them, then drag/resize/rotate on canvas
4. **Compare**: Switch to Before/After view to see your changes
5. **Save**: Fill in project details and save to localStorage
6. **Share**: Export your imagination as a JSON file

## Customization

### Adding New Assets

Edit `src/services/api.js` and add to the `defaultAssets` array:

```javascript
{
  id: 'asset-7',
  name: 'Fountain',
  category: 'features',
  imageUrl: 'https://example.com/fountain.png',
  width: 150,
  height: 150
}
```

### Swapping to Real Backend

Replace the functions in `src/services/api.js` with actual HTTP calls:

```javascript
export const saveImagination = async (imaginationData) => {
  const response = await fetch('/api/imaginations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(imaginationData)
  });
  return response.json();
};
```

No changes needed in UI components!

## Development Tips

### Canvas Performance

For better performance with many assets:
- Use `pixelPerfect={false}` on Konva Stage for faster hit detection
- Implement virtualization for large asset libraries
- Cache images using the `use-image` hook

### Google Maps Optimization

- Load the Maps API script only once
- Use appropriate zoom levels to reduce API calls
- Consider implementing Street View panorama caching

## Building for Production

```bash
npm run build
```

The optimized build will be in the `dist/` directory.

## Future Enhancements

- [ ] Real-time collaboration (multiple users editing same space)
- [ ] Advanced asset manipulation (opacity, filters, shadows)
- [ ] Asset upload from user's device
- [ ] Export as high-resolution image
- [ ] Social features (community feed, trending reimaginations)
- [ ] Integration with city planning APIs
- [ ] AR preview mode
- [ ] AI-powered asset suggestions

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues and questions, please open an issue on GitHub.
