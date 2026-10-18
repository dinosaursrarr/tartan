# Sett: Tartan-as-a-Service — frontend starter

A React + TypeScript Vite frontend for editing and rendering TDF tartan patterns. It is intentionally implemented with native React and CSS so it can be dropped into an existing Vite/shadcn project without adding a UI component dependency.

## Integrate with an existing app

Copy `src/App.tsx`, `src/app.css`, `src/tdf.ts` and `src/vite-env.d.ts` into your app, then render `App` from your existing entry point. If you prefer a clean standalone base, this folder contains a minimal Vite setup too.

The app expects the existing server to expose these same-origin routes:

- `GET /weave?pattern=<TDF>&format=png|webp|gif`
- `GET /random?format=webp`
- `GET /catalogue.json` — a JSON array of `{ "name": string, "pattern": string }` objects

Put your catalogue JSON at `public/catalogue.json` (replace the placeholder `[]`). If your existing server already serves the catalogue from another URL, change the `fetch("/catalogue.json")` call in `src/App.tsx`.

The app uses relative endpoint URLs, so the browser expects API endpoints and the frontend to share an origin. If Vite runs separately during development, add the appropriate proxy to `vite.config.ts` for your API server, or configure the endpoint base paths in `makeEndpointUrl` and the background fetch.

## Run standalone

```sh
npm install
cp .env.example .env.local
# Edit VITE_GITHUB_REPO in .env.local to your actual repository URL.
npm run dev
```

Build with `npm run build`.

## Editor behaviour

- Colour IDs are unique lowercase `a`–`z` characters. Hex colours must be six-digit RGB values.
- Each thread is a source sequence plus an optional contiguous mirrored range. The reflected sequence is derived, not stored independently.
- Clicking a `+` slot inserts a block. Dragging a block to a slot reorders it. Dragging the edge handles resizes its run; the numeric inspector is available for exact lengths.
- Shift-click a range of blocks, then choose **Mirror selected range** to apply the parenthesised TDF section. A thread can have only one mirrored range.
- The Go parser expands `prefix + mirrored + suffix + reverse(mirrored)`. This is faithfully reflected by the visual editor.
- The code box accepts direct edits. Invalid text is kept visible, with the last valid model retained for the preview until the code parses.
- The current valid code is written to the `pattern` query parameter using `history.replaceState`.

## Things to configure before publishing

1. Replace `public/catalogue.json` with the real catalogue file.
2. Set `VITE_GITHUB_REPO` in `.env.local` or your deployment environment.
3. Replace the placeholder About copy in `src/App.tsx` with the real project story and acknowledgements.
4. Confirm the deployment serves the three routes above from the same origin and returns the correct image `Content-Type` for each format.

The frontend does not implement or change the Go rendering service.
