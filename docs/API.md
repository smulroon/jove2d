# jove2d API Reference

Condensed cheat sheet of every public function. Colors use 0-255 range. Functions that load resources return `null` on failure.

```ts
import jove from "jove2d";
```

---

## Core

```
run(callbacks: GameCallbacks): Promise<void>
init(flags?: number): boolean
quit(): void
getVersion(): string
setErrorHandler(handler: ((error: unknown) => void) | null): void
```

## GameCallbacks

```ts
{
  load?(): void | Promise<void>
  update?(dt: number): void
  draw?(): void
  quit?(): boolean | void          // return true to cancel quit
  focus?(hasFocus: boolean): void
  resize?(width: number, height: number): void
  keypressed?(key: string, scancode: string, isRepeat: boolean): void
  keyreleased?(key: string, scancode: string): void
  mousepressed?(x: number, y: number, button: number, isTouch: boolean): void
  mousereleased?(x: number, y: number, button: number, isTouch: boolean): void
  mousemoved?(x: number, y: number, dx: number, dy: number): void
  wheelmoved?(x: number, y: number): void
  textinput?(text: string): void
  textedited?(text: string, start: number, length: number): void
  filedropped?(path: string): void
  visible?(visible: boolean): void
  joystickadded?(joystick: Joystick): void
  joystickremoved?(joystick: Joystick): void
  joystickpressed?(joystick: Joystick, button: number): void
  joystickreleased?(joystick: Joystick, button: number): void
  joystickaxis?(joystick: Joystick, axis: number, value: number): void
  joystickhat?(joystick: Joystick, hat: number, direction: string): void
  gamepadpressed?(joystick: Joystick, button: string): void
  gamepadreleased?(joystick: Joystick, button: string): void
  gamepadaxis?(joystick: Joystick, axis: string, value: number): void
}
```

---

## jove.window

```
setMode(w: number, h: number, flags?: WindowFlags): boolean
getMode(): WindowMode
updateMode(w: number, h: number, flags?: WindowFlags): boolean
setTitle(title: string): void
getTitle(): string
setIcon(imageData: ImageData): boolean
getIcon(): ImageData | null
isOpen(): boolean
close(): void
setFullscreen(fullscreen: boolean): boolean
isFullscreen(): boolean
getDesktopDimensions(): { width, height }
getDPIScale(): number
setPosition(x: number, y: number): void
getPosition(): { x, y }
isVisible(): boolean
isMinimized(): boolean
isMaximized(): boolean
minimize(): void
maximize(): void
restore(): void
hasFocus(): boolean
hasMouseFocus(): boolean
setVSync(vsync: number): void
getVSync(): number
getDisplayCount(): number
getDisplayName(displayIndex?: number): string
getFullscreenModes(displayIndex?: number): { width, height }[]
fromPixels(x: number, y?: number): number | [number, number]
toPixels(x: number, y?: number): number | [number, number]
showMessageBox(title: string, message: string, type?: "info"|"warning"|"error", attachToWindow?: boolean): boolean
requestAttention(continuous?: boolean): void
isDisplaySleepEnabled(): boolean
setDisplaySleepEnabled(enable: boolean): void
```

### WindowFlags

```ts
{
  fullscreen?: boolean
  resizable?: boolean
  borderless?: boolean
  minwidth?: number
  minheight?: number
  highdpi?: boolean
  vsync?: number
  x?: number
  y?: number
}
```

---

## jove.graphics

### Colors & State

```
setColor(r: number, g: number, b: number, a?: number): void
getColor(): [r, g, b, a]
setBackgroundColor(r: number, g: number, b: number, a?: number): void
getBackgroundColor(): [r, g, b, a]
setBlendMode(mode: BlendModeName): void
getBlendMode(): BlendModeName
setDefaultFilter(min: FilterMode, mag?: FilterMode): void
getDefaultFilter(): [FilterMode, FilterMode]
setColorMask(r?: boolean, g?: boolean, b?: boolean, a?: boolean): void
getColorMask(): [boolean, boolean, boolean, boolean]
setLineWidth(width: number): void
getLineWidth(): number
setLineStyle(style: "rough" | "smooth"): void
getLineStyle(): "rough" | "smooth"
setLineJoin(join: "miter" | "bevel" | "none"): void
getLineJoin(): "miter" | "bevel" | "none"
setPointSize(size: number): void
getPointSize(): number
setWireframe(enable: boolean): void
isWireframe(): boolean
reset(): void
```

