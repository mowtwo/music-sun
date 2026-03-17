import './style.css'

// ============================================================
// DOM Setup
// ============================================================
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = ''

const canvas = document.createElement('canvas')
app.appendChild(canvas)

const topBar = document.createElement('div')
topBar.id = 'top-bar'

const fileInput = document.createElement('input')
fileInput.type = 'file'
fileInput.id = 'file-input'
fileInput.accept = 'audio/*'

const fileLabel = document.createElement('label')
fileLabel.htmlFor = 'file-input'
fileLabel.textContent = 'Choose Audio File'

const demoBtn = document.createElement('button')
demoBtn.textContent = 'Demo Music'

topBar.append(fileLabel, fileInput, demoBtn)
app.appendChild(topBar)

// Bottom dock (frosted glass panel)
const bottomDock = document.createElement('div')
bottomDock.id = 'bottom-dock'

const siteTitle = document.createElement('div')
siteTitle.id = 'site-title'
siteTitle.textContent = '智慧音频可视化'

const controls = document.createElement('div')
controls.id = 'controls'

const slowBtn = document.createElement('button')
slowBtn.textContent = '-'
const playBtn = document.createElement('button')
playBtn.textContent = 'Play'
const speedDisplay = document.createElement('span')
speedDisplay.id = 'speed-display'
speedDisplay.textContent = '1x'
const fastBtn = document.createElement('button')
fastBtn.textContent = '+'

controls.append(slowBtn, playBtn, speedDisplay, fastBtn)

const progressBar = document.createElement('div')
progressBar.id = 'progress-bar'
const progressSlider = document.createElement('input')
progressSlider.type = 'range'
progressSlider.min = '0'
progressSlider.max = '1000'
progressSlider.value = '0'
const progressTime = document.createElement('span')
progressTime.id = 'progress-time'
progressTime.textContent = '0:00 / 0:00'
progressBar.append(progressSlider, progressTime)

bottomDock.append(siteTitle, progressBar, controls)
app.appendChild(bottomDock)

let playbackRate = 1.0
let isSeeking = false

const ctx = canvas.getContext('2d')!

// ============================================================
// Audio Setup
// ============================================================
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let source: MediaElementAudioSourceNode | null = null
let audioElement: HTMLAudioElement | null = null
let frequencyData: Uint8Array<ArrayBuffer> | null = null

// ============================================================
// State
// ============================================================
let startTime = 0
let isPlaying = false
let isDemoTrack = false

// ============================================================
// Visualization Themes
// ============================================================
type VisMode = 'sun' | 'lines' | 'blocks'

const THEME_BACKGROUNDS: Record<'red' | 'purple', string[]> = {
  red:    ['#8B1A1A', '#6B2020', '#7A2233', '#5C1818'],
  purple: ['#3B1568', '#4A1A6B', '#2D1B4E', '#5C2D82'],
}

let currentMode: VisMode = 'lines'
let currentBg = THEME_BACKGROUNDS.purple[0]
let targetBg = currentBg
let targetMode: VisMode = currentMode

// Transition state: 0 = idle, fading out old -> fading in new
let transitionPhase: 'idle' | 'fade-out' | 'fade-in' = 'idle'
let transitionAlpha = 0  // overlay opacity for crossfade
const TRANSITION_SPEED = 0.03 // per frame

function applyTheme(mode: VisMode, bg: string, favicon: string) {
  if (mode === currentMode && bg === currentBg) {
    // No change needed
    setFavicon(favicon)
    return
  }
  targetMode = mode
  targetBg = bg
  setFavicon(favicon)
  if (transitionPhase === 'idle') {
    transitionPhase = 'fade-out'
    transitionAlpha = 0
  }
}

