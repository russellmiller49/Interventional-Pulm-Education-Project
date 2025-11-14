## In-development routes

This folder keeps the original `tools`, `make`, `training`, and `community` routes outside of the
Next.js `app/` directory so they can continue to evolve without being deployed. When a section is
ready for release, move it back into `src/app` (or the appropriate feature folder) and restore any
navigation links.

Nothing inside this directory is imported at runtime.
