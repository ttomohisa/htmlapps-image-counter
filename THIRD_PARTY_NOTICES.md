# Third-Party Notices

Image Counter v1.0.0 does not bundle any third-party runtime library code.

The application is implemented with browser APIs and system fonts only. Runtime network access is disabled by the application's Content Security Policy (`connect-src 'none'`).

The repository includes GitHub Actions workflow files inherited from the Browser Kitty HTML app template. Those workflows reference GitHub-maintained actions under the terms published by their respective projects.

If a dependency is added in the future, update `dependencies.json` and this notice with the exact version, license, homepage, and any copyright or redistribution notices required by that dependency.
