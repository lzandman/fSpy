# Dev/build tooling modernization

Improvements to the dev/build tooling, ordered by value-for-effort. The current
setup (webpack 5 + webpack-dev-server, `npm start` orchestrated with
`concurrently` + `wait-on`) works and follows the important security practices
(`contextIsolation`, `nodeIntegration: false`, `sandbox: true`, preload bridge).
Nothing below is blocking — these are quality-of-life and modernization steps.

> **Update:** Item #3 (electron-vite migration) is **done**. It provides renderer
> Fast Refresh/HMR and automatic main-process restart out of the box, so items **#1 and
> #2 below are now obsolete** (superseded — no electronmon or react-refresh plugin needed).
> The migration also removed `webpack-dev-server`, which resolved the `npm audit` moderate
> findings (`webpack-dev-server → sockjs → uuid`); `npm audit` now reports 0 vulnerabilities.
> Only #4 (broaden CI) remains.

## 1. ~~Cheap wins (low risk, do first)~~ — obsolete, handled by #3

### Auto-restart the main process on changes (electronmon)
* Problem: editing `src/main` code currently requires restarting `npm start`; only the renderer hot-reloads.
* Steps:
  1. `npm install --save-dev electronmon`
  2. In `package.json`, change `electron-dev` to use `electronmon`:
     `cross-env DEV=true ELECTRON_RUN_AS_NODE= electronmon ./build/main.js`
  3. Regenerate main/preload `build/*.js` on change (electronmon watches the built
     files, not the TS source): either run `webpack --watch` for the main/preload
     configs alongside the dev server via `concurrently`, or keep the one-off build
     and accept a manual rebuild (electronmon then restarts Electron on the rebuilt file).
* Why: removes the manual restart loop for main-process work.
* Verify: `npm start`, edit `src/main/index.ts`, confirm Electron restarts automatically.

## 2. ~~Medium — real HMR for the renderer (React Fast Refresh)~~ — obsolete, handled by #3

* Problem: `devServer.hot: true` currently does a full page reload on GUI changes, losing React/Redux state.
* Steps:
  1. `npm install --save-dev @pmmmwh/react-refresh-webpack-plugin react-refresh`
  2. In `webpack.config.js` (renderer/`web` config only): add `new ReactRefreshWebpackPlugin()`
     to `plugins`, dev mode only (skip in `--mode production`).
  3. Keep `devServer.hot: true`.
* Why: true hot module replacement — edit a component, keep app state.
* Verify: `npm start`, change a component's JSX, confirm it updates without a full reload or state reset.

## 3. ✅ DONE — migrated webpack → electron-vite

Migrated all three build targets (main / preload / renderer) to electron-vite (v5) +
Vite 7. What was done:

* Added `electron.vite.config.ts` with `main` / `preload` / `renderer` sections
  (`externalizeDepsPlugin` for main/preload; `@vitejs/plugin-react` with the classic JSX
  runtime for the renderer to match the `import * as React` / `jsx: "react"` style).
* `src/gui/index.html` is Vite's renderer entry (added `<script type="module" src="./index.tsx">`).
* Scripts: `start` → `electron-vite dev`, `build-dist` → `electron-vite build`; packaging
  still via `electron-builder`. Removed `dev-server` / `electron-dev` / `build-dev`.
* Removed webpack, webpack-cli, webpack-dev-server, ts-loader, html-webpack-plugin,
  style-loader, css-loader, `concurrently`, `wait-on`, `rimraf`; deleted `webpack.config.js`.
* Output moved from `build/` to `out/{main,preload,renderer}` (updated `main`,
  `build.files`, `.gitignore`).
* `src/main/index.ts`: dev/prod now keyed off `app.isPackaged` (was `process.env.DEV`);
  renderer loads from `ELECTRON_RENDERER_URL` in dev / `out/renderer/index.html` when
  packaged; preload path is `../preload/preload.js`.
* Renderer needed none of webpack's `global` / `require` / `target: web` workarounds
  (browser target by default). `ELECTRON_RUN_AS_NODE` is cleared in the `start` script
  (`cross-env ELECTRON_RUN_AS_NODE=`), matching the old `electron-dev` behavior.
* `tsconfig.json` excludes `electron.vite.config.ts` from `tsc` (ESM-only imports under
  `module: node16`; electron-vite transpiles its own config via esbuild).

Verified: `npm start` (dev + HMR), `npm run build-dist`, `npm test` (175 pass),
`tsc --noEmit`, `npm run dist-preview` (packaged app launches and loads the renderer),
and `npm audit` (0 vulnerabilities).

## 4. Nice-to-have — broaden CI

Currently CI only builds the Windows installer (manual `workflow_dispatch`).

* Add a `push` / `pull_request`-triggered job running: `npm ci`, `tsc --noEmit`
  (typecheck), `npm test` (jest), and `eslint`.
* Why: catches regressions on every PR instead of only at manual build time.

## Housekeeping already done

* Migrated all tooling from yarn → npm (scripts, CI, README); removed the corrupted
  `yarn.lock`, kept `package-lock.json`.
* Fixed `npm start`: dev server on :8080 + Electron launched via `wait-on`.
* Fixed `ELECTRON_RUN_AS_NODE` crash, `global is not defined`, and `require is not defined`
  (renderer target `electron-renderer` → `web`, `output.globalObject: 'globalThis'`).