import type { Fixture, Player } from "./types"

export const GAMEWEEK_POSTER = { width: 1920, height: 1080 } as const
export const MATCH_POSTER = { width: 1600, height: 900 } as const

type Side = "left" | "right"

type Fonts = {
  display: string
  body: string
}

type GameweekLayout = {
  width: number
  height: number
  centerX: number
  headerY: number
  headerRadius: number
  ballY: number
  ballRadius: number
  rowYs: number[]
  avatarSize: number
  badgeSize: number
  bannerHeight: number
  vsRadius: number
  sideMargin: number
  vsGutter: number
  avatarOverlap: number
}

type ImageMap = Map<string, HTMLImageElement>

const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function canvasFonts(): Fonts {
  if (typeof document === "undefined") {
    return { display: "Arial", body: "Arial" }
  }

  const root = getComputedStyle(document.documentElement)
  const display = root.getPropertyValue("--font-space-grotesk").trim() || "Arial"
  const body = root.getPropertyValue("--font-dm-sans").trim() || "Arial"
  return { display, body }
}

async function prepareFonts() {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready
  }
}

function resetContext(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "source-over"
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.shadowColor = "transparent"
  ctx.lineJoin = "miter"
  ctx.lineCap = "butt"
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(src)
  if (cached) return cached

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

  imageCache.set(src, promise)
  return promise
}

async function preloadImages(urls: Array<string | null | undefined>): Promise<ImageMap> {
  const unique = [...new Set(urls.filter((url): url is string => Boolean(url)))]
  const entries = await Promise.all(
    unique.map(async (url) => {
      const image = await loadImage(url)
      return [url, image] as const
    }),
  )

  const map: ImageMap = new Map()
  for (const [url, image] of entries) {
    if (image) map.set(url, image)
  }
  return map
}

