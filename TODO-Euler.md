# Add Euler angles as a camera-orientation display format

Implements the `* euler angles` item under the 1.0.3 milestone in [TODO.md](TODO.md).

## Goal

The result panel's "Camera orientation" section currently offers three formats via a
dropdown: Axis angle (degrees), Axis angle (radians), Quaternion. Add **Euler angles**
(degrees and radians) as two additional options, showing x/y/z rotation.

## Touch points

Four files. The reducer (`src/gui/reducers/result-display-settings.ts`) already handles
the orientation action generically, so it needs **no** change.

### 1. Enum variant — `src/gui/types/result-display-settings.ts`

Add to `OrientationFormat`:

```ts
export enum OrientationFormat {
  AxisAngleDegrees = 'AxisAngleDegrees',
  AxisAngleRadians = 'AxisAngleRadians',
  Quaterion = 'Quaterion',
  EulerAnglesDegrees = 'EulerAnglesDegrees',
  EulerAnglesRadians = 'EulerAnglesRadians'
}
```

Two entries so degrees/radians work the same way axis-angle already does. String enum is
persisted verbatim into `.fspy` project files and app state; old files fall back to the
default on load, so no migration is needed.

### 2. Math — `src/gui/solver/math-util.ts`

Add `matrixToEulerAngles` next to `matrixToQuaternion` / `matrixToAxisAngle`. Returns a
3-tuple `[x, y, z]` in radians. Extract Tait-Bryan angles for R = Rx(x)·Ry(y)·Rz(z)
(three.js "XYZ" order):

```ts
static matrixToEulerAngles(transform: Transform): [number, number, number] {
  const m00 = transform.matrix[0][0]
  const m01 = transform.matrix[0][1]
  const m02 = transform.matrix[0][2]
  const m11 = transform.matrix[1][1]
  const m12 = transform.matrix[1][2]
  const m21 = transform.matrix[2][1]
  const m22 = transform.matrix[2][2]

  const y = Math.asin(Math.max(-1, Math.min(1, m02)))
  let x: number
  let z: number
  if (Math.abs(m02) < 0.9999999) {
    x = Math.atan2(-m12, m22)
    z = Math.atan2(-m01, m00)
  } else {
    // gimbal lock: y ~= +-90 deg, x and z are coupled; pin z = 0
    x = Math.atan2(m21, m11)
    z = 0
  }
  return [x, y, z]
}
```

### 3. Dropdown + rows — `src/gui/components/result-panel/result-panel.tsx`

`renderOrientationSection` currently assumes a 4-component result (axis-angle/quaternion).
Euler is 3-component, so rework the branching:

```tsx
const displayFormat = this.props.resultDisplaySettings.orientationFormat
const cameraTransform = this.props.solverResult.cameraParameters.cameraTransform

const isEuler = displayFormat == OrientationFormat.EulerAnglesDegrees ||
                displayFormat == OrientationFormat.EulerAnglesRadians
const isQuaternion = displayFormat == OrientationFormat.Quaterion

let components: number[]
if (isEuler) {
  components = MathUtil.matrixToEulerAngles(cameraTransform)
  if (displayFormat == OrientationFormat.EulerAnglesDegrees) {
    components = components.map(c => 180 * c / Math.PI)
  }
} else if (isQuaternion) {
  components = MathUtil.matrixToQuaternion(cameraTransform)
} else {
  components = MathUtil.matrixToAxisAngle(cameraTransform)
  if (displayFormat == OrientationFormat.AxisAngleDegrees) {
    components[3] = 180 * components[3] / Math.PI
  }
}
```

Add the two dropdown options:

```tsx
{ id: OrientationFormat.EulerAnglesDegrees, title: 'Euler angles (degrees)', value: OrientationFormat.EulerAnglesDegrees },
{ id: OrientationFormat.EulerAnglesRadians, title: 'Euler angles (radians)', value: OrientationFormat.EulerAnglesRadians }
```

Make the rows conditional so Euler shows only x/y/z (no 4th row), and mark the `z` row
`isLastRow` when `isEuler` so the panel's bottom-border styling stays correct:

```tsx
{/* x, y, z rows; give z isLastRow={isEuler} */}
{ !isEuler &&
  <TableRow isLastRow={true} title={isQuaternion ? 'w' : 'Angle'} value={components[3]} />
}
```

### 4. Tests — `matrixToEulerAngles` unit tests

Lock in: identity -> `[0,0,0]`; pure 90 deg rotation about each axis; and a round-trip
(build R from known angles, extract, compare) to guard the gimbal-lock branch.

## Open decision (resolve before implementing)

**Rotation order + handedness.** Sketch uses three.js "XYZ", which matches Blender's
default Euler order (fSpy's primary target). But fSpy exports a full transform matrix with
its own coordinate convention (y-up, right-handed), so validate the extracted angles with a
**Blender round-trip on a real solve** before shipping, rather than trusting the formula in
isolation. If they don't match, revisit the rotation order / axis sign in
`matrixToEulerAngles`.