> BlendModeName: `"alpha"` | `"add"` | `"subtract"` | `"multiply"` | `"replace"` | `"screen"` | `"darken"` | `"lighten"`
> FilterMode: `"nearest"` | `"linear"`

### Transform Stack

```
push(): void
pop(): void
translate(dx: number, dy: number): void
rotate(angle: number): void
scale(sx: number, sy?: number): void
shear(kx: number, ky: number): void
origin(): void
applyTransform(transform: Transform): void
replaceTransform(transform: Transform): void
transformPoint(x: number, y: number): [number, number]
inverseTransformPoint(x: number, y: number): [number, number]
getStackDepth(): number
```

### Drawing Primitives

```
clear(): void
clear(r: number, g: number, b: number, a?: number): void
rectangle(mode: "fill"|"line", x, y, w, h): void
circle(mode: "fill"|"line", cx, cy, radius, segments?): void
ellipse(mode: "fill"|"line", cx, cy, rx, ry, segments?): void
arc(mode: "fill"|"line", cx, cy, radius, theta1, theta2, segments?): void
polygon(mode: "fill"|"line", ...coords: number[]): void
line(...coords: number[]): void
point(x: number, y: number): void
points(...coords: number[]): void
```

### Text

```
print(text: string, x: number, y: number): void
printf(text: string, x: number, y: number, limit?: number, align?: "left"|"center"|"right"): void
setFont(font: Font): void
getFont(): Font
newFont(path: string, size: number): Promise<Font | null>             -- async
newImageFont(imageData: ImageData, glyphs: string): Promise<Font | null>  -- async
newText(font: Font, text?: string): Text
```

### Images & Canvases

```
newImage(pathOrData: string | ImageData): Image | null
newCanvas(w: number, h: number): Canvas | null
setCanvas(canvas: Canvas | null): void
getCanvas(): Canvas | null
newQuad(x, y, w, h, sw, sh): Quad
draw(drawable, x?, y?, r?, sx?, sy?, ox?, oy?, quad?): void
screenshot(path?: string): Uint8Array | null
```

> `drawable`: Image | Canvas | ParticleSystem | Text | Video | Mesh | SpriteBatch

### Batching

```
newSpriteBatch(image: Image, maxSprites?: number): SpriteBatch
newMesh(format: VertexFormat, vertices: number[], drawMode?: DrawMode): Mesh
newParticleSystem(image: Image, maxParticles?: number): ParticleSystem | null
```

> DrawMode: `"fan"` | `"strip"` | `"triangles"` | `"points"`

### Shaders

```
newShader(fragmentCode: string): Promise<Shader | null>    -- async
setShader(shader: Shader | null): void
getShader(): Shader | null
```

### Scissor & Stencil

```
setScissor(x?, y?, w?, h?): void          -- no args to clear
getScissor(): [x, y, w, h] | null
intersectScissor(x, y, w, h): void
stencil(fn, action?, value?, keepContent?): void
setStencilTest(comparemode?, comparevalue?): void
getStencilTest(): [CompareMode, number]
```

### Queries

```
getWidth(): number
getHeight(): number
getDimensions(): [number, number]
getDPIScale(): number
getPixelWidth(): number
getPixelHeight(): number
getPixelDimensions(): [number, number]
getRendererInfo(): { name, version, vendor, device }
getStats(): { drawcalls, canvasswitches, texturememory, ... }
resetStatistics(): void
getSupported(): { ... }
getSystemLimits(): { ... }
getCanvasFormats(): { ... }
getImageFormats(): { ... }
getTextureTypes(): { ... }
isActive(): boolean
isGammaCorrect(): boolean
```

### Image