function collectPlayerUrls(players: Player[]) {
  return players.flatMap((player) => [player.image, player.teamImage])
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontWeight: string,
  fontFamily: string,
  maxSize: number,
  minSize = 13,
) {
  let size = maxSize
  let output = text

  while (size >= minSize) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`
    if (ctx.measureText(output).width <= maxWidth) {
      return { font: ctx.font, text: output, size }
    }
    size -= 1
  }

  ctx.font = `${fontWeight} ${minSize}px ${fontFamily}`
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1)
  }

  return { font: ctx.font, text: `${output}…`, size: minSize }
}

function drawCoverInCircle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number,
) {
  const scale = Math.max((radius * 2) / img.width, (radius * 2) / img.height)
  const width = img.width * scale
  const height = img.height * scale

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, cx - width / 2, cy - height / 2, width, height)
  ctx.restore()
}

function drawContainInCircle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number,
) {
  const scale = Math.min((radius * 2) / img.width, (radius * 2) / img.height)
  const width = img.width * scale
  const height = img.height * scale

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, cx - width / 2, cy - height / 2, width, height)
  ctx.restore()
}

function drawFallbackBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, "#0b1f5c")
  gradient.addColorStop(0.45, "#12307a")
  gradient.addColorStop(1, "#07143d")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

async function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const bg = await loadImage("/fixture-bg.jpg")
  if (bg) {
    ctx.drawImage(bg, 0, 0, width, height)
    ctx.fillStyle = "rgba(4, 12, 40, 0.18)"
    ctx.fillRect(0, 0, width, height)
    return
  }

  drawFallbackBackground(ctx, width, height)
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number) {
  const spikes = 5
  ctx.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (i * Math.PI) / spikes
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

function drawChampionsLeagueBall(ctx: CanvasRenderingContext2D, centerX: number, y: number, radius: number) {
  ctx.save()
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)"
  ctx.shadowBlur = 16
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ctx.arc(centerX, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = "rgba(30, 64, 175, 0.35)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(centerX, y, radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = "#1e40af"
  const orbit = radius * 0.42
  const starOuter = radius * 0.16
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    drawStar(ctx, centerX + Math.cos(angle) * orbit, y + Math.sin(angle) * orbit, starOuter, starOuter * 0.42)
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function isMostlyLight(img: HTMLImageElement) {
  const sample = document.createElement("canvas")
  sample.width = 16
  sample.height = 16
  const sampleCtx = sample.getContext("2d")
  if (!sampleCtx) return false

  sampleCtx.drawImage(img, 0, 0, 16, 16)
  const pixels = sampleCtx.getImageData(0, 0, 16, 16).data
  let luminance = 0
  let count = 0

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]
    if (alpha < 24) continue
    luminance += (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) * (alpha / 255)
    count++
  }

  return count > 0 && luminance / count > 168
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  layout: Pick<GameweekLayout, "centerX" | "headerY" | "headerRadius">,
  title: string,
  subtitle: string,
  fonts: Fonts,
) {
  const { centerX, headerY, headerRadius } = layout

  ctx.fillStyle = "rgba(30, 64, 175, 0.96)"
  ctx.beginPath()
  ctx.arc(centerX, headerY, headerRadius, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = "rgba(147, 197, 253, 0.85)"
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `bold ${Math.round(headerRadius * 0.42)}px ${fonts.display}`
  ctx.fillText(title, centerX, headerY)

  if (!subtitle) return

  ctx.font = `bold 18px ${fonts.body}`
  const pillWidth = Math.max(140, ctx.measureText(subtitle).width + 36)
  const pillHeight = 32
  const pillX = centerX - pillWidth / 2
  const pillY = headerY + headerRadius + 10

  ctx.fillStyle = "rgba(30, 64, 175, 0.92)"
  roundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 16)
  ctx.fill()
  ctx.strokeStyle = "rgba(147, 197, 253, 0.7)"
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.fillStyle = "#f8fafc"
  ctx.fillText(subtitle, centerX, pillY + pillHeight / 2)
}

function computeGameweekLayout(matchCount: number): GameweekLayout {
  const { width, height } = GAMEWEEK_POSTER
  const centerX = width / 2
  const headerRadius = 58
  const headerY = 70
  const ballRadius = 46
  const ballY = height - 62
  const contentTop = headerY + headerRadius + 52
  const contentBottom = ballY - ballRadius - 16
  const contentHeight = Math.max(contentBottom - contentTop, 120)
  const rows = Math.max(matchCount, 1)
  const rowHeight = contentHeight / rows
  const avatarSize = clamp(rowHeight * 0.72, 54, 92)
  const bannerHeight = clamp(avatarSize * 0.64, 38, 58)
  const vsRadius = clamp(bannerHeight * 0.5, 22, 32)

  return {
    width,
    height,
    centerX,
    headerY,
    headerRadius,
    ballY,
    ballRadius,
    rowYs: Array.from({ length: matchCount }, (_, index) => contentTop + rowHeight * (index + 0.5)),
    avatarSize,
    badgeSize: clamp(avatarSize * 0.4, 24, 36),
    bannerHeight,
    vsRadius,
    sideMargin: 48,
    vsGutter: 26,
    avatarOverlap: avatarSize * 0.22,
  }
}

function bannerRect(layout: GameweekLayout, side: Side) {
  const avatarCenterX =
    side === "left" ? layout.sideMargin + layout.avatarSize / 2 : layout.width - layout.sideMargin - layout.avatarSize / 2
  const innerX =
    side === "left" ? layout.centerX - layout.vsRadius - layout.vsGutter : layout.centerX + layout.vsRadius + layout.vsGutter
  const outerX =
    side === "left"
      ? avatarCenterX + layout.avatarSize / 2 - layout.avatarOverlap
      : avatarCenterX - layout.avatarSize / 2 + layout.avatarOverlap

  return {
    avatarCenterX,
    x: side === "left" ? outerX : innerX,
    width: side === "left" ? innerX - outerX : outerX - innerX,
  }
}

function drawInitialsAvatar(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  radius: number,
  fonts: Fonts,
) {
  ctx.fillStyle = "#1e3a8a"
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `bold ${Math.round(radius * 0.55)}px ${fonts.display}`
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  ctx.fillText(initials, cx, cy + 1)
}

function drawPlayerSlot(
  ctx: CanvasRenderingContext2D,
  player: Player,
  y: number,
  side: Side,
  layout: GameweekLayout,
  fonts: Fonts,
  images: ImageMap,
) {
  const banner = bannerRect(layout, side)
  const bannerY = y - layout.bannerHeight / 2

  ctx.fillStyle = "#1e40af"
  ctx.fillRect(banner.x, bannerY, banner.width, layout.bannerHeight)
  ctx.strokeStyle = "#60a5fa"
  ctx.lineWidth = 2
  ctx.strokeRect(banner.x, bannerY, banner.width, layout.bannerHeight)

  const pad = 20
  const maxTextWidth = Math.max(40, banner.width - pad * 2)
  const label = player.name.toUpperCase()
  const fitted = fitText(ctx, label, maxTextWidth, "bold", fonts.body, clamp(layout.bannerHeight * 0.42, 16, 24))

  ctx.fillStyle = "#ffffff"
  ctx.font = fitted.font
  ctx.textBaseline = "middle"
  ctx.textAlign = side === "left" ? "right" : "left"
  ctx.fillText(fitted.text, side === "left" ? banner.x + banner.width - pad : banner.x + pad, y)

  const avatarRadius = layout.avatarSize / 2
  const playerImage = player.image ? images.get(player.image) : undefined
  if (playerImage) {
    drawCoverInCircle(ctx, playerImage, banner.avatarCenterX, y, avatarRadius)
  } else {
    drawInitialsAvatar(ctx, player.name, banner.avatarCenterX, y, avatarRadius, fonts)
  }

  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(banner.avatarCenterX, y, avatarRadius, 0, Math.PI * 2)
  ctx.stroke()

  const teamImage = player.teamImage ? images.get(player.teamImage) : undefined
  if (teamImage) {
    const badgeRadius = layout.badgeSize / 2
    const badgeX = banner.avatarCenterX + (side === "left" ? avatarRadius * 0.62 : -avatarRadius * 0.62)
    const badgeY = y + avatarRadius * 0.62

    ctx.fillStyle = isMostlyLight(teamImage) ? "#1e3a8a" : "#ffffff"
    ctx.beginPath()
    ctx.arc(badgeX, badgeY, badgeRadius + 3, 0, Math.PI * 2)
    ctx.fill()

    drawContainInCircle(ctx, teamImage, badgeX, badgeY, badgeRadius * 0.92)

    ctx.strokeStyle = "#1e40af"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(badgeX, badgeY, badgeRadius + 3, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawVsBadge(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fonts: Fonts) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, "#60a5fa")
  gradient.addColorStop(0.7, "#3b82f6")
  gradient.addColorStop(1, "#1e40af")

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = "#93c5fd"
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, radius - 3, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `bold ${Math.round(radius * 0.62)}px ${fonts.display}`
  ctx.fillText("VS", x, y)
}

function roundSubtitle(gameweek: number, roundTitle: string) {
  const trimmed = roundTitle.trim()
  return trimmed || `Round ${gameweek}`
}

export async function renderGameweekPoster(
  canvas: HTMLCanvasElement,
  fixtures: Fixture[],
  gameweek: number,
  roundTitle: string,
) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  canvas.width = GAMEWEEK_POSTER.width
  canvas.height = GAMEWEEK_POSTER.height
  resetContext(ctx)
  await prepareFonts()

  const fonts = canvasFonts()
  const layout = computeGameweekLayout(fixtures.length)
  const images = await preloadImages(collectPlayerUrls(fixtures.flatMap((fixture) => [fixture.player1, fixture.player2])))

  await drawBackground(ctx, layout.width, layout.height)
  drawHeader(ctx, layout, `GW ${gameweek}`, roundSubtitle(gameweek, roundTitle), fonts)
  drawChampionsLeagueBall(ctx, layout.centerX, layout.ballY, layout.ballRadius)

  fixtures.forEach((fixture, index) => {
    const y = layout.rowYs[index]
    drawVsBadge(ctx, layout.centerX, y, layout.vsRadius, fonts)
    drawPlayerSlot(ctx, fixture.player1, y, "left", layout, fonts, images)
    drawPlayerSlot(ctx, fixture.player2, y, "right", layout, fonts, images)
  })
}

export async function renderMatchPoster(canvas: HTMLCanvasElement, fixture: Fixture) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  canvas.width = MATCH_POSTER.width
  canvas.height = MATCH_POSTER.height
  resetContext(ctx)
  await prepareFonts()

  const fonts = canvasFonts()
  const images = await preloadImages(collectPlayerUrls([fixture.player1, fixture.player2]))
  const width = MATCH_POSTER.width
  const height = MATCH_POSTER.height
  const centerX = width / 2
  const centerY = height / 2 + 20

  await drawBackground(ctx, width, height)
  drawHeader(
    ctx,
    { centerX, headerY: 110, headerRadius: 78 },
    `GW ${fixture.gameweek}`,
    "Matchday",
    fonts,
  )
  drawChampionsLeagueBall(ctx, centerX, height - 78, 54)
  drawVsBadge(ctx, centerX, centerY, 46, fonts)

  const layout: GameweekLayout = {
    width,
    height,
    centerX,
    headerY: 110,
    headerRadius: 78,
    ballY: height - 78,
    ballRadius: 54,
    rowYs: [centerY],
    avatarSize: 168,
    badgeSize: 58,
    bannerHeight: 92,
    vsRadius: 46,
    sideMargin: 90,
    vsGutter: 36,
    avatarOverlap: 36,
  }

  drawPlayerSlot(ctx, fixture.player1, centerY, "left", layout, fonts, images)
  drawPlayerSlot(ctx, fixture.player2, centerY, "right", layout, fonts, images)
}
