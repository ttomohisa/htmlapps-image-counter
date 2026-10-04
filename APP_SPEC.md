# APP_SPEC.md — Image Counter / 画像カウンター

## 1. Product identity

- **Name:** Image Counter / 画像カウンター
- **Version:** 1.0.0
- **Repository:** `ttomohisa/htmlapps-image-counter`
- **Distribution:** `dist/index.html` and `dist/index.self-extract.html`
- **Purpose:** Count objects in one or more photos manually by placing point or rectangle markers, without automatic recognition or uploads.
- **Primary users:** People doing inventory, part counting, inspection, field surveys, photo-based checks, and any task where double-counting or losing the current position is a problem.

## 2. Product principles

1. **Manual counting first.** The app does not guess with AI. A count is created only by explicit user action.
2. **Local-first.** Images, markers, notes, drafts, and exports stay in the browser. Runtime network access is blocked with `connect-src 'none'`.
3. **Fast repetitive work.** Undo/Redo, category switching, current-category emphasis, and mobile controls must remain reachable while counting.
4. **Editable source data, read-only sharing.** The main app edits projects. Exported viewer HTML is read-only, but can be imported back into the main app to resume editing.
5. **Single HTML.** The normal and self-extracting builds must work as self-contained browser apps.

## 3. Core workflow

1. Add one or more images, or open the camera.
2. Choose **Point**, **Rectangle**, or **Move** mode.
3. Choose the marker type currently being counted.
4. Place point markers by tapping/clicking, or rectangle markers by dragging around an object.
5. Select an existing marker only when it needs editing.
6. Move markers; resize selected rectangles from their corner handles; change type or delete from the contextual marker controls.
7. Correct image visibility if needed with brightness, contrast, grayscale, and 90° rotation. The original image data remains unchanged.
8. Mark each image complete and continue to the next unfinished image.
9. Review project-wide totals and per-type totals.
10. Export a read-only viewer HTML or a ZIP containing CSV files and annotated JPEG images.

## 4. Functional requirements

### Images and camera

- Accept one or multiple image files.
- Maximum 30 images per project.
- Maximum 35 MB per input image and 220 MB per in-memory project.
- Support drag-and-drop and clipboard image paste on desktop.
- Support live camera capture through `getUserMedia()` when available.
- Closing the camera dialog or leaving the page invalidates pending camera starts and stops tracks; late results cannot restart capture. Playback errors also release the acquired stream.
- Show a post-capture review with **Retake**, **Use this photo**, and **Use & capture next** before adding a camera image.
- Fall back to the device camera/file input when live camera access is unavailable.

### Marker modes

- **Point:** one tap/click creates one count.
- **Rectangle:** one drag creates one count and stores normalized `x`, `y`, `w`, and `h`.
- **Move:** pans the image without adding counts.
- New markers must not immediately open editing controls.
- Selecting an existing marker shows type-change, needs-review, and delete controls.
- Needs-review is an independent boolean flag on a marker; it must not alter marker type, numbering, or count.
- Flagged point and rectangle markers show a small amber `!` badge and can be unflagged from the same contextual control.
- Existing point and rectangle markers can be moved.
- Selected rectangles show four resize handles and can be resized after creation.
- The most recently added marker is visually emphasized briefly.
- Marker numbering is **per marker type**, while project/image totals remain independent.

### Types and visibility

- The first type uses `#d15c52` by default.
- Types are switchable directly from the translucent dock along the lower edge of the canvas.
- Desktop numeric keys `1`–`9` select the corresponding type.
- Users can add, rename, recolor, hide/show, and delete types.
- Each type has its own marker visibility toggle.
- A global marker visibility toggle hides/shows all marker overlays without deleting data.
- Marker numbers can be shown/hidden.
- Marker size and opacity are configurable.

### Image correction

- Brightness.
- Contrast.
- Grayscale amount.
- 90° left/right rotation.
- Reset corrections.
- Corrections are non-destructive and must be preserved in drafts, viewer HTML, JPEG export, and CSV metadata.

### Multi-image project

- Show image thumbnails with per-image count and completion state.
- Preserve capture-time metadata: prefer JPEG EXIF DateTimeOriginal/DateTimeDigitized, fall back to the source file timestamp, and use the actual capture time for in-app camera photos.
- Allow Left/Right arrow keys to move to the previous/next image when focus is not in an editable field or modal dialog.
- Navigate previous/next and jump directly to any image.
- Mark an image complete from the upper-right area of the canvas.
- Provide **Next incomplete** navigation.
- Editing a completed image makes it in-progress again when count data or image correction changes.
- Show project-wide total marker count, completed image count, needs-review count, and per-type totals.
- An image with one or more needs-review markers cannot be marked complete; the UI must state how many review items remain.

### Undo / Redo

Undo and redo must cover marker creation, deletion, movement, rectangle resize, type changes, visibility/display changes where appropriate, image completion, and supported image correction changes.

### Local draft and storage

- Auto-save project state in IndexedDB.
- Show current project data size, saved draft size, and available browser storage when available.
- Default to compressing the **draft copy only** to WebP to reduce local storage usage.
- Allow draft WebP quality adjustment.
- Restoring a compressed draft must preserve logical image dimensions, markers, categories, notes, completion state, and adjustments.

## 5. Export requirements

### Read-only viewer HTML