```
image.getWidth(): number
image.getHeight(): number
image.getDimensions(): [number, number]
image.setFilter(min: FilterMode, mag: FilterMode): void
image.getFilter(): [FilterMode, FilterMode]
image.setWrap(horiz: WrapMode, vert?: WrapMode): void
image.getWrap(): [WrapMode, WrapMode]
image.replacePixels(imageData, x?, y?): void
image.release(): void
```

> WrapMode: `"clamp"` | `"repeat"`

### Canvas (extends Image)

```
canvas.renderTo(fn: () => void): void
```

### Quad

```
quad.getViewport(): [x, y, w, h]
quad.setViewport(x, y, w, h): void
```

### Text

```
text.set(text: string): void
text.setf(text: string, wraplimit: number, align?: "left"|"center"|"right"): void
text.add(text: string, x?, y?): number
text.addf(text: string, wraplimit, align, x?, y?): number
text.clear(): void
text.getWidth(): number
text.getHeight(): number
text.getDimensions(): [number, number]
text.getFont(): Font
text.setFont(font: Font): void
text.release(): void
```

### SpriteBatch

```
batch.add(drawable, x, y, r?, sx?, sy?, ox?, oy?): number
batch.setColor(index, r, g, b, a?): void
batch.clear(): void
batch.flush(): void
batch.getCount(): number
batch.getBufferSize(): number
batch.setTexture(image: Image | null): void
batch.getTexture(): Image | null
batch.release(): void
```

### Mesh

```
mesh.setVertices(vertices: number[], startIndex?): void
mesh.getVertices(startIndex?, count?): number[]
mesh.setIndices(indices: number[], startIndex?): void
mesh.getIndices(startIndex?, count?): number[]
mesh.getVertexCount(): number
mesh.getIndexCount(): number
mesh.getDrawMode(): DrawMode
mesh.setDrawMode(mode: DrawMode): void
mesh.getFormat(): VertexFormat
mesh.mapVertex(vertex, fn): void
mesh.release(): void
```

---

## jove.keyboard

```
isDown(...keys: string[]): boolean
isScancodeDown(...scancodes: string[]): boolean
getKeyFromScancode(scancode: string): string
getScancodeFromKey(key: string): string
setKeyRepeat(enable: boolean): void
hasKeyRepeat(): boolean
setTextInput(enable: boolean): void
hasTextInput(): boolean
```

---

## jove.mouse

```
getPosition(): [number, number]
getX(): number
getY(): number
isDown(button: number): boolean
setPosition(x: number, y: number): void
setX(x: number): void
setY(y: number): void
setVisible(visible: boolean): void
isVisible(): boolean
setGrabbed(grabbed: boolean): void
isGrabbed(): boolean
setRelativeMode(enable: boolean): void
getRelativeMode(): boolean
isCursorSupported(): boolean
getSystemCursor(cursorType: CursorType): Cursor
setCursor(cursor?: Cursor): void
getCursor(): Cursor | null
newCursor(imageData: ImageData, hotX?, hotY?): Cursor
```

### Cursor

```
cursor.release(): void
```

---

## jove.timer

```
getDelta(): number
getFPS(): number
getAverageDelta(): number
getTime(): number
sleep(seconds: number): Promise<void>    -- async
```

---

## jove.audio

```
newSource(path: string, type?: "static"|"stream"|"queue"): Source | null
newQueueableSource(sampleRate: number, channels?: number): Source
setVolume(volume: number): void
getVolume(): number
stop(): void
```

### Source

```
source.play(): void
source.pause(): void
source.stop(): void
source.isPlaying(): boolean
source.isStopped(): boolean
source.isPaused(): boolean
source.setVolume(volume: number): void
source.getVolume(): number
source.setLooping(looping: boolean): void
source.isLooping(): boolean
source.setPitch(pitch: number): void
source.getPitch(): number
source.seek(position: number): void
source.tell(): number
source.getDuration(): number
source.clone(): Source
source.type(): "static" | "stream" | "queue"
source.release(): void
```

### QueueableSource (extends Source)

```
source.queue(soundData: SoundData, fade?: boolean): void
```