function pickRandomAltTheme() {
  const mode: VisMode = Math.random() < 0.5 ? 'lines' : 'blocks'
  const palette = Math.random() < 0.5 ? 'red' : 'purple'
  const colors = THEME_BACKGROUNDS[palette]
  const bg = colors[Math.floor(Math.random() * colors.length)]
  const favicon = mode === 'lines' ? faviconLines : faviconBlocks
  applyTheme(mode, bg, favicon)
}

// Direct set (no animation) for initial load
function setThemeImmediate(mode: VisMode, bg: string, favicon: string) {
  currentMode = mode
  targetMode = mode
  currentBg = bg
  targetBg = bg
  transitionPhase = 'idle'
  transitionAlpha = 0
  setFavicon(favicon)
  document.body.style.background = bg
}

// ============================================================
// Favicons (inline SVG data URIs)
// ============================================================
const faviconSun = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="12" fill="#0000C8"/>
    <circle cx="32" cy="32" r="10" fill="#fff"/>
    <polygon points="32,8 29,18 35,18" fill="#fff"/>
    <polygon points="32,56 29,46 35,46" fill="#fff"/>
    <polygon points="8,32 18,29 18,35" fill="#fff"/>
    <polygon points="56,32 46,29 46,35" fill="#fff"/>
    <polygon points="15,15 21,22 24,19" fill="#fff"/>
    <polygon points="49,15 43,22 40,19" fill="#fff"/>
    <polygon points="15,49 21,42 24,45" fill="#fff"/>
    <polygon points="49,49 43,42 40,45" fill="#fff"/>
  </svg>`)}`

const faviconLines = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="12" fill="#3B1568"/>
    <rect x="8" y="28" width="4" height="20" rx="2" fill="#fff" opacity="0.9"/>
    <rect x="16" y="18" width="4" height="30" rx="2" fill="#fff" opacity="0.9"/>
    <rect x="24" y="12" width="4" height="40" rx="2" fill="#fff" opacity="0.9"/>
    <rect x="32" y="22" width="4" height="26" rx="2" fill="#fff" opacity="0.9"/>
    <rect x="40" y="16" width="4" height="32" rx="2" fill="#fff" opacity="0.9"/>
    <rect x="48" y="24" width="4" height="22" rx="2" fill="#fff" opacity="0.9"/>
  </svg>`)}`

const faviconBlocks = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="12" fill="#8B1A1A"/>
    <rect x="8" y="8" width="12" height="12" rx="2" fill="#fff" opacity="0.8"/>
    <rect x="26" y="8" width="12" height="12" rx="2" fill="#fff" opacity="0.6"/>
    <rect x="44" y="8" width="12" height="12" rx="2" fill="#fff" opacity="0.9"/>
    <rect x="8" y="26" width="12" height="12" rx="2" fill="#fff" opacity="0.5"/>
    <rect x="26" y="26" width="12" height="12" rx="2" fill="#fff" opacity="1"/>
    <rect x="44" y="26" width="12" height="12" rx="2" fill="#fff" opacity="0.7"/>
    <rect x="8" y="44" width="12" height="12" rx="2" fill="#fff" opacity="0.9"/>
    <rect x="26" y="44" width="12" height="12" rx="2" fill="#fff" opacity="0.7"/>
    <rect x="44" y="44" width="12" height="12" rx="2" fill="#fff" opacity="0.5"/>
  </svg>`)}`

function setFavicon(dataUri: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = dataUri
}

// ============================================================
// Frequency fingerprint detection
// ============================================================
// We sample the first few seconds of audio and build a frequency
// profile. The demo track has a distinctive signature — heavy
// low-mid energy with specific spectral shape. We compare using
// cosine similarity on the spectral centroid + band energy ratios.
let probeFrames: number[][] = []
let probeTimer: number | null = null
let hasDecidedMode = false