- One self-contained HTML file.
- Optional WebP compression for embedded viewer images with adjustable quality.
- Read-only presentation optimized for reviewing results, not editing.
- Project total, image count, completed image count, needs-review count, and per-type totals at the top.
- Image thumbnails and image navigation.
- Structured current-image information: filename, captured time and its source, image dimensions, original format/size, completion status, count, and needs-review count.
- A visually separate Comment card with a comment icon and the image note.
- Previous/Next controls, thumbnails, and Left/Right arrow-key navigation without unexpected vertical page jumps.
- Global marker and number visibility controls.
- Per-type visibility controls.
- Marker numbering remains per type.
- Display image corrections and point/rectangle markers, including needs-review badges.
- Download the current annotated image as JPEG. Show a confirmation dialog before the download starts.
- Download `markers.csv`, `summary.csv`, and all annotated JPEG images as one ZIP. Show a confirmation dialog before the download starts.
- Embed sufficient project JSON so the viewer HTML can be imported by the main app to continue editing.

### CSV + JPEG ZIP

ZIP layout:

```text
result.zip
├─ markers.csv
├─ summary.csv
└─ images/
   ├─ 01-counted-....jpg
   ├─ 02-counted-....jpg
   └─ ...
```

`markers.csv` includes at least:

- image index / id / name / completion / note
- captured timestamp and capture-time source (`image_captured_at`, `capture_time_source`)
- original image width / height
- brightness / contrast / grayscale / rotation
- marker id
- marker shape (`point` / `rect`)
- needs-review boolean (`needs_review`)
- global number within the image
- number within the marker type
- category name / id
- normalized x/y and normalized rectangle width/height
- pixel x/y and rectangle width/height

`summary.csv` contains per-image, per-type, and project-level counts plus `review_count`.

## 6. UI / UX requirements

- Smartphone usage is a first-class workflow, not a reduced desktop layout.
- Mobile must avoid horizontal page scrolling at 390 px and remain usable from 320 px upward.
- Mobile top controls clearly show **Point / Rectangle / Move**.
- The canvas includes a low-profile translucent type-switching dock along its lower edge, showing type color/name/count and allowing one-tap switching without leaving the image. The dock can be minimized to a small corner control when it covers something that must be counted.
- On smartphone widths, the old duplicate type-switching area below the canvas is hidden; type management remains available from the canvas `+` button and the fixed bottom bar.
- Type switching is one tap.
- Mobile fixed bottom controls prioritize **Undo / Redo / Add image / Add or manage type / Export**.
- Undo/Redo must be easy to reach on both desktop and mobile.
- The complete-image control sits around the upper-right of the canvas.
- Needs-review state must be visible in the marker, image list/current-image status, and project summary without turning it into a separate marker type.
- Advanced display settings remain discoverable but do not dominate the counting workflow.
- Destructive actions use confirmation where data loss is meaningful; single-marker deletion is immediately undoable.
- Keyboard focus is visible and motion respects `prefers-reduced-motion`.

## 7. Privacy and network

- No upload server.
- No account.
- No analytics or telemetry.
- No runtime CDN or remote font.
- CSP includes `connect-src 'none'`.
- Camera input is handled locally by browser media APIs.

## 8. Browser target

Current stable desktop and mobile Chromium, Safari, and Firefox where the used browser APIs are available. Live camera behavior depends on browser permission and secure-context requirements; device camera/file fallback remains available.

## 9. Non-goals for v1.0.0

- Automatic / AI object detection.
- OCR-based counting.
- Cloud collaboration or shared server projects.
- XLSX export (planned for a later version).
- Automatic duplicate-marker detection.

## 10. Acceptance criteria

- `src/index.template.html` contains each build placeholder exactly once.
- `build-standalone.bat` / `build-standalone.ps1` can generate the normal and self-extracting builds on the template's supported Windows environment.
- `dist/index.html` contains no unresolved build placeholders or external runtime URLs.
- CSP blocks runtime network access.
- Self-extract payload restores `dist/index.html` byte-for-byte.
- Point marker add/select/move/delete works.
- Rectangle add/select/move/resize/delete works.
- A new marker does not show editing controls until selected later.
- Per-type numbering and category switching work.
- Multi-image totals, needs-review totals, and completion state work.
- Needs-review can be toggled on both point and rectangle markers; completion is blocked until current-image review flags are cleared.
- Camera capture presents a review before image acceptance.
- Draft size/compression controls work when IndexedDB storage is available.
- Image corrections persist into viewer/export data.
- App ZIP and viewer ZIP contain CSV + JPEG images with needs-review flags preserved in CSV and annotated images.
- Viewer can download current JPEG and ZIP.
- Viewer HTML can be imported back into the main app with images and marker data intact.
- At 390 px viewport width, the application has no page-level horizontal overflow; the canvas type dock and mobile bottom bar remain usable.


## UI / UX layout notes

- PC side panel order: Project → combined current image/project summary → Marker display → collapsed Work data.
- Redundant progress and persistent display-correction cards are not shown in the side panel; completion is visible on the canvas and thumbnails, and correction is opened from the canvas toolbar.
- Image notes open without shifting the page layout and auto-save while typing. The memo icon sits beside Complete at the upper-right of the canvas. On desktop the memo floats at the lower-right of the canvas and its header can be dragged to reposition it within the canvas area; on mobile it opens directly below the canvas. A note indicator remains visible when content exists.
- Image deletion is a direct current-image header action, is disabled for the last remaining image, and always uses the existing confirmation dialog.

- Persistent canvas instruction bubbles are not shown during normal counting.