---

## jove.physics

```
newWorld(gx?: number, gy?: number): World
setMeter(m: number): void
getMeter(): number
isAvailable(): boolean
```

### World

```
world.getGravity(): [number, number]
world.setGravity(gx, gy): void
world.newBody(type: "static"|"kinematic"|"dynamic", x, y): Body
world.getBodies(): Body[]
world.getBodyCount(): number
world.destroyBody(body: Body): boolean
world.newJoint(type, bodyA, bodyB, ...params): Joint
world.getJoints(): Joint[]
world.destroyJoint(joint: Joint): boolean
world.update(dt, velocityIterations?): void
world.raycast(x1, y1, x2, y2): { point, normal, fraction, shape } | null
world.queryAABB(x, y, w, h): Fixture[]
world.getContactCount(): number
world.getContactList(): Contact[]
world.isLocked(): boolean
world.setPreSolveCallback(fn?): void
world.getPreSolveCallback(): ((contact) => void) | null
```

### Body

```
body.getType(): string
body.setType(type: string): void
body.getPosition(): [number, number]
body.setPosition(x, y): void
body.getAngle(): number
body.setAngle(angle): void
body.getLinearVelocity(): [number, number]
body.setLinearVelocity(vx, vy): void
body.getAngularVelocity(): number
body.setAngularVelocity(w): void
body.applyForce(fx, fy, x?, y?): void
body.applyLinearImpulse(ix, iy, x?, y?): void
body.applyTorque(torque): void
body.applyAngularImpulse(impulse): void
body.getFixtures(): Fixture[]
body.getFixture(index): Fixture | null
body.addFixture(shape, density?, friction?, restitution?): Fixture
body.removeFixture(fixture): boolean
body.getFixtureCount(): number
body.getMass(): number
body.getInertia(): number
body.getGravityScale(): number
body.setGravityScale(scale): void
body.isAwake(): boolean
body.setAwake(awake): void
body.getContacts(): Contact[]
body.getJoints(): Joint[]
body.getWorld(): World
body.getUserData(): any
body.setUserData(data): void
body.isDestroyed(): boolean
```

### Fixture

```
fixture.getBody(): Body
fixture.getShape(): Shape
fixture.setSensor(s: boolean): void         -- creation-time only in Box2D v3
fixture.isSensor(): boolean
fixture.setFriction(f): void
fixture.getFriction(): number
fixture.setRestitution(r): void
fixture.getRestitution(): number
fixture.setDensity(d): void
fixture.getDensity(): number
fixture.setFilterData(categories, mask, group): void
fixture.getFilterData(): [number, number, number]
fixture.setCategory(categories): void
fixture.getCategory(): number
fixture.setMask(mask): void
fixture.getMask(): number
fixture.setGroupIndex(group): void
fixture.getGroupIndex(): number
fixture.testPoint(x, y): boolean
fixture.setUserData(data): void
fixture.getUserData(): any
```

### Shape

```
shape.getType(): string
shape.getRadius(): number
shape.getPoints(): number[]
shape.getChildCount(): number
```

### Contact

```
contact.getFixtures(): [Fixture, Fixture]
contact.getNormal(): [number, number]
contact.getPositions(): [number, number]
contact.getNormalImpulse(): number
contact.setEnabled(flag: boolean): void
contact.isEnabled(): boolean
```

### Joint (base)

```
joint.getType(): string
joint.getBodyA(): Body
joint.getBodyB(): Body
joint.getAnchorA(): [number, number]
joint.getAnchorB(): [number, number]
joint.getReactionForce(inv_dt): [number, number]
joint.getReactionTorque(inv_dt): number
joint.isActive(): boolean
joint.getCollideConnected(): boolean
joint.getUserData(): any
joint.setUserData(data): void
```

### DistanceJoint

```
joint.getLength(): number
joint.setLength(length): void
joint.getMinLength(): number
joint.setMinLength(minLength): void
joint.getMaxLength(): number
joint.setMaxLength(maxLength): void
joint.getCurrentLength(): number
```

### RevoluteJoint