function startProbing() {
  probeFrames = []
  hasDecidedMode = false
  // Collect frequency snapshots over 2 seconds
  const collectFrame = () => {
    if (!analyser || !frequencyData) return
    analyser.getByteFrequencyData(frequencyData)
    probeFrames.push(Array.from(frequencyData))
  }
  probeTimer = window.setInterval(collectFrame, 50)
  setTimeout(() => {
    if (probeTimer) clearInterval(probeTimer)
    decideMode()
  }, 2000)
}

function decideMode() {
  if (hasDecidedMode) return
  hasDecidedMode = true

  if (isDemoTrack) {
    applyTheme('sun', '#0000C8', faviconSun)
    return
  }

  if (probeFrames.length < 5) {
    pickRandomAltTheme()
    return
  }

  // Compute average spectrum
  const len = probeFrames[0].length
  const avg = new Float32Array(len)
  for (const frame of probeFrames) {
    for (let i = 0; i < len; i++) avg[i] += frame[i]
  }
  for (let i = 0; i < len; i++) avg[i] /= probeFrames.length

  // Band energy ratios (low / mid / high)
  const third = Math.floor(len / 3)
  let lowE = 0, midE = 0, highE = 0
  for (let i = 0; i < third; i++) lowE += avg[i]
  for (let i = third; i < third * 2; i++) midE += avg[i]
  for (let i = third * 2; i < len; i++) highE += avg[i]
  const total = lowE + midE + highE + 0.001

  const lowRatio = lowE / total
  const midRatio = midE / total

  // The demo track signature: strong low-mid energy, low-mid ratio > 0.7
  // and a specific spectral centroid range
  let centroid = 0
  let energy = 0
  for (let i = 0; i < len; i++) {
    centroid += i * avg[i]
    energy += avg[i]
  }
  centroid /= (energy + 0.001)
  const normalizedCentroid = centroid / len

  // Match: heavy low-mid, centroid in lower range
  if (lowRatio + midRatio > 0.72 && normalizedCentroid < 0.35) {
    applyTheme('sun', '#0000C8', faviconSun)
  } else {
    pickRandomAltTheme()
  }
}

// ============================================================
// Sun constants
// ============================================================
const TRIANGLE_COUNT = 12
const MIN_TRIANGLE_LENGTH = 5
const MAX_TRIANGLE_LENGTH = 180
const GAP_FROM_CIRCLE = 8
const TRIANGLE_BASE_HALF = 18
const ROTATION_SPEED = 0.3

// ============================================================
// Lines constants
// ============================================================
const LINE_COUNT = 48

// ============================================================
// Blocks constants
// ============================================================
const BLOCK_COLS = 16
const BLOCK_ROWS = 10

// ============================================================
// Resize
// ============================================================
function resize() {
  canvas.width = window.innerWidth * devicePixelRatio
  canvas.height = window.innerHeight * devicePixelRatio
  ctx.scale(devicePixelRatio, devicePixelRatio)
}
window.addEventListener('resize', resize)
resize()

// ============================================================
// Audio Init
// ============================================================
function initAudio(src: string, isDemo: boolean) {
  if (audioElement) {
    audioElement.pause()
    audioElement.src = ''
  }
  if (probeTimer) clearInterval(probeTimer)

  isDemoTrack = isDemo

  audioContext = new AudioContext()
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.75

  audioElement = new Audio()
  audioElement.crossOrigin = 'anonymous'
  audioElement.src = src

  source = audioContext.createMediaElementSource(audioElement)
  source.connect(analyser)
  analyser.connect(audioContext.destination)

  frequencyData = new Uint8Array(analyser.frequencyBinCount)

  // Reset smoothed arrays
  smoothedSun.fill(0)
  smoothedLines.fill(0)
  smoothedBlocks.fill(0)

  // Pre-decide for demo, otherwise pick random until probe decides
  if (isDemo) {
    applyTheme('sun', '#0000C8', faviconSun)
    hasDecidedMode = true
  } else {
    pickRandomAltTheme()
    hasDecidedMode = false
  }

  bottomDock.style.display = 'flex'
  playBtn.textContent = 'Play'
  playbackRate = 1.0
  speedDisplay.textContent = '1x'
  progressSlider.value = '0'
  isPlaying = false

  audioElement.addEventListener('ended', () => {
    isPlaying = false
    playBtn.textContent = 'Play'
  })
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) initAudio(URL.createObjectURL(file), false)
})

