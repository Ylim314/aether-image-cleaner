# PRD: Gemini Cleaner Web

- Version: v1.1
- Status: Draft
- Date: 2026-03-06
- Owner: Codex
- Type: Web image editing tool

## 1. Product Summary

### 1.1 Name

Gemini Cleaner Web

### 1.2 Positioning

Gemini Cleaner Web is a browser-based image cleanup tool focused on fast watermark removal, region repair, crop cleanup, and light enhancement.

The product target is straightforward:

1. Let users open a web page and process an image immediately.
2. Keep the full processing loop local in the browser.
3. Provide a result that is fast, editable, and easy to export.

### 1.3 Core Value

Upload image -> clean unwanted area -> compare result -> export.

### 1.4 Disclaimer

This product is a general-purpose image editing tool. Users are responsible for ensuring they have the right to edit and use the images they process.

## 2. Background

AI-generated images and downloaded visuals often include visible marks, bottom bars, labels, or distracting elements that users want to remove before reuse, layout, or publishing.

Current alternatives usually have one or more of these problems:

1. Desktop tools are heavy and slow to learn.
2. Many online tools require upload to a server.
3. Some tools only crop but cannot repair content.
4. Some tools are usable on desktop but break on mobile.

This product should win on speed, simplicity, and a trustworthy local-processing experience.

## 3. Goals

### 3.1 Product Goals

1. Deliver a complete usable editing loop in one page.
2. Make the core tools understandable without onboarding.
3. Keep the app stable under common user inputs.

### 3.2 User Goals

1. Complete a basic edit and export in under 1 minute.
2. See progress during expensive operations.
3. Undo mistakes safely.
4. Use the tool on desktop and mobile.

### 3.3 Success Metrics

1. Upload-to-export completion rate >= 25%.
2. First edit action rate after upload >= 60%.
3. Median time from upload to export <= 90 seconds.
4. Client-side processing failure rate <= 5%.

## 4. Non-Goals

1. No account system in v1.
2. No cloud storage in v1.
3. No team collaboration in v1.
4. No full Photoshop-like layer editing.
5. No promise of perfect removal for every watermark style.

## 5. Users and Scenarios

### 5.1 Target Users

1. AI image users
2. Content creators
3. Social media operators
4. Design beginners
5. Privacy-sensitive users

### 5.2 Core Scenarios

1. Remove a bottom text bar by cropping.
2. Select a rectangular watermark area and repair it with inpaint.
3. Enhance the edited image before download.
4. Retry multiple edits safely using undo.
5. Use the same flow on mobile without needing a mouse.

## 6. Product Principles

1. Local-first: image pixels are processed in the browser.
2. Tool-first: the interface should prioritize editing speed over marketing copy.
3. Function transparency: users should understand what each tool does.
4. Recoverability: every destructive edit should be reversible.
5. Graceful failure: if an operation fails, the user must have a clear next step.

## 7. Scope

### 7.1 v1 Must-Have

1. Upload and drag-and-drop import
2. Crop cleanup
3. Rectangle inpaint repair
4. Light sharpen/enhance
5. Undo and redo
6. Before/after comparison
7. Download export
8. Loading and processing states
9. File validation
10. Large-image protection
11. Mobile touch support
12. OpenCV load failure handling
13. Reset to original

### 7.2 v1.5 Enhancements

1. Brush mask repair
2. Automatic bottom-bar detection
3. Export format selection
4. Keyboard shortcuts
5. Batch processing

### 7.3 Out of Scope for v1

1. Cloud AI repair models
2. Login and saved projects
3. Multi-user collaboration
4. Public API

## 8. Functional Requirements

### 8.1 Upload

#### Goal

Import a local image safely and enter editing mode quickly.

#### Supported Formats

1. `JPG`
2. `PNG`
3. `WebP`

#### Validation Rules

1. Reject unsupported MIME types.
2. Reject files larger than `20 MB` in v1.
3. Reject images whose decoded width or height exceeds `8192 px`.
4. Reject images whose total pixel count exceeds `40 MP`.
5. Show a clear error message when validation fails.

#### UX Rules

1. Support click upload and drag-and-drop.
2. Show filename, resolution, and estimated memory impact after successful load.
3. If the user uploads a new image while editing, warn that current history will be replaced.

### 8.2 Large-Image Protection

#### Goal