```
joint.getReferenceAngle(): number
joint.getJointAngle(): number
joint.getJointSpeed(): number
joint.isLimitEnabled(): boolean
joint.enableLimit(flag): void
joint.getLowerLimit(): number
joint.getUpperLimit(): number
joint.setLimits(lower, upper): void
joint.isMotorEnabled(): boolean
joint.enableMotor(flag): void
joint.setMotorSpeed(speed): void
joint.getMotorSpeed(): number
joint.setMaxMotorTorque(torque): void
joint.getMaxMotorTorque(): number
joint.getMotorTorque(inv_dt): number
```

### PrismaticJoint

```
joint.getReferenceAngle(): number
joint.getJointTranslation(): number
joint.getJointSpeed(): number
joint.isLimitEnabled(): boolean
joint.enableLimit(flag): void
joint.getLowerLimit(): number
joint.getUpperLimit(): number
joint.setLimits(lower, upper): void
joint.isMotorEnabled(): boolean
joint.enableMotor(flag): void
joint.setMotorSpeed(speed): void
joint.getMotorSpeed(): number
joint.setMaxMotorForce(force): void
joint.getMaxMotorForce(): number
joint.getMotorForce(inv_dt): number
```

### WeldJoint

```
joint.getReferenceAngle(): number
joint.setLinearStiffness(stiffness): void
joint.getLinearStiffness(): number
joint.setAngularStiffness(stiffness): void
joint.getAngularStiffness(): number
joint.setDamping(damping): void
joint.getDamping(): number
```

### MouseJoint

```
joint.setTarget(x, y): void
joint.getTarget(): [number, number]
joint.setMaxForce(force): void
joint.getMaxForce(): number
joint.setStiffness(stiffness): void
joint.getStiffness(): number
joint.setDamping(damping): void
joint.getDamping(): number
```

### WheelJoint

```
joint.getReferenceAngle(): number
joint.getJointTranslation(): number
joint.getJointSpeed(): number
joint.isMotorEnabled(): boolean
joint.enableMotor(flag): void
joint.setMotorSpeed(speed): void
joint.getMotorSpeed(): number
joint.setMaxMotorTorque(torque): void
joint.getMaxMotorTorque(): number
joint.getMotorTorque(inv_dt): number
joint.setStiffness(stiffness): void
joint.getStiffness(): number
joint.setDamping(damping): void
joint.getDamping(): number
```

### MotorJoint

```
joint.setLinearOffset(x, y): void
joint.getLinearOffset(): [number, number]
joint.setAngularOffset(angle): void
joint.getAngularOffset(): number
joint.setMaxForce(force): void
joint.getMaxForce(): number
joint.setMaxTorque(torque): void
joint.getMaxTorque(): number
joint.setCorrectionFactor(factor): void
joint.getCorrectionFactor(): number
```

---

## jove.filesystem

```
setIdentity(name: string): void
getIdentity(): string
getSaveDirectory(): string
getSourceBaseDirectory(): string
getWorkingDirectory(): string
getUserDirectory(): string
getAppdataDirectory(): string
mount(archive: string, mountpoint?: string, appendToSearchPath?: boolean): boolean
unmount(archive: string): boolean
read(path: string): Promise<string | null>     -- async
write(path: string, data: string | Uint8Array): Promise<boolean>   -- async
append(path: string, data: string | Uint8Array): boolean
remove(path: string): boolean
createDirectory(path: string): boolean
getDirectoryItems(path: string): string[]
getInfo(path: string): FileInfo | null
lines(path: string): Promise<string[]>         -- async
```

### FileData

```
filedata.getFilename(): string
filedata.getExtension(): string
filedata.getString(): string
```

---

## jove.math

```
random(min?: number, max?: number): number
randomNormal(stddev?: number, mean?: number): number
setRandomSeed(seed: number): void
getRandomSeed(): number
noise(x: number, y?: number, z?: number): number
newRandomGenerator(seed?: number): RandomGenerator
newTransform(): Transform
newBezierCurve(points: number[]): BezierCurve
triangulate(vertices: number[]): number[][]
isConvex(vertices: number[]): boolean
gammaToLinear(c: number): number
linearToGamma(c: number): number
```

