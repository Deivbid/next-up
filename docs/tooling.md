# Development tools

The UI was developed with project-local Taste, image-to-code, Vercel Web Interface Guidelines, Playwright and shadcn skills, plus a community Awesome DESIGN.md reference. Those optional development bundles and generated concept images stay local and are excluded from Git; they are not required to build or run the app. The implemented design is described in [DESIGN.md](../design/DESIGN.md).

Runtime and test versions are pinned in `package-lock.json`. `.npmrc` selects the public registry and a project-local cache. See [development setup](development.md) to bypass an existing private npm configuration. Browser binaries, Wrangler state/logs and test artifacts stay in ignored local folders. No runtime analytics are configured.

To remove a local installation, stop the preview and Worker, then delete the checkout. Browser data is separate: export a backup before clearing this site's IndexedDB, service worker and cache. Removing the checkout does not remove browser data or a GitHub repository.