Prevent browser crashes and unresponsive pages.

#### Rules

1. If image size is within limits but still heavy, show a warning before decoding.
2. If estimated raw canvas memory exceeds `160 MB`, show a warning and offer resize-first flow.
3. If the image exceeds hard limits, block editing and explain why.
4. Provide one-click downscale suggestion in a later iteration; for v1, provide guidance text.

#### Estimation Formula

Canvas memory estimate = width x height x 4 bytes.

### 8.3 Crop Cleanup

#### Goal

Offer the fastest cleanup path for bottom bars and edge marks.

#### Requirements

1. Slider controls crop height.
2. Canvas shows crop preview before apply.
3. Apply action pushes a history snapshot.
4. User can undo crop immediately.

### 8.4 Rectangle Inpaint

#### Goal

Repair a selected rectangular region using local content fill.

#### Requirements

1. Support desktop pointer input and touch input.
2. Minimum valid selection area is `8 x 8 px`.
3. User can adjust repair radius.
4. Apply action pushes a history snapshot before processing.
5. Show processing state within `200 ms`.
6. Disable repeated apply clicks while processing.

#### Failure Recovery

1. If repair fails, preserve the current image state before the failed attempt.
2. Show an inline error with recovery actions.
3. Recovery actions:
   a. Retry
   b. Reduce selection area
   c. Switch to crop mode
   d. Reset to original

### 8.5 Enhance

#### Goal

Provide a lightweight clarity improvement after editing.

#### Requirements

1. Support one sharpen control in v1.
2. Apply action pushes a history snapshot.
3. User can undo enhancement.

### 8.6 Before/After Compare

#### Goal

Let users judge whether the edit result is good enough.

#### Requirements

1. Support toggle to view original vs current.
2. Support press-and-hold preview of original.
3. Comparison should not destroy history state.

### 8.7 Undo and Redo

#### Goal

Give users confidence to experiment.

#### Requirements

1. Support at least `10` steps in normal cases.
2. Any successful image-changing operation enters history.
3. Uploading a new image resets history.
4. Redo stack is cleared when a new edit is applied after undo.

#### Memory Strategy

1. Default history cap: `10` snapshots.
2. Soft memory ceiling for history: `240 MB`.
3. If adding a new snapshot would exceed the ceiling, discard the oldest snapshots first.
4. Snapshot format in v1 can use canvas `ImageData` or data URL, but the actual implementation must document memory tradeoffs.
5. For images above `12 MP`, reduce history cap dynamically to avoid tab crashes.

#### Example

1. A `3840 x 2160` image uses about `31.6 MB` per RGBA snapshot.
2. Ten raw snapshots would exceed `300 MB`.
3. Therefore history cannot be a fixed-count-only strategy.

### 8.8 Export

#### Goal

Let users save the processed image reliably.

#### Requirements

1. Export `PNG` in v1.
2. Preserve current canvas resolution.
3. Generate a default filename with timestamp.
4. Show export failure if `toDataURL` or related APIs fail.

## 9. Interaction Specification

### 9.1 Desktop Input

1. Use `pointerdown`, `pointermove`, `pointerup` instead of mouse-only events.
2. Keep selection constrained to canvas bounds.
3. Prevent accidental text/image dragging during selection.

### 9.2 Mobile Input

1. The same `pointer` event path should work for touch.
2. Selection handles are not required in v1.
3. Minimum touch target for primary controls should be `44 x 44 px`.
4. The tool panel must remain usable at widths down to `360 px`.
5. Avoid hover-only interactions.

### 9.3 Processing Feedback

1. Show explicit status for:
   a. OpenCV loading
   b. Image decoding
   c. Inpaint processing
   d. Exporting
2. While processing, disable conflicting actions.
3. If an operation takes longer than `1 second`, keep the loading state visible until done.

### 9.4 Error Recovery Paths

Every major failure must answer two questions for the user:

1. What failed
2. What they can do next

Required recovery mapping:

1. Invalid file -> choose another file
2. File too large -> upload smaller image
3. Decode failure -> retry with supported format
4. OpenCV load failure -> retry load or refresh
5. Inpaint failure -> retry, reduce area, switch tool, or reset
6. Export failure -> retry export or use another format in future versions

## 10. Technical Constraints

### 10.1 Stack

1. Static site deployment
2. Canvas-based editor
3. OpenCV.js for inpaint and enhancement
4. Vanilla JavaScript in current codebase