### RandomGenerator

```
rng.random(min?, max?): number
rng.randomNormal(stddev?, mean?): number
rng.setSeed(seed): void
rng.getSeed(): number
rng.getState(): string
rng.setState(state): void
```

### Transform

```
t.getMatrix(): [number, number, number, number, number, number]
t.reset(): Transform
t.translate(dx, dy): Transform
t.rotate(angle): Transform
t.scale(sx, sy?): Transform
t.shear(kx, ky): Transform
t.transformPoint(x, y): [number, number]
t.inverse(): Transform
t.clone(): Transform
```

### BezierCurve

```
curve.evaluate(t): [number, number]
curve.render(depth?): number[]
curve.renderSegment(startT, endT, depth?): number[]
curve.getDerivative(): BezierCurve
curve.getControlPoint(index): [number, number]
curve.setControlPoint(index, x, y): void
curve.insertControlPoint(x, y, index?): void
curve.removeControlPoint(index): void
curve.getControlPointCount(): number
curve.getDegree(): number
curve.getSegment(t1, t2): BezierCurve
curve.translate(dx, dy): void
curve.rotate(angle, ox?, oy?): void
curve.scale(s, ox?, oy?): void
```

---

## jove.system

```
getOS(): string
getProcessorCount(): number
openURL(url: string): boolean
setClipboardText(text: string): boolean
getClipboardText(): string
getPowerInfo(): { state, percent, seconds }
```

---

## jove.event

```
push(event: JoveEvent): void
clear(): void
quit(): void
wait(): JoveEvent[]
pollEvents(): JoveEvent[]
```

---

## jove.data

```
compress(format: "zlib"|"gzip"|"deflate", data, level?): Uint8Array
decompress(format: "zlib"|"gzip"|"deflate", data): Uint8Array
encode(format: "base64"|"hex", data): string
decode(format: "base64"|"hex", str): Uint8Array
hash(algorithm: "md5"|"sha1"|"sha224"|"sha256"|"sha384"|"sha512", data): string
newByteData(sizeOrData: number | Uint8Array | string): ByteData
```

### ByteData

```
bd.getSize(): number
bd.getString(): string
bd.getPointer(): Pointer
bd.clone(): ByteData
```

---

## jove.joystick

```
getJoysticks(): Joystick[]
getJoystickCount(): number
```

### Joystick

```
joy.getAxisCount(): number
joy.getAxis(axis): number
joy.getButtonCount(): number
joy.isDown(...buttons: number[]): boolean       -- 1-indexed
joy.getHatCount(): number
joy.getHat(hat): string
joy.getName(): string
joy.getID(): [number, number]
joy.isConnected(): boolean
joy.isGamepad(): boolean
joy.getGamepadAxis(axis: string): number
joy.isGamepadDown(...buttons: string[]): boolean
joy.setVibration(left?, right?, duration?): boolean
joy.isVibrationSupported(): boolean
joy.getDeviceInfo(): [number, number, number]
```

---

## jove.image

```
newImageData(width: number, height: number): ImageData
newImageData(filepath: string): ImageData | null
```

### ImageData

```
id.getWidth(): number
id.getHeight(): number
id.getDimensions(): [number, number]
id.getPixel(x, y): [r, g, b, a]
id.setPixel(x, y, r, g, b, a): void
id.mapPixel(fn: (x, y, r, g, b, a) => [r, g, b, a]): void
id.paste(source, dx, dy, sx?, sy?, sw?, sh?): void
id.encode(format: "png"|"bmp", filepath?): Uint8Array | null
id.getFormat(): string
id.getString(): string
```

---

## jove.sound

```
newSoundData(samples: number, rate?, bitDepth?, channels?): SoundData
newSoundData(path: string): SoundData
newDecoder(path: string, bufferSize?: number): Decoder
```

### SoundData

```
sd.getSample(i, channel?): number          -- normalized -1..1
sd.setSample(i, value, channel?): void
sd.getSampleCount(): number
sd.getSampleRate(): number
sd.getBitDepth(): number
sd.getChannelCount(): number
sd.getDuration(): number
sd.getString(): string
```

