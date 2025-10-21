# FluoroView Integration Testing Guide

## Changes Made

I've updated the Next.js configuration to fix the 3D rendering issues. Here are the key changes:

### 1. Content Security Policy (CSP) - `next.config.mjs`

- Added `'wasm-unsafe-eval'` to allow WebAssembly execution (required by Draco decoder)
- This was likely the main blocker preventing the 3D model from loading

### 2. Webpack Configuration - `next.config.mjs`

- Added `@fluoroview` module alias pointing to `fluoro-viewer/src`
- Added extension alias to allow importing `.js` files from Three.js examples
- This ensures GLTFLoader and DRACOLoader can be imported correctly

### 3. HTTP Headers - `next.config.mjs`

- Set proper MIME types for `.glb` files (`model/gltf-binary`)
- Set proper MIME types for `.wasm` files (`application/wasm`)
- Added cache headers for better performance
- Applied CSP headers more selectively to avoid blocking static assets

## Testing Steps

### 1. Restart the Development Server

**IMPORTANT:** You must restart the Next.js dev server for these changes to take effect!

```bash
# Stop the current dev server (Ctrl+C)
# Then restart:
npm run dev
```

### 2. Test the FluoroView Page

1. Navigate to: http://localhost:3000/fluoroview
2. Open browser DevTools (F12) and check the Console tab
3. Look for these console messages:
   ```
   [FluoroView] fetch config start
   [FluoroView] config loaded {units: 'mm', coordinateSystem: 'LPS', ...}
   [FluoroView] loading GLB {glbPath: '/fluoroview/airway_segments.glb', dracoBase: '/fluoroview/draco/'}
   [FluoroView] GLB loaded 42
   ```

### 3. Verify Asset Loading

Check the Network tab in DevTools:

- `/fluoroview/fluoro_config.json` - should return 200 OK
- `/fluoroview/airway_segments.glb` - should return 200 OK with Content-Type: model/gltf-binary
- `/fluoroview/draco/draco_decoder.wasm` - should return 200 OK with Content-Type: application/wasm
- `/fluoroview/draco/draco_wasm_wrapper.js` - should return 200 OK

### 4. Expected Behavior

Once loaded successfully:

- You should see a 3D airway model rendered on the canvas
- The model should respond to the RAO/LAO and Cranial/Caudal sliders
- Hovering over segments should show labels
- Lobar filter checkboxes should hide/show anatomical regions
- FPS counter should show in the top-left corner

## Common Issues & Solutions

### Issue: Still showing "Loading FluoroView..." forever

**Solution:** Check browser console for errors:

- **CSP violation:** If you see CSP errors, the `wasm-unsafe-eval` fix didn't apply - restart dev server
- **404 errors:** Assets not found - verify files exist in `public/fluoroview/`
- **CORS errors:** Should not happen with local files, but check headers in Network tab

### Issue: "Failed to load configuration (404)"

**Solution:**

- Verify `public/fluoroview/fluoro_config.json` exists
- Check that Next.js is serving files from `public/` correctly
- Try accessing directly: http://localhost:3000/fluoroview/fluoro_config.json

### Issue: Config loads but GLB fails

**Solution:**

- Check if `public/fluoroview/airway_segments.glb` exists (should be ~2.6MB)
- Verify in Network tab that it's being requested from the correct path
- Check Content-Type header is `model/gltf-binary`

### Issue: GLB loads but Draco decoder fails

**Solution:**

- Verify `public/fluoroview/draco/` contains 4 files:
  - `draco_decoder.js`
  - `draco_decoder.wasm`
  - `draco_encoder.js`
  - `draco_wasm_wrapper.js`
- Check browser console for WebAssembly instantiation errors
- Ensure CSP includes `'wasm-unsafe-eval'`

### Issue: Works in standalone but not integrated

**Root Cause Analysis:**
The standalone version (`fluoro-viewer/index.html` + `vite dev`) works because:

1. Vite dev server has permissive CORS/CSP by default
2. Assets are served from the same origin without strict headers
3. No Next.js middleware or routing complexity

The integrated version requires:

1. Proper CSP configuration for WebAssembly
2. Correct static file serving from Next.js public folder
3. Module resolution for Three.js examples through webpack

## Debugging Commands

```bash
# Check if assets exist
ls -lah public/fluoroview/
ls -lah public/fluoroview/draco/

# Verify file sizes
du -h public/fluoroview/airway_segments.glb  # Should be ~2.6M

# Test asset URLs directly (with dev server running)
curl -I http://localhost:3000/fluoroview/fluoro_config.json
curl -I http://localhost:3000/fluoroview/airway_segments.glb
curl -I http://localhost:3000/fluoroview/draco/draco_decoder.wasm
```

## Production Build Testing

After verifying it works in development:

```bash
# Build for production
npm run build

# Test production build locally
npm run start

# Navigate to http://localhost:3000/fluoroview
```

## If Still Not Working

If the 3D viewer still doesn't render after following all steps:

1. **Check Browser Console:** Share any error messages
2. **Check Network Tab:** Share which requests are failing (404, CSP violations, etc.)
3. **Verify Assets:** Ensure all files in `public/fluoroview/` match the standalone version
4. **Test Standalone:** Confirm standalone version still works:

   ```bash
   cd fluoro-viewer
   npm run dev
   # Visit http://localhost:5173
   ```

5. **Compare Configs:** Ensure `public/fluoroview/fluoro_config.json` matches `fluoro-viewer/public/fluoro_config.json` except for `asset_base_url`

## Summary

The main fix was adding `'wasm-unsafe-eval'` to the CSP policy. WebAssembly is required for Draco mesh compression, which is essential for loading the GLB model efficiently. Without this CSP directive, browsers block WASM instantiation, preventing the 3D model from loading.
