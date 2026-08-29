# Offline Verification

1. Run `build-standalone.bat`.
2. Open `dist/index.html` and `dist/index.self-extract.html` directly.
3. Open browser developer tools and clear the Network panel.
4. Enable offline mode or disconnect the device.
5. Reload the local HTML.
6. Exercise every core input, editing, preview, worker, and export flow.
7. Confirm there is no failed external resource request and no console error.
8. Change the suggested output filename, export, and confirm both the filename and file contents are correct.
9. If the app can replace its primary input while processing, change the input mid-process and confirm no stale result from the old input appears.
10. Confirm output files still open correctly.

For GitHub Pages, one initial request downloads the HTML. Clear the Network panel after the page has loaded, then test the complete app flow.


## Self-extracting variant

Open `dist/index.self-extract.html` directly, confirm that the loading screen text is readable, the same favicon as `dist/index.html` is visible, and the loading screen disappears. Repeat the same offline checks and verify that the browser console contains no decompression or CSP errors. `scripts/verify-self-extract.ps1` also enforces an ASCII-only loader and byte-for-byte restoration of the readable HTML.
