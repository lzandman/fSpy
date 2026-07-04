# Dependency modernization

Reduce the `npm outdated` list. Ordered by value-for-effort. `npm audit` currently
reports 0 vulnerabilities, so none of this is security-blocking — it's staying current
and unblocking future upgrades.

Snapshot of `npm outdated` (as of 2026-07-04):

| Package | Current | Latest | Group |
| --- | --- | --- | --- |
| ~~cross-env~~ | ~~7.0.3~~ | 10.1.0 | ✅ #1 done |
| ~~electron~~ | ~~42.6.0~~ | 43.0.0 | ✅ #1 done |
| ~~jest / @types/jest~~ | ~~29.x~~ | 30.x | ✅ #1 done |
| ~~eslint~~ | ~~8.57.1~~ | 10.6.0 | ✅ #2 done |
| ~~@typescript-eslint/{eslint-plugin,parser}~~ | ~~7.18.0~~ | 8.62.1 | ✅ #2 done |
| typescript | 5.9.3 | 6.0.3 | #3 typescript 6 |
| react / react-dom | 18.3.1 | 19.2.7 | #4 react 19 |
| @types/react / @types/react-dom | 18.x | 19.x | #4 react 19 |
| react-konva | 18.2.16 | 19.2.5 | #4 react 19 |
| konva | 9.3.22 | 10.3.0 | #4 react 19 |
| vite | 7.3.6 | 8.1.3 | **blocked** (see bottom) |
| @vitejs/plugin-react | 5.2.0 | 6.0.3 | **blocked** (see bottom) |

Do the groups in order; each is independently shippable. Verify every group with:
`npm ci && npx tsc --noEmit && npm test && npm start` (dev + HMR) and
`npm run dist-preview` (packaged app launches and loads the renderer).

## 1. ✅ DONE — Quick wins (cross-env 10, electron 43, jest 30)

Three unrelated single-package majors, bumped together:

* **cross-env 7 → 10** — `npm i -D cross-env@10`. `npm start` and `npm run dist-mac`
  still set env vars.
* **electron 42 → 43** — `npm i -D electron@43`. Node ≥ 22.12 requirement met (local 24).
  Packaged app launches and loads the renderer, `.fspy` file association intact in the
  built `Info.plist`.
* **jest 29 → 30 + @types/jest 29 → 30** — `npm i -D jest@30 @types/jest@30`; ts-jest
  unchanged (`29.4.11` allows `^29 || ^30`). All 175 tests pass. Jest 30 surfaced a new
  ts-jest warning (`node16` hybrid module kind wants `isolatedModules`); fixed by adding
  `"isolatedModules": true` to `tsconfig.json` (correct anyway for the Vite/esbuild
  isolated-transpile pipeline — `tsc --noEmit` stays clean).

Verified: `tsc --noEmit` clean, `npm test` (175 pass), `npm start` (dev + HMR, renderer
up), `npm run dist-preview` (packaged app launches with `example.fspy`), 0 audit vulns.

## 2. ✅ DONE — ESLint 8 → 9/10 + typescript-eslint 7 → 8 (flat config)

Coupled: ESLint 9+ requires the flat-config format, so this replaced
`.eslintrc.json` with `eslint.config.mjs` and bumped the TS plugin in the same step.
ESLint 8 was end-of-life, so this was the highest-value modernization here.

* `npm i -D eslint@10 @typescript-eslint/eslint-plugin@8 @typescript-eslint/parser@8`
  plus `typescript-eslint@8` (flat-config helper) and the flat-config companions
  `@eslint/js@10` + `globals` (neither ships transitively any more).
* Migrated `.eslintrc.json` → `eslint.config.mjs` via `tseslint.config(...)`, extending
  `js.configs.recommended` + `tseslint.configs.recommended`. `.mjs` because the package is
  CommonJS (`"type"` unset) and the helper is ESM. Ported every rule/override across; `env`
  became `languageOptions.globals` (browser+node from the `globals` pkg), `ignorePatterns`
  became a global `ignores` block. `ban-types` was removed in typescript-eslint 8 and split
  into `no-empty-object-type` / `no-unsafe-function-type` / `no-wrapper-object-types` — all
  three left off to preserve the old `ban-types: off` surface.
* The newer recommended presets added two rules that flagged real (trivial) dead code, fixed
  in source rather than suppressed: `no-useless-assignment` (5× redundant initializers
  overwritten on every path → typed bare `let` declarations) and `no-unused-expressions`
  (a stray comma operator between two `gridLines3D.push(...)` calls → two statements).
* Added a `lint` npm script (`eslint .`).
* Added `.github/workflows/ci.yml` — a `push` / `pull_request` job running
  `npm ci && npx tsc --noEmit && npm test && npx eslint .`.

* Ran `eslint . --fix` to clear the 86 pre-existing `indent` warnings (whitespace-only
  reindent across 7 files); `tsc --noEmit` + tests stay green after it.

Verified from a clean `npm ci`: `tsc --noEmit` clean, `npm test` (175 pass), `npx eslint .`
exits 0 with **no** remaining problems.

## 3. TypeScript 5.9 → 6.0

Not blocked — `ts-jest` allows `<7` and `typescript-eslint@8` allows `<6.1`, so both
tolerate TS 6.0.x. Do it *after* #2 so the new eslint stack lints the upgraded compiler.

* `npm i -D typescript@6`, then `npx tsc --noEmit` and fix any new strictness/removed-flag
  errors. Check `tsconfig.json` for options deprecated/removed in TS 6.
* Verify: typecheck clean, `npm test` green, dev + packaged build both work.

## 4. React 18 → 19 (largest — coupled ecosystem bump)

All of these move together; react-konva 19.2.x peers on `react@^19.2` and `konva@^10`:

* `react` + `react-dom` 18 → 19
* `@types/react` + `@types/react-dom` 18 → 19
* `react-konva` 18 → 19
* `konva` 9 → 10

Steps:
1. `npm i react@19 react-dom@19 react-konva@19 konva@10`
   `npm i -D @types/react@19 @types/react-dom@19`
2. Work through React 19 breaking changes: stricter `useRef` (arg now required),
   removed legacy APIs, `ReactDOM.render` → `createRoot` (verify the renderer entry
   already uses `createRoot`), and updated `@types/react` 19 typings (ref-as-prop,
   removed implicit `children`, `JSX` namespace moves). Expect the bulk of the work to be
   `tsc` type errors from the new `@types/react`.
3. Exercise the canvas-heavy GUI: react-konva 19 + konva 10 rendering, image loading,
   control-point dragging, and the redux-connected views.
* Verify: full typecheck + tests, then manually drive the app (load `example.fspy`,
  move vanishing-point handles, export) in dev and packaged builds.

## Blocked — do not attempt yet

* **vite 7 → 8 and `@vitejs/plugin-react` 5 → 6.** `electron-vite@5` pins its Vite peer
  to `^5 || ^6 || ^7`, and `@vitejs/plugin-react@6` requires `vite@^8`. Upgrading Vite now
  breaks the electron-vite build. Revisit once electron-vite ships a release that accepts
  Vite 8 (watch its releases / peerDependencies), then bump vite + plugin-react together.

## Previously completed (context)

* Migrated webpack 5 + webpack-dev-server → electron-vite 5 + Vite 7 (main/preload/renderer),
  which also cleared the old `webpack-dev-server` audit findings.
* Migrated tooling yarn → npm; removed the corrupted `yarn.lock`.
* Added GitHub Actions OS-build workflows (`build-macos`, `build-windows`, `build-all`) and
  the CodeQL scan. The per-PR lint/typecheck/test job (`ci.yml`) landed with #2.