### 10.2 OpenCV Loading

#### Problem

`opencv.js` is large and can fail on weak networks or partial downloads.

#### v1 Requirements

1. Show visible loading state on first load.
2. If OpenCV fails to initialize, show retry action.
3. Support at least `1` automatic retry before giving up.
4. Do not leave the page in a silent broken state.
5. Keep crop mode available only if the product chooses to decouple crop from OpenCV-dependent actions.

### 10.3 Main-Thread Protection

1. Heavy operations should yield visible feedback immediately.
2. Long-running work should be moved to `Web Worker` in later stages if UI jank becomes unacceptable.
3. The app must avoid decoding or rendering images that exceed defined hard limits.

### 10.4 Browser Support

1. Latest Chrome
2. Latest Edge
3. Latest Safari
4. Latest Firefox
5. Major mobile browsers from the last 2 years

## 11. UI Structure

### 11.1 Main Areas

1. Upload area
2. Editor canvas area
3. Tool panel
4. Status and error area
5. Export action area

### 11.2 Tool Priority

1. Crop
2. Inpaint
3. Enhance
4. Compare
5. Undo and redo
6. Export

## 12. Data and Telemetry

### 12.1 Metrics

1. Page views
2. Upload success rate
3. First edit action rate
4. Export completion rate
5. Error rate
6. Median processing time

### 12.2 Events

1. `page_view`
2. `upload_start`
3. `upload_success`
4. `upload_error`
5. `opencv_load_fail`
6. `tool_crop_apply`
7. `tool_inpaint_apply`
8. `tool_enhance_apply`
9. `undo_click`
10. `redo_click`
11. `compare_view`
12. `download_click`
13. `download_success`

### 12.3 Boundaries

1. Do not send raw image pixels.
2. Do not upload user images by default.
3. Only collect anonymous interaction and performance events if analytics is kept.

## 13. Risks and Mitigations

### 13.1 Large Image Crash Risk

Mitigation:

1. Hard file and pixel limits
2. Memory estimation before edit
3. Dynamic history cap

### 13.2 Repair Quality Risk

Mitigation:

1. Keep crop as a stable fallback
2. Provide compare and undo
3. Expose simple recovery choices after failure

### 13.3 Mobile Usability Risk

Mitigation:

1. Pointer events
2. Minimum touch target sizes
3. Mobile layout verification

### 13.4 Dependency Load Risk

Mitigation:

1. OpenCV loading status
2. Retry path
3. Clear failure UI

## 14. Delivery Plan

### 14.1 P0

1. File validation
2. Large-image protection
3. Undo and redo
4. Processing loading states

### 14.2 P1

1. Mobile touch support
2. Before/after compare
3. OpenCV load retry and failure recovery

### 14.3 P2

1. Export format selection
2. Keyboard shortcuts
3. Better performance optimization

## 15. Acceptance Criteria

### 15.1 Product

1. User can finish upload -> edit -> compare -> export.
2. User can recover from common failures without refreshing immediately.
3. The app is usable on both desktop and mobile.

### 15.2 Engineering

1. Invalid files are blocked before editing.
2. Oversized images do not crash the editing flow.
3. Undo and redo work reliably under the defined memory policy.
4. Inpaint shows loading state and prevents duplicate execution.
5. OpenCV load failure shows retry path.

### 15.3 UX

1. Users understand the difference between crop and repair.
2. Users can tell whether an edit improved the image.
3. Errors explain the next action clearly.

## 16. Open Questions

1. Should v1 support client-side resize-before-edit, or keep it as guidance only?
2. Should crop mode remain available when OpenCV fails to load?
3. Should history use `ImageData`, canvas blobs, or compressed data URLs in the first implementation?
4. Is `20 MB / 40 MP / 8192 px` the right first-pass limit for target users, or should these be adjusted after testing?

## 17. Gap vs Current Repo

Already present in the current codebase:

1. Upload
2. Crop
3. Rectangle repair
4. Sharpen
5. Reset
6. PNG download

Still missing relative to this PRD:

1. File validation
2. Large-image protection
3. Undo and redo
4. Compare mode
5. Pointer-based mobile support
6. Processing loading state
7. OpenCV retry and recovery
8. Memory-aware history management

The v1 implementation priority remains:

upload -> safe edit -> compare -> export
