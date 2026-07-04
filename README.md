## What is this?

fSpy is an open source, cross platform app for still image camera matching. See [fspy.io](https://fspy.io) for more info. The source code is available under the GPL license.

![fSpy screenshot](screenshot.jpg)

## Backstory

Once upon a time I wrote BLAM, a [Blender](https://blender.org) add-on for still image camera calibration that, despite its clunky UI, has gained some popularity in the Blender community. fSpy is an attempt to bring BLAM's functionality to a wider audience in the form of a stand alone app.

## Using the computed camera parameters in other applications

In theory, camera parameters computed by fSpy could be used in any application that has a notion of a 3D camera and provides some way of setting the camera parameters. If you're a Blender user, have a look at the [offical fSpy importer add-on](https://github.com/stuffmatic/fSpy-Blender). If you're using an application without a dedicated importer, you may still be able to manually copy the camera parameters from fSpy.

Interested in writing an importer for your favorite application? Then the [fSpy project file format spec](https://github.com/stuffmatic/fSpy/blob/develop/project_file_format.md) is a good starting point.


## Building and running

The following instructions are for developers. If you just want to run the app, [download the latest executable for your platform](https://github.com/stuffmatic/fSpy/releases).

fSpy is written in [Typescript](https://www.typescriptlang.org) using [Electron](https://electronjs.org), [React](https://reactjs.org) and [Redux](https://redux.js.org). [Visual Studio Code](https://code.visualstudio.com) is recommended for a pleasant editing experience.

To install necessary dependencies, run

```
npm install
```

The `src` folder contains three subfolders: `main` and `gui`, containing code for the [Electron main and renderer processes](https://electronjs.org/docs/tutorial/application-architecture) respectively, and `cli`, which contains a command-line interface for processing fSpy project files without the GUI. The main process includes a preload script (`src/main/preload.ts`) that bridges the renderer and main processes via IPC.

To run the app in development mode, run

```
npm start
```

This builds the main, preload, and GUI code, starts the webpack dev server, and launches Electron once the dev server is ready. Changes to GUI (renderer) code reload automatically.

⚠️ The build process lacks live reloading on main process code changes. Changes to `src/main` code require restarting `npm start` in order to show up in the app.


## Creating binaries for distribution

Executables are produced by [Electron builder](https://github.com/electron-userland/electron-builder). Each `dist-*` script first runs a clean production build (`build-dist`) and then packages the app.

To build for all platforms at once, run

```
npm run dist
```

or build a single platform with `npm run dist-mac`, `npm run dist-win` or `npm run dist-linux`.

⚠️ Cross-compiling from a single machine is unreliable. Packaging for macOS requires running on macOS, the Windows `nsis` target needs Wine, and the Linux `AppImage` target typically needs Docker/Linux. In practice, the all-platform `npm run dist` and `npm run publish-release` are meant to run on matching per-OS CI runners; locally, build only for the platform you are on. `npm run dist-mac` skips code signing, so it works on any Mac without a signing certificate.


## npm scripts reference

All available scripts and when to use them:

### Development

| Script | Description |
| --- | --- |
| `npm start` | Builds the app, starts the webpack dev server and launches Electron. Renderer (GUI) changes reload automatically; changes to `src/main` require a restart. This is the main development command. |
| `npm test` | Runs the [Jest](https://jestjs.io) test suite. |

### Building

| Script | Description |
| --- | --- |
| `npm run build-dev` | Cleans `build/` and produces a development webpack bundle. Called by `npm start`; rarely run directly. |
| `npm run build-dist` | Cleans `build/` and produces a production webpack bundle. Called automatically by every `dist-*` and `publish-release` script. |

### Packaging (distribution)

| Script | Description |
| --- | --- |
| `npm run dist-preview` | Produces an unpacked build (`electron-builder --dir`) for a quick local smoke test — faster than a full installer. |
| `npm run dist` | Packages installers for macOS, Windows and Linux (`-mwl`). See the cross-compiling caveat above. |
| `npm run dist-mac` | Packages a macOS build only, skipping code signing (works without a signing certificate). |
| `npm run dist-win` | Packages a Windows build only. |
| `npm run dist-linux` | Packages a Linux build only. |

### Publishing

| Script | Description |
| --- | --- |
| `npm run publish-release` | Builds and publishes installers for all platforms to GitHub Releases (`electron-builder --publish always`). Intended to run from CI on per-OS runners. |

The internal helper scripts `dev-server` and `electron-dev` are invoked by `npm start` and are not normally run on their own.