demoBtn.addEventListener('click', () => {
  initAudio('/YA1OvUaoVuc.mp3', true)
})

playBtn.addEventListener('click', () => {
  if (!audioElement || !audioContext) return

  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }

  if (isPlaying) {
    audioElement.pause()
    isPlaying = false
    playBtn.textContent = 'Play'
  } else {
    audioElement.play()
    isPlaying = true
    startTime = performance.now()
    playBtn.textContent = 'Pause'
    if (!hasDecidedMode && !isDemoTrack) startProbing()
  }
})

function updateSpeed(delta: number) {
  if (!audioElement) return
  playbackRate = Math.round(Math.max(0.25, Math.min(3, playbackRate + delta)) * 100) / 100
  audioElement.playbackRate = playbackRate
  speedDisplay.textContent = playbackRate + 'x'
}

slowBtn.addEventListener('click', () => updateSpeed(-0.25))
fastBtn.addEventListener('click', () => updateSpeed(0.25))

// --- Progress bar ---
function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m + ':' + (sec < 10 ? '0' : '') + sec
}

progressSlider.addEventListener('input', () => {
  isSeeking = true
  if (audioElement && audioElement.duration) {
    const t = (Number(progressSlider.value) / 1000) * audioElement.duration
    progressTime.textContent = formatTime(t) + ' / ' + formatTime(audioElement.duration)
  }
})

progressSlider.addEventListener('change', () => {
  if (audioElement && audioElement.duration) {
    audioElement.currentTime = (Number(progressSlider.value) / 1000) * audioElement.duration
  }
  isSeeking = false
})

// ============================================================
// Smoothed values
// ============================================================
const smoothedSun = new Float32Array(TRIANGLE_COUNT).fill(0)
const smoothedLines = new Float32Array(LINE_COUNT).fill(0)
const smoothedBlocks = new Float32Array(BLOCK_COLS * BLOCK_ROWS).fill(0)

// ============================================================
// Helper: get normalized bands from frequency data
// ============================================================
function getBands(count: number): number[] {
  const bands: number[] = []
  if (!frequencyData || !isPlaying) {
    for (let i = 0; i < count; i++) bands.push(0)
    return bands
  }
  const binCount = frequencyData.length
  const binsPerBand = Math.floor(binCount / count)

  let globalSum = 0
  for (let k = 0; k < binCount; k++) globalSum += frequencyData[k]
  const globalAvg = globalSum / binCount / 255

  for (let i = 0; i < count; i++) {
    let sum = 0
    for (let j = 0; j < binsPerBand; j++) {
      sum += frequencyData[i * binsPerBand + j]
    }
    const individual = sum / binsPerBand / 255
    const blended = Math.min(globalAvg * 0.4 + individual * 0.6, 1)
    bands.push(Math.pow(blended, 0.5))
  }
  return bands
}

