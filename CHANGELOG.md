# Changelog

## 1.0.3 - 2026-10-10

- Keep type-name inputs and Hide/Show buttons in place so name commits preserve natural Tab navigation and visibility toggles retain keyboard focus. Add handler-level focus, normalization, ownership, and data/history regressions to the four-artifact check matrix.
- After a desktop/mobile layout change, closing Types or Export can return focus to its visible paired launcher when native restoration is offscreen or remains in the closed dialog/BODY. Preserve newer focus/modal ownership and normal browser Tab stops.
- Keep the language switch and Help available at narrow widths, reserving room for header actions and the version badge.
- Lock background scrolling only while modal Help is open.
- Ignore bubbled child clicks before checking dialog backdrop coordinates so keyboard activation of Build info no longer dismisses Help.
- Add Help/header handler and CSS-contract regressions to the source/readable/root-alias/self-extract check matrix.

## 1.0.2 - 2026-10-09

- Normalize brand icon backgrounds to #16624f with exact 25% corner radii across SVG assets, header icons, and embedded favicons, preserving existing artwork.
- Add focused brand representation regression checks.

## 1.0.1 — 2026-10-06

- Localize accessible control names, tooltips, confirmation buttons, camera preview text, and dynamic type-management controls when switching Japanese/English.
- Dismiss obsolete previous-work offers after a new workspace is accepted, localize the draft summary on language changes, and preserve recovery after cancelled or failed imports.
- Stage viewer imports before replacing the active project and reject late draft reads/imports after newer work is accepted.
- Add language and restore-ownership regressions to the source/readable/root-alias/self-extract verification matrix.

## Previously unreleased

- Add a session-only **Include annotated JPEGs** option to editor ZIP export. The default preserves CSV + JPEG output; clearing it saves the same two CSV files without processing images.
- Discard cancelled point/rectangle creation and restore moved/resized geometry and completion without changing history, redo, or autosave. Switching to pinch discards unfinished marker edits, and extra/late pointer events cannot commit them.
- Add synthetic CSV/ZIP integrity and cancellation regressions across all four app artifacts while retaining camera lifecycle and byte-parity checks.

- Keep the tracked `image-counter.html` release alias synchronized with the readable build. CI rejects stale aliases and exercises camera lifecycle regressions against source, both release formats, and the root alias.

- Stop camera tracks after cancelled or superseded starts, failed playback, and page exit. Late permission results cannot restart capture in a closed dialog.

## 1.0.0 — 2026-08-29

Initial Browser Kitty release of Image Counter.

### Counting and editing

- Added manual point-marker counting and drag-to-count rectangle markers.
- Added marker movement, rectangle four-corner resize, type changes, deletion, Undo / Redo, and a brief highlight for the most recently added marker.
- Marker editing controls appear only after an existing marker is explicitly selected; they do not interrupt continuous counting immediately after placement.
- Marker numbers restart from `1` for each counting type while image and project totals are tracked separately.
- Added independent **Needs review** flags for point and rectangle markers with an amber `!` badge. Review flags do not change the marker type or count.
- Prevented completing an image while unresolved review markers remain.

### Types and visibility

- Added multiple counting types with editable names, colors, and per-type visibility.
- Added a translucent type-switching dock directly on the canvas, including a compact/minimized state when the dock covers an object.
- Added desktop numeric shortcuts `1`–`9` for fast type switching.
- Added global marker visibility, number visibility, marker size, and opacity controls.

### Images and workflow

- Added multi-image projects with thumbnails, per-image counts, completion state, **Next incomplete**, and `←` / `→` keyboard navigation.
- Added project-wide totals, completed-image counts, needs-review counts, and per-type summaries.
- Added non-destructive brightness, contrast, grayscale, and 90° rotation adjustments while keeping the image visible during adjustment.
- Added live camera capture with post-capture review, retake, accept, and accept-and-continue flows, plus device camera/file fallback.
- Added image notes from the memo icon beside **Complete**. On desktop the memo floats over the canvas and can be dragged within it; on mobile it opens below the canvas.
- Added current-image deletion as a visible header action with a confirmation dialog; the last remaining image cannot be deleted.
- Added optional counting guide support as a secondary feature.

### Capture time and metadata

- Added JPEG EXIF capture-time reading with file timestamp fallback.
- Photos taken through the in-app camera retain the actual capture time.
- Added captured-time source metadata so the viewer and CSV output can distinguish EXIF, file timestamp, and camera capture time.

### Local persistence

- Added IndexedDB draft autosave.
- Added current project size, saved-draft size, and available-storage display when supported by the browser.
- Added optional WebP compression for autosaved image copies with adjustable quality.

### Export and read-only viewer

- Added a read-only, self-contained Viewer HTML designed for reviewing and sharing results rather than editing them directly.
- Added optional WebP compression for images embedded in Viewer HTML.
- Added project/image summaries, thumbnails, `Previous` / `Next` / `←` / `→` navigation, marker/number/type visibility controls, and structured image information.
- Added a dedicated **Comment** card above image notes in the viewer.
- Added filename, capture time/source, dimensions, original format/size, completion state, count, and needs-review count to viewer image information.
- Added confirmation dialogs before viewer-side JPEG and CSV + all-images ZIP downloads.
- Added viewer-side current annotated JPEG download and CSV + all annotated JPEG ZIP download.
- Added Viewer HTML re-import into Image Counter to resume editing.
- Added `markers.csv` and `summary.csv` with image metadata, capture time/source, display corrections, marker shape, review flags, per-type numbering, normalized/pixel coordinates, rectangle dimensions, and project-level summaries.
- Standardized annotated image ZIP output on JPEG.

### UI / UX

- Reorganized the desktop side panel into compact **Project**, **Summary**, **Marker display**, and collapsed **Work data** sections.
- Removed redundant persistent progress and correction panels; completion stays visible on the canvas/thumbnails and display correction opens only when needed.
- Kept Point / Rectangle / Move in one row on desktop and smartphone layouts.
- Kept Undo / Redo easy to reach, with persistent smartphone bottom actions for Undo / Redo / Add image / Types / Export.
- Removed persistent canvas instruction bubbles after the workflow became self-explanatory.
- Added Japanese and English UI in the same HTML and updated browser titles when switching languages.
- Added a custom SVG app icon showing a photo, tap target, and upright index finger.

### Build and privacy

- Based the repository on the Browser Kitty `htmlapps-template` structure.
- Kept the runtime dependency-free using browser APIs, Canvas, IndexedDB, and Pointer Events.
- Kept runtime networking blocked by Content Security Policy with `connect-src 'none'`.
- Added readable `dist/index.html` and gzip self-extracting `dist/index.self-extract.html` release variants.
