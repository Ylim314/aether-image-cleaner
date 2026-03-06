# Aether Image Cleaner

Browser-based image cleanup for AI-generated images. The app runs fully in the browser with OpenCV.js and does not upload files to a server.

## Positioning

This repository is meant to be a real portfolio project, not a throwaway demo. The focus is:

- local-only image cleanup
- reversible editing workflow
- practical safeguards for large files
- a simple static deployment model

## Current Features

- Drag and drop upload for `PNG`, `JPG`, and `WebP`
- File type and file size validation
- Large image protection with automatic downscaling
- Bottom crop tool for fast cleanup
- Region-based inpainting with OpenCV Telea
- Sharpen tool for final touch-up
- Undo and redo history with bounded snapshots
- Hold-to-compare original preview
- Processing states and inline error handling

## Technical Notes

- Frontend: HTML, CSS, vanilla JavaScript
- Image engine: `OpenCV.js`
- Deployment: static hosting only

The app keeps a compressed edit history and limits working resolution so the browser does not collapse on oversized uploads.

## Run Locally

Serve the folder with any static file server:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Project Structure

- `index.html`: UI shell
- `css/style.css`: layout and visual system
- `js/app.js`: state, upload flow, history, compare, selection
- `js/processor.js`: OpenCV-backed image operations

## Roadmap

- brush-based mask editing
- export format chooser
- split-screen before/after comparison
- retry path for OpenCV load failures
- optional preset workflows for common watermark layouts

## License

MIT
