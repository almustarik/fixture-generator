"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Trash2, Download, Plus, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import JSZip from "jszip"

interface Player {
  id: string
  name: string
  image: string | null
}

interface Fixture {
  id: string
  gameweek: number
  player1: Player
  player2: Player
}

export default function FixtureGenerator() {
  const [players, setPlayers] = useState<Player[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [newPlayerName, setNewPlayerName] = useState("")
  const [selectedRound, setSelectedRound] = useState<number>(1)
  const [roundTitle, setRoundTitle] = useState("")
  const [homeAwayMode, setHomeAwayMode] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Generate round-robin fixtures with proper gameweek organization
  const generateFixtures = () => {
    if (players.length < 2) return

    const newFixtures: Fixture[] = []
    let fixtureId = 1

    const playerCount = players.length
    const isEven = playerCount % 2 === 0
    const totalPlayers = isEven ? playerCount : playerCount + 1 // Add dummy player for odd numbers
    const baseRounds = totalPlayers - 1

    // Create player list for scheduling (numbered 1, 2, 3, etc.)
    const playersForScheduling = [...players]
    if (!isEven) {
      playersForScheduling.push({ id: "bye", name: "BYE", image: null })
    }

    console.log(`Generating fixtures for ${playerCount} players`)
    console.log(`Base rounds: ${baseRounds}, Home/Away mode: ${homeAwayMode}`)

    const firstHalfFixtures: Fixture[] = []

    // Standard round-robin algorithm
    for (let round = 0; round < baseRounds; round++) {
      const roundFixtures: Fixture[] = []

      // Create matches for this round
      for (let i = 0; i < totalPlayers / 2; i++) {
        const player1Index = i
        const player2Index = totalPlayers - 1 - i

        const player1 = playersForScheduling[player1Index]
        const player2 = playersForScheduling[player2Index]

        // Skip if either player is the "bye" player
        if (player1.id !== "bye" && player2.id !== "bye") {
          roundFixtures.push({
            id: `fixture-${fixtureId}`,
            gameweek: round + 1,
            player1,
            player2,
          })
          fixtureId++
        }
      }

      console.log(`Round ${round + 1}: Generated ${roundFixtures.length} matches`)
      firstHalfFixtures.push(...roundFixtures)
      newFixtures.push(...roundFixtures)

      // Rotate players (keep first player fixed, rotate others clockwise)
      if (totalPlayers > 2) {
        const lastPlayer = playersForScheduling.pop()!
        playersForScheduling.splice(1, 0, lastPlayer)
      }
    }

    // Add home/away fixtures if enabled
    if (homeAwayMode) {
      console.log(`Generating second half (home/away reversed) - ${firstHalfFixtures.length} fixtures to reverse`)

      // Group first half fixtures by gameweek
      const firstHalfByGameweek: Record<number, Fixture[]> = {}
      firstHalfFixtures.forEach((fixture) => {
        if (!firstHalfByGameweek[fixture.gameweek]) {
          firstHalfByGameweek[fixture.gameweek] = []
        }
        firstHalfByGameweek[fixture.gameweek].push(fixture)
      })

      // Create reversed fixtures for each gameweek
      for (let gameweek = 1; gameweek <= baseRounds; gameweek++) {
        const originalFixtures = firstHalfByGameweek[gameweek] || []

        originalFixtures.forEach((originalFixture) => {
          // Create reversed fixture (home/away swapped)
          const reversedFixture: Fixture = {
            id: `fixture-${fixtureId}`,
            gameweek: baseRounds + gameweek, // Second half gameweek numbers
            player1: originalFixture.player2, // Swap players for home/away
            player2: originalFixture.player1, // Swap players for home/away
          }

          newFixtures.push(reversedFixture)
          fixtureId++
        })

        console.log(`Round ${baseRounds + gameweek} (Away): Generated ${originalFixtures.length} reversed matches`)
      }
    }

    console.log(`Total fixtures generated: ${newFixtures.length}`)
    setFixtures(newFixtures)
  }

  // Add new player
  const addPlayer = () => {
    if (!newPlayerName.trim()) return

    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      name: newPlayerName.trim(),
      image: null,
    }

    setPlayers([...players, newPlayer])
    setNewPlayerName("")
  }

  // Remove player
  const removePlayer = (playerId: string) => {
    setPlayers(players.filter((p) => p.id !== playerId))
    setFixtures([]) // Clear fixtures when players change
  }

  // Handle image upload
  const handleImageUpload = (playerId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string
      setPlayers(players.map((p) => (p.id === playerId ? { ...p, image: imageUrl } : p)))
    }
    reader.readAsDataURL(file)
  }

  // Download fixture as image
  const downloadFixture = async (fixture: Fixture) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = 1200
    canvas.height = 800

    try {
      // Try to load background image with fallback
      await loadBackgroundImage(ctx, canvas.width, canvas.height)

      // Draw fixture and wait for all images to load
      await drawFixture(ctx, fixture)

      // Download
      const link = document.createElement("a")
      link.download = `${fixture.player1.name}-vs-${fixture.player2.name}-GW${fixture.gameweek}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error("Error generating fixture:", error)
    }
  }

  // Download gameweek poster (all matches in one image)
  const downloadGameweekPoster = async (gameweek: number, gameweekFixtures: Fixture[]) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size to match reference images
    canvas.width = 1920
    canvas.height = 1080

    try {
      // Try to load background image with fallback
      await loadBackgroundImage(ctx, canvas.width, canvas.height)

      // Draw all fixtures for this gameweek and wait for completion
      await drawGameweekFixtures(ctx, gameweekFixtures, gameweek)

      // Download
      const link = document.createElement("a")
      link.download = `Gameweek-${gameweek}-Fixtures.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error("Error generating gameweek poster:", error)
    }
  }

  const downloadAllPosters = async () => {
    if (availableRounds.length === 0) return

    const zip = new JSZip()

    // Generate all posters and add to zip
    for (let i = 0; i < availableRounds.length; i++) {
      const gameweek = availableRounds[i]
      const gameweekFixtures = fixturesByGameweek[gameweek]

      if (gameweekFixtures) {
        const canvas = canvasRef.current
        if (!canvas) continue

        const ctx = canvas.getContext("2d")
        if (!ctx) continue

        // Set canvas size
        canvas.width = 1920
        canvas.height = 1080

        try {
          // Generate poster
          await loadBackgroundImage(ctx, canvas.width, canvas.height)
          await drawGameweekFixtures(ctx, gameweekFixtures, gameweek)

          // Convert canvas to blob and add to zip
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
              resolve(blob!)
            }, "image/png")
          })

          zip.file(`Gameweek-${gameweek}-Fixtures.png`, blob)
        } catch (error) {
          console.error(`Error generating gameweek ${gameweek} poster:`, error)
        }
      }
    }

    // Generate and download zip file
    try {
      const zipBlob = await zip.generateAsync({ type: "blob" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(zipBlob)
      link.download = `All-Fixture-Posters.zip`
      link.click()

      // Clean up object URL
      setTimeout(() => URL.revokeObjectURL(link.href), 100)
    } catch (error) {
      console.error("Error creating zip file:", error)
    }
  }

  // Load background image with fallback
  const loadBackgroundImage = async (ctx: CanvasRenderingContext2D, width: number, height: number): Promise<void> => {
    return new Promise((resolve) => {
      const bgImg = new Image()
      bgImg.crossOrigin = "anonymous"

      bgImg.onload = () => {
        try {
          // Draw background image
          ctx.drawImage(bgImg, 0, 0, width, height)

          // Add dark overlay for better text visibility
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
          ctx.fillRect(0, 0, width, height)

          resolve()
        } catch (error) {
          console.error("Error drawing background image:", error)
          drawFallbackBackground(ctx, width, height)
          resolve()
        }
      }

      bgImg.onerror = () => {
        console.warn("Background image failed to load, using fallback")
        drawFallbackBackground(ctx, width, height)
        resolve()
      }

      // Use the new UEFA Champions League background
      bgImg.src = "/fixture-bg.jpg"
    })
  }

  // Draw fallback background when image fails to load
  const drawFallbackBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Create gradient background similar to Champions League theme
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, "#1e3a8a") // Dark blue
    gradient.addColorStop(0.5, "#3730a3") // Purple-blue
    gradient.addColorStop(1, "#1e40af") // Blue

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Add some texture with subtle overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
    ctx.fillRect(0, 0, width, height)
  }

  // Draw fixture on canvas
  const drawFixture = async (ctx: CanvasRenderingContext2D, fixture: Fixture) => {
    const centerX = 600
    const centerY = 400

    // Draw VS text
    ctx.fillStyle = "#64748b"
    ctx.font = "bold 48px 'Space Grotesk', Arial, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("VS", centerX, centerY + 15)

    // Draw gameweek info
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 32px 'Space Grotesk', Arial, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(`GAMEWEEK ${fixture.gameweek}`, centerX, 150)

    // Wait for both players to be drawn
    await Promise.all([
      drawPlayer(ctx, fixture.player1, centerX - 300, centerY, "left"),
      drawPlayer(ctx, fixture.player2, centerX + 300, centerY, "right"),
    ])
  }

  // Draw all fixtures for a gameweek
  const drawGameweekFixtures = async (ctx: CanvasRenderingContext2D, fixtures: Fixture[], gameweek: number) => {
    const centerX = 960 // Center of 1920px canvas

    const headerRadius = 80
    const headerY = 120

    // Main header circle background
    ctx.fillStyle = "rgba(30, 64, 175, 0.95)" // Blue circle
    ctx.beginPath()
    ctx.arc(centerX, headerY, headerRadius, 0, Math.PI * 2)
    ctx.fill()

    // Header border
    ctx.strokeStyle = "rgba(59, 130, 246, 0.8)"
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 24px 'Space Grotesk', Arial, sans-serif"
    ctx.textAlign = "center"

    // Show GW number on first line
    ctx.fillText(`GW ${gameweek}`, centerX, headerY - 8)

    // Show Round number on second line
    ctx.font = "bold 16px 'DM Sans', Arial, sans-serif"
    ctx.fillStyle = "#e2e8f0"
    // ctx.fillText(`Round ${gameweek}`, centerX, headerY + 12)
    ctx.fillText(roundTitle, centerX, headerY + 12)

    const topPadding = 300
    const bottomPadding = 200
    const ballRadius = 60
    const ballReservedSpace = ballRadius + 40 // Extra padding around ball
    const availableHeight = 1080 - topPadding - bottomPadding - ballReservedSpace

    const totalContentHeight = fixtures.length * 80 + (fixtures.length - 1) * 20
    const extraSpace = Math.max(0, availableHeight - totalContentHeight)
    const matchSpacing = Math.max(15, 20 + Math.floor(extraSpace / (fixtures.length + 1))) // Minimum 15px spacing

    const startY = topPadding + Math.floor(extraSpace / 2)

    console.log(`Drawing ${fixtures.length} fixtures for gameweek ${gameweek}`)
    console.log(`Reserved space for ball: ${ballReservedSpace}px, available height: ${availableHeight}px`)

    const ballY = 1080 - bottomPadding / 2
    await drawChampionsLeagueBall(ctx, centerX, ballY)

    const matchPromises = fixtures.map((fixture, index) => {
      const matchY = startY + index * (80 + matchSpacing)
      return drawSingleMatch(ctx, fixture, centerX, matchY)
    })

    await Promise.all(matchPromises)
  }

  // Draw individual match in the gameweek poster
  const drawSingleMatch = async (ctx: CanvasRenderingContext2D, fixture: Fixture, centerX: number, y: number) => {
    const vsRadius = 35

    const gradient = ctx.createRadialGradient(centerX, y, 0, centerX, y, vsRadius)
    gradient.addColorStop(0, "#60a5fa") // Lighter blue center
    gradient.addColorStop(0.7, "#3b82f6") // Medium blue
    gradient.addColorStop(1, "#1e40af") // Darker blue edge

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(centerX, y, vsRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.shadowColor = "rgba(59, 130, 246, 0.5)"
    ctx.shadowBlur = 10
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    ctx.strokeStyle = "#93c5fd"
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0

    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(centerX, y, vsRadius - 3, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 20px 'Space Grotesk', Arial, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
    ctx.shadowBlur = 2
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1

    ctx.fillText("VS", centerX, y)

    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    await Promise.all([
      drawPlayerInGameweek(ctx, fixture.player1, centerX - 380, y, "left"),
      drawPlayerInGameweek(ctx, fixture.player2, centerX + 380, y, "right"),
    ])
  }

  // Draw individual player
  const drawPlayer = async (
    ctx: CanvasRenderingContext2D,
    player: Player,
    x: number,
    y: number,
    side: "left" | "right",
  ) => {
    const bannerWidth = 350
    const bannerHeight = 80
    const bannerX = side === "left" ? x - bannerWidth / 2 : x - bannerWidth / 2
    const bannerY = y - bannerHeight / 2

    ctx.fillStyle = "#1e40af"
    ctx.fillRect(bannerX, bannerY, bannerWidth, bannerHeight)

    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 3
    ctx.strokeRect(bannerX, bannerY, bannerWidth, bannerHeight)

    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 28px 'DM Sans', Arial, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(player.name.toUpperCase(), x, y + 8)

    if (player.image) {
      const img = new Image()
      img.crossOrigin = "anonymous"

      return new Promise<void>((resolve) => {
        img.onload = () => {
          const imgSize = 100
          const imgX = side === "left" ? bannerX - imgSize - 20 : bannerX + bannerWidth + 20
          const imgY = bannerY - 10

          ctx.save()
          ctx.beginPath()
          ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(img, imgX, imgY, imgSize, imgSize)
          ctx.restore()

          ctx.strokeStyle = "#ffffff"
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2)
          ctx.stroke()

          resolve()
        }
        img.onerror = () => resolve()
        img.src = player.image
      })
    } else {
      return Promise.resolve()
    }
  }

  // Draw individual player in gameweek poster
  const drawPlayerInGameweek = async (
    ctx: CanvasRenderingContext2D,
    player: Player,
    x: number,
    y: number,
    side: "left" | "right",
  ) => {
    const bannerWidth = 400
    const bannerHeight = 60
    const bannerX = side === "left" ? x - bannerWidth : x
    const bannerY = y - bannerHeight / 2

    ctx.fillStyle = "#1e40af"
    ctx.fillRect(bannerX, bannerY, bannerWidth, bannerHeight)

    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 2
    ctx.strokeRect(bannerX, bannerY, bannerWidth, bannerHeight)

    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 24px 'DM Sans', Arial, sans-serif"
    ctx.textAlign = side === "left" ? "right" : "left"
    const textX = side === "left" ? bannerX + bannerWidth - 20 : bannerX + 20
    ctx.fillText(player.name.toUpperCase(), textX, y + 8)

    if (player.image) {
      const img = new Image()
      img.crossOrigin = "anonymous"

      return new Promise<void>((resolve) => {
        img.onload = () => {
          const imgSize = 80
          const imgX = side === "left" ? bannerX - imgSize - 10 : bannerX + bannerWidth + 10
          const imgY = y - imgSize / 2

          ctx.save()
          ctx.beginPath()
          ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(img, imgX, imgY, imgSize, imgSize)
          ctx.restore()

          ctx.strokeStyle = "#ffffff"
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2)
          ctx.stroke()

          resolve()
        }
        img.onerror = () => resolve()
        img.src = player.image
      })
    } else {
      return Promise.resolve()
    }
  }

  // Draw Champions League ball
  const drawChampionsLeagueBall = async (ctx: CanvasRenderingContext2D, centerX: number, y: number) => {
    const ballRadius = 60

    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(centerX, y, ballRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = "#cccccc"
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = "#1e40af"
    ctx.font = "bold 16px 'Space Grotesk', Arial, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("★", centerX, y - 20)
    ctx.fillText("★", centerX - 25, y + 10)
    ctx.fillText("★", centerX + 25, y + 10)
    ctx.fillText("★", centerX - 15, y + 25)
    ctx.fillText("★", centerX + 15, y + 25)
  }

  // Group fixtures by gameweek
  const fixturesByGameweek = fixtures.reduce(
    (acc, fixture) => {
      if (!acc[fixture.gameweek]) acc[fixture.gameweek] = []
      acc[fixture.gameweek].push(fixture)
      return acc
    },
    {} as Record<number, Fixture[]>,
  )

  const availableRounds = Object.keys(fixturesByGameweek)
    .map(Number)
    .sort((a, b) => a - b)

  const getTotalMatches = () => {
    const baseMatches = (players.length * (players.length - 1)) / 2
    return homeAwayMode ? baseMatches * 2 : baseMatches
  }

  const getTotalGameweeks = () => {
    const baseGameweeks = players.length % 2 === 0 ? players.length - 1 : players.length
    return homeAwayMode ? baseGameweeks * 2 : baseGameweeks
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">Fixture Generator</h1>
          <p className="text-slate-300">Create dynamic tournament fixtures and download individual posters</p>
        </div>

        {/* Player Management */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Manage Players
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Player */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter player name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addPlayer()}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button onClick={addPlayer} className="bg-blue-600 hover:bg-blue-700">
                Add Player
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Enter round title (optional, e.g., 'Premier League', 'Champions Cup')"
                value={roundTitle}
                onChange={(e) => setRoundTitle(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button
                onClick={() => setRoundTitle("")}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Clear
              </Button>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
              <input
                type="checkbox"
                id="home-away-mode"
                checked={homeAwayMode}
                onChange={(e) => setHomeAwayMode(e.target.checked)}
                className="w-5 h-5 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
              />
              <Label htmlFor="home-away-mode" className="text-white font-medium cursor-pointer">
                Enable Home vs Away Mode
              </Label>
              <span className="text-slate-400 text-sm">(Each pair plays twice - doubles the fixtures)</span>
            </div>

            {/* Players List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((player) => (
                <Card key={player.id} className="bg-slate-700/50 border-slate-600">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{player.name}</span>
                      <Button size="sm" variant="destructive" onClick={() => removePlayer(player.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Player Image */}
                    <div className="space-y-2">
                      {player.image ? (
                        <img
                          src={player.image || "/placeholder.svg"}
                          alt={player.name}
                          className="w-16 h-16 rounded-full object-cover mx-auto"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-slate-600 mx-auto flex items-center justify-center">
                          <span className="text-slate-400 text-xs">No Image</span>
                        </div>
                      )}

                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(player.id, file)
                        }}
                        className="hidden"
                        id={`upload-${player.id}`}
                      />
                      <Label
                        htmlFor={`upload-${player.id}`}
                        className="cursor-pointer flex items-center justify-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <Upload className="w-3 h-3" />
                        Upload Image
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Generate Fixtures Button */}
            {players.length >= 2 && (
              <div className="space-y-2">
                <Button onClick={generateFixtures} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                  Generate Fixtures {homeAwayMode ? "(Home & Away)" : ""}
                </Button>
                <div className="text-center text-sm text-slate-400">
                  {players.length} players = {Math.floor(players.length / 2)} matches per gameweek ×{" "}
                  {getTotalGameweeks()} gameweeks = {getTotalMatches()} total matches
                  {homeAwayMode && (
                    <div className="text-xs text-blue-400 mt-1">
                      Home & Away: Each pair plays twice ({(players.length * (players.length - 1)) / 2} × 2)
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Round Selector - Always visible when fixtures exist */}
        {fixtures.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-6">
                <Label htmlFor="round-selector" className="text-white font-semibold text-lg">
                  Select GW:
                </Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Input
                      id="round-selector"
                      type="number"
                      min={1}
                      max={Math.max(...availableRounds)}
                      value={selectedRound}
                      onChange={(e) => setSelectedRound(Number(e.target.value))}
                      className="w-16 h-16 bg-blue-600 border-2 border-blue-400 text-white text-center text-xl font-bold rounded-full focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <span className="text-slate-300 text-lg">of {Math.max(...availableRounds)} rounds</span>
                </div>
                <div className="flex gap-3">
                  {fixturesByGameweek[selectedRound] && (
                    <Button
                      onClick={() => {
                        const roundFixtures = fixturesByGameweek[selectedRound]
                        if (roundFixtures) {
                          downloadGameweekPoster(selectedRound, roundFixtures)
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 px-6 py-3"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Download Round {selectedRound} Poster
                    </Button>
                  )}
                  <Button onClick={downloadAllPosters} className="bg-purple-600 hover:bg-purple-700 px-6 py-3">
                    <Download className="w-5 h-5 mr-2" />
                    Download All as ZIP ({availableRounds.length} posters)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fixtures Display */}
        {fixtures.length > 0 && (
          <div className="space-y-6">
            {Object.entries(fixturesByGameweek)
              .filter(([gameweek]) => Number(gameweek) === selectedRound)
              .map(([gameweek, gameweekFixtures]) => (
                <Card key={gameweek} className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                      <span>Gameweek {gameweek}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{gameweekFixtures.length} matches</Badge>
                        <Button
                          onClick={() => downloadGameweekPoster(Number.parseInt(gameweek), gameweekFixtures)}
                          className="bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Gameweek Poster
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {gameweekFixtures.map((fixture) => (
                        <Card key={fixture.id} className="bg-slate-700/50 border-slate-600">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {fixture.player1.image && (
                                  <img
                                    src={fixture.player1.image || "/placeholder.svg"}
                                    alt={fixture.player1.name}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                )}
                                <span className="text-white font-medium">{fixture.player1.name}</span>
                              </div>

                              <span className="text-slate-400 font-bold">VS</span>

                              <div className="flex items-center gap-3">
                                <span className="text-white font-medium">{fixture.player2.name}</span>
                                {fixture.player2.image && (
                                  <img
                                    src={fixture.player2.image || "/placeholder.svg"}
                                    alt={fixture.player2.name}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                )}
                              </div>
                            </div>

                            <Button
                              onClick={() => downloadFixture(fixture)}
                              className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                              size="sm"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download Individual Match
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* Hidden Canvas for Image Generation */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
