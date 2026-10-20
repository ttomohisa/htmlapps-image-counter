# Security Policy

## Supported version

Security fixes target the latest version on the default branch.

## Reporting a vulnerability

Do not publish sensitive vulnerability details in a public issue. Use the repository owner's private security reporting channel when available.

Include:

- Affected commit or version.
- Reproduction steps.
- Expected and actual behavior.
- Security impact.
- A minimal test file when file parsing is involved.

## Trust model

The default template is a static browser application with no backend. Its primary protections are:

- No runtime network connection (`connect-src 'none'`).
- Explicitly pinned and embedded third-party files.
- SHA-256 records in the generated dependency manifest.
- No analytics, telemetry, remote fonts, or silent update checks.
- User-initiated downloads rather than automatic uploads.

A generated HTML file is executable code. Distribute it through a trusted channel and verify hashes for high-trust workflows.

## Input files

Applications created from this template may parse untrusted local files. Implementations should:

- Validate type, size, and structure before expensive processing.
- Avoid unbounded allocation or recursion.
- Handle malformed data without exposing stack traces to users.
- Release Blob URLs, workers, canvas resources, and large buffers.
- Make destructive transformations reversible where practical.
- Never upload a selected file unless the product explicitly requires it and the user is clearly informed.

## Dependency review

Before adding or upgrading a package:

- Confirm the package identity and exact version.
- Review its license and required notices.
- Inspect the browser bundle and package scripts.
- Confirm every runtime support asset is embedded.
- Rebuild with a clean cache.
- Test with the network disabled.

Camera lifecycle: closing the dialog, superseding a start, or leaving the page invalidates pending acquisitions. Acquired tracks are stopped on cancellation or playback failure.

## Viewer import and CSV boundaries

- External viewer imports require `app: "image-counter"` and `schemaVersion: 4`. Repository history back to initial commit `3c33ad3` uses version 4. Local unversioned drafts retain optional field defaults, including point shape and review flags; explicit unknown app/schema identifiers are rejected.
- Import checks file size before reading (661 MiB: three times the 220 MiB project budget, plus 1 MiB for the viewer shell). The multiplier allows worst-case JSON escaping without imposing a smaller effective image budget. HTML is not inserted into a DOM or executed: only the uniquely identified `application/json` project script is extracted.
- Validation requires 1–30 images, typed records, nonempty unique IDs (marker IDs project-wide), existing category references, finite normalized coordinates, positive bounded rectangles, finite settings/timestamps, and positive safe-integer logical dimensions. Logical dimensions may differ from compressed image dimensions intentionally.
- Image data must be base64-embedded PNG, JPEG, WebP, GIF, BMP, AVIF, or ICO with a matching file signature. External URLs, SVG, malformed base64 and other formats are rejected. Browser decoding remains the final codec check; signature validation alone does not prove a complete image is decodable. Initial-image decoding is staged before accepting the project. Supported codecs and practical memory limits still depend on the browser.
- Each embedded image is limited to 35 MiB of actual decoded payload, irrespective of claimed metadata. The 220 MiB total includes actual payload bytes and twice the serialized metadata character count (including unknown fields, excluding payload strings). There is no extra per-note, category, or marker-count cap; these share that aggregate budget. A previously exported project that grew beyond these limits, or contained SVG, must be reduced/converted before re-import. SVG-based legacy drafts are also rejected instead of restoring active content.
- Validation failure leaves the current project and previous-work offer intact. Project values are copied only after validation; import never repairs duplicate IDs; the narrowly recognized native minimum-size edge case described below is normalized.
- Both editor and generated viewer CSV serializers prefix formula-like string cells with an ASCII apostrophe before CSV quote escaping. This covers `=`, `+`, `-`, `@` following leading whitespace/control characters, and strings beginning with tab, CR, or LF. Numeric values remain numeric. Filename, note, category and imported-ID columns use this policy; source project values are not modified. CSV has no portable cell-type metadata: an apostrophe may remain visible in applications that do not treat it as a text marker. Do not remove the prefix or re-save untrusted cells as formulas; this is not a guarantee against every spreadsheet application's subsequent conversion behavior.

Compatibility exception: the former native resize handler could create an exact 0.003-wide/high rectangle extending past the right/bottom image edge by at most 0.003. Import/restore moves only that affected origin inward, retaining its minimum size. Out-of-range origins and other oversized rectangles still fail validation. New resizes keep the minimum rectangle fully inside the image.
