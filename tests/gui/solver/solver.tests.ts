/// <reference types="jest" />
/**
 * Regression tests for the core camera solver.
 *
 * The solver itself (src/gui/solver/solver.ts) is the heart of the app and had
 * no direct coverage. These tests drive it end-to-end against every real
 * project file in test_data/ and pin its numeric output, so a dependency bump
 * (React/TS/etc.) or an accidental algorithm change that shifts the results is
 * caught immediately.
 *
 * The solver needs the source image dimensions. Those are not stored in the
 * project file's state JSON (they're decoded from the embedded image at load
 * time in the app), so we read them straight from the embedded JPEG/PNG header.
 */
import * as fs from 'fs'
import * as path from 'path'
import Solver from '../../../src/gui/solver/solver'
import { SolverResult } from '../../../src/gui/solver/solver-result'
import { CalibrationMode } from '../../../src/gui/types/global-settings'
import { ImageState } from '../../../src/gui/types/image-state'

const TEST_DATA_DIR = path.resolve(__dirname, '../../../test_data')
const HEADER_SIZE = 16

interface ImageDimensions {
  width: number
  height: number
}

interface LoadedProject {
  state: any
  imageWidth: number
  imageHeight: number
}

/** Read width/height from a PNG IHDR chunk (big-endian uint32 at offsets 16/20). */
function pngDimensions(image: Uint8Array): ImageDimensions {
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength)
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) }
}

/** Scan JPEG markers for the start-of-frame segment and read its dimensions. */
function jpegDimensions(image: Uint8Array): ImageDimensions {
  let offset = 2 // skip SOI (0xFFD8)
  while (offset < image.length) {
    if (image[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = image[offset + 1]
    offset += 2
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue
    }
    const segmentLength = (image[offset] << 8) | image[offset + 1]
    // Start-of-frame markers (0xC0-0xCF) except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (image[offset + 3] << 8) | image[offset + 4]
      const width = (image[offset + 5] << 8) | image[offset + 6]
      return { width, height }
    }
    offset += segmentLength
  }
  throw new Error('No JPEG start-of-frame marker found')
}

function imageDimensions(image: Uint8Array): ImageDimensions {
  const isPng = image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47
  return isPng ? pngDimensions(image) : jpegDimensions(image)
}

function loadProject(filename: string): LoadedProject {
  const buffer = fs.readFileSync(path.join(TEST_DATA_DIR, filename))
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const stateSize = view.getUint32(8, true)
  const state = JSON.parse(new TextDecoder().decode(buffer.slice(HEADER_SIZE, HEADER_SIZE + stateSize)))
  const image = buffer.slice(HEADER_SIZE + stateSize)
  const { width, height } = imageDimensions(image)
  return { state, imageWidth: width, imageHeight: height }
}

function runSolver(project: LoadedProject): SolverResult {
  const image: ImageState = {
    width: project.imageWidth,
    height: project.imageHeight,
    url: null,
    data: null
  }
  const state = project.state
  const is1VPMode = state.globalSettings.calibrationMode === CalibrationMode.OneVanishingPoint
  return is1VPMode
    ? Solver.solve1VP(
      state.calibrationSettingsBase,
      state.calibrationSettings1VP,
      state.controlPointsStateBase,
      state.controlPointsState1VP,
      image
    )
    : Solver.solve2VP(
      state.calibrationSettingsBase,
      state.calibrationSettings2VP,
      state.controlPointsStateBase,
      state.controlPointsState2VP,
      image
    )
}

/** Deep-copy, rounding every number to a fixed precision so snapshots aren't
 *  brittle against sub-epsilon floating point noise. */
function roundDeep(value: unknown, decimals = 6): unknown {
  if (typeof value === 'number') {
    if (!isFinite(value)) {
      return value
    }
    const rounded = Number(value.toFixed(decimals))
    return rounded === 0 ? 0 : rounded // normalize -0
  }
  if (Array.isArray(value)) {
    return value.map((v) => roundDeep(v, decimals))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = roundDeep((value as Record<string, unknown>)[key], decimals)
    }
    return out
  }
  return value
}

const projectFiles = fs.readdirSync(TEST_DATA_DIR).filter((f) => f.endsWith('.fspy')).sort()

describe('Solver', () => {
  describe('image dimension extraction', () => {
    test.each(projectFiles)('reads plausible image dimensions from %s', (filename) => {
      const { imageWidth, imageHeight } = loadProject(filename)
      expect(imageWidth).toBeGreaterThan(0)
      expect(imageHeight).toBeGreaterThan(0)
    })
  })

  describe('output is stable (snapshot regression)', () => {
    test.each(projectFiles)('%s produces stable solver output', (filename) => {
      const result = runSolver(loadProject(filename))
      expect(roundDeep(result)).toMatchSnapshot()
    })
  })

  describe('reproduces persisted camera parameters', () => {
    // Some project files store the solved cameraParameters. Re-running the
    // solver on their inputs must reproduce those saved values, which is a true
    // golden check independent of the snapshots above.
    const filesWithSavedResult = projectFiles.filter((f) => loadProject(f).state.cameraParameters)

    // Guard the assumption that at least one such file exists, so this block
    // can't silently become a no-op.
    test('at least one test file has a persisted result', () => {
      expect(filesWithSavedResult.length).toBeGreaterThan(0)
    })

    test.each(filesWithSavedResult)('%s matches saved camera parameters', (filename) => {
      const project = loadProject(filename)
      const expected = project.state.cameraParameters
      const result = runSolver(project)

      expect(result.errors).toEqual([])
      expect(result.cameraParameters).toBeTruthy()
      const actual = result.cameraParameters!

      const TOLERANCE = 1e-6
      expect(actual.imageWidth).toBe(expected.imageWidth)
      expect(actual.imageHeight).toBe(expected.imageHeight)
      expect(actual.horizontalFieldOfView).toBeCloseTo(expected.horizontalFieldOfView, 6)
      expect(actual.verticalFieldOfView).toBeCloseTo(expected.verticalFieldOfView, 6)
      expect(actual.relativeFocalLength).toBeCloseTo(expected.relativeFocalLength, 6)
      expect(actual.principalPoint.x).toBeCloseTo(expected.principalPoint.x, 6)
      expect(actual.principalPoint.y).toBeCloseTo(expected.principalPoint.y, 6)

      // The camera transform matrix is what everything downstream (Blender
      // export etc.) depends on, so verify it element by element.
      const actualRows = (actual.cameraTransform as unknown as { rows: number[][] }).rows
      const expectedRows = (expected.cameraTransform as { rows: number[][] }).rows
      for (let i = 0; i < expectedRows.length; i++) {
        for (let j = 0; j < expectedRows[i].length; j++) {
          expect(Math.abs(actualRows[i][j] - expectedRows[i][j])).toBeLessThan(TOLERANCE)
        }
      }
    })
  })
})