// ============================================================
// Draw: Sun Mode
// ============================================================
function drawSun(now: number, w: number, h: number) {
  const minSide = Math.min(w, h)
  const circleRadius = minSide / 10
  const cx = w / 2
  const cy = h / 2

  const bands = getBands(TRIANGLE_COUNT)
  const triangleLengths: number[] = []

  for (let i = 0; i < TRIANGLE_COUNT; i++) {
    const target = isPlaying
      ? MIN_TRIANGLE_LENGTH + bands[i] * (MAX_TRIANGLE_LENGTH - MIN_TRIANGLE_LENGTH)
      : MIN_TRIANGLE_LENGTH
    smoothedSun[i] += (target - smoothedSun[i]) * (isPlaying ? 0.18 : 0.08)
    triangleLengths.push(smoothedSun[i])
  }

  const elapsed = isPlaying ? (now - startTime) / 1000 : 0
  const rotationAngle = elapsed * ROTATION_SPEED * Math.pow(playbackRate, 2.5)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rotationAngle)

  const angleStep = (Math.PI * 2) / TRIANGLE_COUNT
  ctx.fillStyle = '#ffffff'

  for (let i = 0; i < TRIANGLE_COUNT; i++) {
    const angle = i * angleStep
    const length = triangleLengths[i]
    const innerR = circleRadius + GAP_FROM_CIRCLE
    const outerR = innerR + length

    const pointiness = Math.min((length - MIN_TRIANGLE_LENGTH) / (MAX_TRIANGLE_LENGTH * 0.06), 1)
    const baseHalfAngle = Math.atan2(TRIANGLE_BASE_HALF, innerR)
    const baseLeft = angle - baseHalfAngle
    const baseRight = angle + baseHalfAngle
    const tipHalfAngle = baseHalfAngle * (1 - pointiness)
    const tipLeft = angle - tipHalfAngle
    const tipRight = angle + tipHalfAngle

    ctx.beginPath()
    ctx.arc(0, 0, innerR, baseLeft, baseRight)
    ctx.lineTo(Math.cos(tipRight) * outerR, Math.sin(tipRight) * outerR)
    if (tipHalfAngle > 0.001) {
      ctx.arc(0, 0, outerR, tipRight, tipLeft, true)
    }
    ctx.lineTo(Math.cos(baseLeft) * innerR, Math.sin(baseLeft) * innerR)
    ctx.closePath()
    ctx.fill()
  }

  ctx.beginPath()
  ctx.arc(0, 0, circleRadius, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  ctx.restore()
}

