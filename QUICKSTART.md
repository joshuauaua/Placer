# Placer - Quick Start Guide

Get up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Google Maps API Key

### Option A: Use Without Google Maps (Limited)
The app will work but map/Street View will show warnings. You can still test the canvas editor with placeholder data.

### Option B: Add Your Google Maps API Key (Recommended)

1. Get a free API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable these APIs:
   - Maps JavaScript API
   - Street View Static API (optional)
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` and add your key:
   ```
   VITE_GOOGLE_MAPS_API_KEY=AIzaSyC...your_actual_key
   ```

## Step 3: Run the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Step 4: Try It Out!

### Workflow
1. **Navigate**: Use the map and Street View to find a location
2. **Capture**: Click "Capture View for Imagination"
3. **Edit**: Click assets in the left panel to add them to the canvas
4. **Transform**: 
   - Click an asset to select it
   - Drag to move
   - Drag corners to resize
   - Drag the rotator (circle above) to rotate
   - Press Delete/Backspace to remove
5. **Compare**: Click "Before/After" tab to see the slider comparison
6. **Save**: Fill in the sidebar form and click "Save Imagination"

### Testing Without Google Maps
If you don't have an API key yet, you can still test:
1. Click "Capture View for Imagination" (it will capture placeholder data)
2. You'll be taken to the Canvas Editor
3. Add assets and test all the canvas features
4. The before/after slider will work with placeholder images

## Step 5: View Your Saved Data

Open browser DevTools (F12) → Console → Type:
```javascript
localStorage.getItem('placemaking_imaginations')
```

You'll see all your saved projects!

## Common Issues

### "Google Maps not loading"
- Check your API key in `.env`
- Make sure you saved the file and restarted the dev server
- Verify the APIs are enabled in Google Cloud Console

### "Canvas assets not appearing"
- Check browser console for errors
- Image URLs might be blocked (CORS)
- Try the placeholder assets first - they should work

### "Build failed"
- Make sure you ran `npm install` first
- Check Node.js version (v18+ recommended)
- Delete `node_modules` and run `npm install` again

## Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder. Deploy to:
- Vercel: `vercel deploy`
- Netlify: Drag `dist/` folder to Netlify drop zone
- Any static host: Upload `dist/` contents

## Project Structure Overview

```
src/
├── components/         # React components
├── services/          # API layer (localStorage mock)
├── App.jsx           # Main app
└── index.css         # Tailwind imports
```

## Next Steps

1. **Read README.md** for full documentation
2. **Check ARCHITECTURE.md** for technical details
3. **Review PROJECT_SUMMARY.md** for feature overview
4. **Customize** assets in `src/services/api.js`
5. **Deploy** your app!

## Quick Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build

# Useful
npm run lint         # Check code quality (if configured)
```

## Need Help?

- Check the [README.md](./README.md) for detailed setup
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for technical deep-dive
- Open an issue on GitHub

---

**That's it!** You now have a fully functional placemaking tool running locally. Start reimagining public spaces! 🌳🪑✨
