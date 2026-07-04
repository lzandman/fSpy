import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// electron-vite builds the three Electron targets into out/{main,preload,renderer}.
// main/preload keep Node/`dependencies` external (shipped via electron-builder's
// production node_modules); relative TS imports (CLI, solver, io) stay bundled.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/preload.ts')
      }
    }
  },
  renderer: {
    // The renderer runs with nodeIntegration disabled — a plain browser context.
    root: 'src/gui',
    // Classic JSX runtime matches the `import * as React` style and tsconfig jsx: "react",
    // avoiding noUnusedLocals errors on the React import.
    plugins: [react({ jsxRuntime: 'classic' })],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/gui/index.html')
      }
    }
  }
})