// ============================================================
// Draw: Lines Mode
// ============================================================
function drawLines(_now: number, w: number, h: number) {
  const bands = getBands(LINE_COUNT)
  const barWidth = w / LINE_COUNT
  const maxBarHeight = h * 0.7

  for (let i = 0; i < LINE_COUNT; i++) {
    const target = isPlaying ? bands[i] * maxBarHeight : maxBarHeight * 0.03
    smoothedLines[i] += (target - smoothedLines[i]) * (isPlaying ? 0.2 : 0.08)
    const barH = smoothedLines[i]

    // Gradient-like opacity based on height
    const alpha = 0.4 + 0.6 * (barH / maxBarHeight)
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`

    const x = i * barWidth + barWidth * 0.15
    const bw = barWidth * 0.7
    const radius = Math.min(bw / 2, 4)

    // Draw rounded rect from bottom center
    const y = (h - barH) / 2
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + bw - radius, y)
    ctx.quadraticCurveTo(x + bw, y, x + bw, y + radius)
    ctx.lineTo(x + bw, y + barH - radius)
    ctx.quadraticCurveTo(x + bw, y + barH, x + bw - radius, y + barH)
    ctx.lineTo(x + radius, y + barH)
    ctx.quadraticCurveTo(x, y + barH, x, y + barH - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
    ctx.fill()
  }
}

// ============================================================
// Draw: Blocks Mode
// ============================================================
function drawBlocks(_now: number, w: number, h: number) {
  const bands = getBands(BLOCK_COLS)
  const gap = 4
  const blockW = (w - gap * (BLOCK_COLS + 1)) / BLOCK_COLS
  const blockH = (h - gap * (BLOCK_ROWS + 1)) / BLOCK_ROWS
  const maxRadius = Math.min(blockW, blockH) / 4

  for (let col = 0; col < BLOCK_COLS; col++) {
    // How many rows light up in this column
    const target = isPlaying ? bands[col] * BLOCK_ROWS : 0.3
    const litRows = Math.ceil(target)

    for (let row = 0; row < BLOCK_ROWS; row++) {
      const idx = col * BLOCK_ROWS + row
      // Rows from bottom: row 0 = bottom
      const fromBottom = BLOCK_ROWS - 1 - row
      const isLit = fromBottom < litRows

      const targetAlpha = isLit ? 0.3 + 0.7 * (1 - fromBottom / BLOCK_ROWS) : 0.06
      smoothedBlocks[idx] += (targetAlpha - smoothedBlocks[idx]) * (isPlaying ? 0.2 : 0.08)

      ctx.fillStyle = `rgba(255, 255, 255, ${smoothedBlocks[idx]})`

      const x = gap + col * (blockW + gap)
      const y = gap + row * (blockH + gap)
      const r = Math.min(maxRadius, 6)

      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + blockW - r, y)
      ctx.quadraticCurveTo(x + blockW, y, x + blockW, y + r)
      ctx.lineTo(x + blockW, y + blockH - r)
      ctx.quadraticCurveTo(x + blockW, y + blockH, x + blockW - r, y + blockH)
      ctx.lineTo(x + r, y + blockH)
      ctx.quadraticCurveTo(x, y + blockH, x, y + blockH - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.fill()
    }
  }
}

// ============================================================
// Main draw loop
// ============================================================
// Helper: parse hex color to [r, g, b]
function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const bl = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${bl})`
}

function draw(now: number) {
  const w = window.innerWidth
  const h = window.innerHeight

  // --- Handle theme transition ---
  if (transitionPhase === 'fade-out') {
    transitionAlpha += TRANSITION_SPEED
    if (transitionAlpha >= 1) {
      transitionAlpha = 1
      // Switch to new theme at peak of fade
      currentMode = targetMode
      currentBg = targetBg
      document.body.style.background = currentBg
      // Reset smoothed arrays for clean entry
      smoothedSun.fill(0)
      smoothedLines.fill(0)
      smoothedBlocks.fill(0)
      transitionPhase = 'fade-in'
    }
  } else if (transitionPhase === 'fade-in') {
    transitionAlpha -= TRANSITION_SPEED
    if (transitionAlpha <= 0) {
      transitionAlpha = 0
      transitionPhase = 'idle'
    }
  }

  // Background: lerp during transition
  if (transitionPhase === 'fade-out') {
    ctx.fillStyle = lerpColor(currentBg, targetBg, transitionAlpha)
  } else {
    ctx.fillStyle = currentBg
  }
  ctx.fillRect(0, 0, w, h)

  // Update progress bar
  if (audioElement && audioElement.duration && !isSeeking) {
    progressSlider.value = String((audioElement.currentTime / audioElement.duration) * 1000)
    progressTime.textContent = formatTime(audioElement.currentTime) + ' / ' + formatTime(audioElement.duration)
  }

  // Get frequency data
  if (analyser && frequencyData && isPlaying) {
    analyser.getByteFrequencyData(frequencyData)
  }

  // Draw current visualization
  switch (currentMode) {
    case 'sun':    drawSun(now, w, h); break
    case 'lines':  drawLines(now, w, h); break
    case 'blocks': drawBlocks(now, w, h); break
  }

  // Overlay fade effect during transitions
  if (transitionAlpha > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${transitionAlpha * 0.6})`
    ctx.fillRect(0, 0, w, h)
  }

  requestAnimationFrame(draw)
}

// ============================================================
// Init: default to random alt theme (no animation on first load)
// ============================================================
{
  const mode: VisMode = Math.random() < 0.5 ? 'lines' : 'blocks'
  const palette = Math.random() < 0.5 ? 'red' : 'purple'
  const colors = THEME_BACKGROUNDS[palette]
  const bg = colors[Math.floor(Math.random() * colors.length)]
  const favicon = mode === 'lines' ? faviconLines : faviconBlocks
  setThemeImmediate(mode, bg, favicon)
}
requestAnimationFrame(draw)
