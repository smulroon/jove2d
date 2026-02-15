// jove2d timer module — mirrors love.timer API

let _startTime = 0;
let _lastTime = 0;
let _dt = 0;
let _fps = 0;
let _frames = 0;
let _fpsAccum = 0;
let _fpsUpdateTime = 0;
const _dtHistory: number[] = [];
const DT_HISTORY_SIZE = 60;

/** Initialize timer state. Called internally by the game loop. */
export function _init(): void {
  const now = performance.now() / 1000;
  _startTime = now;
  _lastTime = now;
  _dt = 0;
  _fps = 0;
  _frames = 0;
  _fpsAccum = 0;
  _fpsUpdateTime = now;
  _dtHistory.length = 0;
}

/** Advance the timer by one frame. Called internally by the game loop. Returns dt. */
export function step(): number {
  const now = performance.now() / 1000;
  _dt = now - _lastTime;
  _lastTime = now;

  // Track dt history for getAverageDelta
  _dtHistory.push(_dt);
  if (_dtHistory.length > DT_HISTORY_SIZE) {
    _dtHistory.shift();
  }

  // FPS counter — update every second
  _frames++;
  _fpsAccum += _dt;
  if (_fpsAccum >= 1.0) {
    _fps = _frames / _fpsAccum;
    _frames = 0;
    _fpsAccum = 0;
  }

  return _dt;
}

/** Get the time between the last two frames. */
export function getDelta(): number {
  return _dt;
}

/** Get the current frames per second. */
export function getFPS(): number {
  return Math.floor(_fps);
}

/** Get the average delta time over the last 60 frames. */
export function getAverageDelta(): number {
  if (_dtHistory.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < _dtHistory.length; i++) {
    sum += _dtHistory[i];
  }
  return sum / _dtHistory.length;
}

/** Get the time in seconds since the game started. */
export function getTime(): number {
  return performance.now() / 1000 - _startTime;
}

/** Sleep for the given number of seconds. */
export async function sleep(seconds: number): Promise<void> {
  await Bun.sleep(Math.max(0, Math.floor(seconds * 1000)));
}