### Decoder

```
dec.decode(): SoundData | null
dec.seek(offset): void
dec.tell(): number
dec.getBitDepth(): number
dec.getChannelCount(): number
dec.getSampleRate(): number
dec.getDuration(): number
dec.getSampleCount(): number
dec.isFinished(): boolean
dec.close(): void
```

---

## jove.video

```
newVideo(path: string, options?: { audio?: boolean }): Video | null
```

### Video

```
vid.play(): void
vid.pause(): void
vid.rewind(): void
vid.seek(t): void
vid.tell(): number
vid.isPlaying(): boolean
vid.getWidth(): number
vid.getHeight(): number
vid.getDimensions(): [number, number]
vid.getDuration(): number
vid.getSource(): VideoAudioSource | null
vid.setFilter(min, mag): void
vid.getFilter(): [string, string]
vid.setLooping(loop): void
vid.isLooping(): boolean
vid.release(): void
```

---

## ParticleSystem

```
ps.start(): void
ps.stop(): void
ps.pause(): void
ps.reset(): void
ps.isActive(): boolean
ps.isPaused(): boolean
ps.isStopped(): boolean
ps.update(dt): void
ps.emit(count): void
ps.getCount(): number
ps.clone(): ParticleSystem
ps.setEmissionRate(rate): void
ps.getEmissionRate(): number
ps.setEmitterLifetime(lifetime): void
ps.getEmitterLifetime(): number
ps.setParticleLifetime(min, max?): void
ps.getParticleLifetime(): [number, number]
ps.setPosition(x, y): void
ps.getPosition(): [number, number]
ps.moveTo(x, y): void
ps.setEmissionArea(distribution, dx, dy, angle?, dirRelative?): void
ps.getEmissionArea(): [distribution, dx, dy, angle, dirRelative]
ps.setDirection(direction): void
ps.getDirection(): number
ps.setSpeed(min, max?): void
ps.getSpeed(): [number, number]
ps.setSpread(spread): void
ps.getSpread(): number
ps.setLinearAcceleration(xmin, ymin, xmax?, ymax?): void
ps.getLinearAcceleration(): [xmin, ymin, xmax, ymax]
ps.setLinearDamping(min, max?): void
ps.getLinearDamping(): [number, number]
ps.setRadialAcceleration(min, max?): void
ps.getRadialAcceleration(): [number, number]
ps.setTangentialAcceleration(min, max?): void
ps.getTangentialAcceleration(): [number, number]
ps.setTexture(image): void
ps.getTexture(): Image
ps.setColors(...rgba: number[]): void
ps.getColors(): number[]
ps.setSizes(...sizes: number[]): void
ps.getSizes(): number[]
ps.setSizeVariation(variation): void
ps.getSizeVariation(): number
ps.setRotation(min, max?): void
ps.getRotation(): [number, number]
ps.setSpin(min, max?): void
ps.getSpin(): [number, number]
ps.setSpinVariation(variation): void
ps.getSpinVariation(): number
ps.setRelativeRotation(enable): void
ps.hasRelativeRotation(): boolean
ps.setOffset(ox, oy): void
ps.getOffset(): [number, number]
ps.setQuads(...quads: Quad[]): void
ps.getQuads(): Quad[]
ps.setBufferSize(size): void
ps.getBufferSize(): number
ps.setInsertMode(mode: "top"|"bottom"|"random"): void
ps.getInsertMode(): "top" | "bottom" | "random"
```

---

## Shader

```
shader.send(name: string, ...values: number[]): void
shader.sendColor(name: string, r, g, b, a?): void
shader.hasUniform(name: string): boolean
shader.release(): void
```

---

## Font

```
font.getHeight(): number
font.getWidth(text: string): number
font.getAscent(): number
font.getDescent(): number
font.getBaseline(): number
font.getLineHeight(): number
font.setLineHeight(height): void
font.getWrap(text: string, wraplimit: number): [number, string[]]
font.release(): void
```
