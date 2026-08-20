"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Trash2, Download, Plus, Upload, Users, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import JSZip from "jszip"
import { dummyPlayers, dummyRoundTitle } from "@/lib/dummy-data"
import { renderGameweekPoster, renderMatchPoster } from "@/lib/poster-renderer"
import type { Fixture, Player } from "@/lib/types"

export default function FixtureGenerator() {
  const [players, setPlayers] = useState<Player[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [newPlayerName, setNewPlayerName] = useState("")
  const [selectedRound, setSelectedRound] = useState<number>(1)
  const [roundTitle, setRoundTitle] = useState("")
  const [homeAwayMode, setHomeAwayMode] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const generateFixtures = () => {
    if (players.length < 2) return

    const newFixtures: Fixture[] = []
    let fixtureId = 1

    const playerCount = players.length
    const isEven = playerCount % 2 === 0
    const totalPlayers = isEven ? playerCount : playerCount + 1
    const baseRounds = totalPlayers - 1

    const playersForScheduling = [...players]
    if (!isEven) {
      playersForScheduling.push({ id: "bye", name: "BYE", image: null, teamImage: null })
    }

    const firstHalfFixtures: Fixture[] = []

    for (let round = 0; round < baseRounds; round++) {
      const roundFixtures: Fixture[] = []

      for (let i = 0; i < totalPlayers / 2; i++) {
        const player1Index = i
        const player2Index = totalPlayers - 1 - i

        const player1 = playersForScheduling[player1Index]
        const player2 = playersForScheduling[player2Index]

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

      firstHalfFixtures.push(...roundFixtures)
      newFixtures.push(...roundFixtures)

      if (totalPlayers > 2) {
        const lastPlayer = playersForScheduling.pop()!
        playersForScheduling.splice(1, 0, lastPlayer)
      }
    }

    if (homeAwayMode) {
      const firstHalfByGameweek: Record<number, Fixture[]> = {}
      firstHalfFixtures.forEach((fixture) => {
        if (!firstHalfByGameweek[fixture.gameweek]) {
          firstHalfByGameweek[fixture.gameweek] = []
        }
        firstHalfByGameweek[fixture.gameweek].push(fixture)
      })

      for (let gameweek = 1; gameweek <= baseRounds; gameweek++) {
        const originalFixtures = firstHalfByGameweek[gameweek] || []

        originalFixtures.forEach((originalFixture) => {
          newFixtures.push({
            id: `fixture-${fixtureId}`,
            gameweek: baseRounds + gameweek,
            player1: originalFixture.player2,
            player2: originalFixture.player1,
          })
          fixtureId++
        })
      }
    }

    setSelectedRound(1)
    setFixtures(newFixtures)
  }

  const addPlayer = () => {
    if (!newPlayerName.trim()) return

    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      name: newPlayerName.trim(),
      image: null,
      teamImage: null,
    }

    setPlayers([...players, newPlayer])
    setNewPlayerName("")
  }

  const updatePlayer = (playerId: string, updates: Partial<Omit<Player, "id">>) => {
    const applyUpdate = (player: Player) => (player.id === playerId ? { ...player, ...updates } : player)
    setPlayers((current) => current.map(applyUpdate))
    setFixtures((current) =>
      current.map((fixture) => ({
        ...fixture,
        player1: applyUpdate(fixture.player1),
        player2: applyUpdate(fixture.player2),
      })),
    )
  }

  const handleImageUpload = (playerId: string, file: File, imageType: "player" | "team") => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string
      updatePlayer(playerId, { [imageType === "player" ? "image" : "teamImage"]: imageUrl })
    }
    reader.readAsDataURL(file)
  }

  const removePlayer = (playerId: string) => {
    setPlayers(players.filter((p) => p.id !== playerId))
    setFixtures([])
  }

  const addDummyPlayers = () => {
    const existingIds = new Set(players.map((player) => player.id))
    const playersToAdd = dummyPlayers.filter((player) => !existingIds.has(player.id))
    if (playersToAdd.length === 0) return

    setPlayers([...players, ...playersToAdd])
    setFixtures([])
    setSelectedRound(1)
    if (!roundTitle.trim()) {
      setRoundTitle(dummyRoundTitle)
    }
  }

  const downloadFixture = async (fixture: Fixture) => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      await renderMatchPoster(canvas, fixture)
      const link = document.createElement("a")
      link.download = `${fixture.player1.name}-vs-${fixture.player2.name}-GW${fixture.gameweek}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (error) {
      console.error("Error generating fixture:", error)
    }
  }

  const downloadGameweekPoster = async (gameweek: number, gameweekFixtures: Fixture[]) => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      await renderGameweekPoster(canvas, gameweekFixtures, gameweek, roundTitle)
      const link = document.createElement("a")
      link.download = `Gameweek-${gameweek}-Fixtures.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (error) {
      console.error("Error generating gameweek poster:", error)
    }
  }

  const downloadAllPosters = async () => {
    if (availableRounds.length === 0) return

    const zip = new JSZip()
    const canvas = canvasRef.current
    if (!canvas) return

    for (const gameweek of availableRounds) {
      const gameweekFixtures = fixturesByGameweek[gameweek]
      if (!gameweekFixtures) continue

      try {
        await renderGameweekPoster(canvas, gameweekFixtures, gameweek, roundTitle)
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => {
            if (result) resolve(result)
            else reject(new Error("Failed to create poster blob"))
          }, "image/png")
        })
        zip.file(`Gameweek-${gameweek}-Fixtures.png`, blob)
      } catch (error) {
        console.error(`Error generating gameweek ${gameweek} poster:`, error)
      }
    }

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(zipBlob)
      link.download = `All-Fixture-Posters.zip`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 100)
    } catch (error) {
      console.error("Error creating zip file:", error)
    }
  }

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
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">Fixture Generator</h1>
          <p className="text-slate-300">Create dynamic tournament fixtures and download individual posters</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Manage Players
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Button
                onClick={addDummyPlayers}
                disabled={dummyPlayers.every((player) => players.some((existing) => existing.id === player.id))}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Users className="w-4 h-4" />
                Add Dummy Players
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {players.map((player) => (
                <Card key={player.id} className="bg-slate-700/50 border-slate-600">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={player.name}
                        onChange={(e) => updatePlayer(player.id, { name: e.target.value })}
                        onBlur={() => {
                          const trimmed = player.name.trim()
                          updatePlayer(player.id, { name: trimmed || "Player" })
                        }}
                        className="bg-slate-700 border-slate-600 text-white font-medium"
                        aria-label="Player name"
                      />
                      <Button size="sm" variant="destructive" onClick={() => removePlayer(player.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm font-medium">Player Image</Label>
                      <div className="relative w-16 h-16 mx-auto">
                        {player.image ? (
                          <>
                            <img
                              src={player.image || "/placeholder.svg"}
                              alt={player.name}
                              className="w-16 h-16 rounded-full object-cover"
                            />
                            {player.teamImage && (
                              <img
                                src={player.teamImage || "/placeholder.svg"}
                                alt={`${player.name} team`}
                                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full object-cover border-2 border-white bg-white"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => updatePlayer(player.id, { image: null })}
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900 text-slate-200 border border-slate-500 flex items-center justify-center"
                              aria-label={`Remove ${player.name} image`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center">
                            <span className="text-slate-400 text-xs">No Image</span>
                          </div>
                        )}
                      </div>

                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(player.id, file, "player")
                          e.target.value = ""
                        }}
                        className="hidden"
                        id={`upload-player-${player.id}`}
                      />
                      <Label
                        htmlFor={`upload-player-${player.id}`}
                        className="cursor-pointer flex items-center justify-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <Upload className="w-3 h-3" />
                        {player.image ? "Change Player Image" : "Upload Player Image"}
                      </Label>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm font-medium">Team Logo</Label>
                      <div className="relative w-12 h-12 mx-auto">
                        {player.teamImage ? (
                          <>
                            <img
                              src={player.teamImage || "/placeholder.svg"}
                              alt={`${player.name} team`}
                              className="w-12 h-12 rounded-full object-cover border-2 border-slate-500"
                            />
                            <button
                              type="button"
                              onClick={() => updatePlayer(player.id, { teamImage: null })}
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900 text-slate-200 border border-slate-500 flex items-center justify-center"
                              aria-label={`Remove ${player.name} team logo`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center">
                            <span className="text-slate-400 text-xs">No Logo</span>
                          </div>
                        )}
                      </div>

                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(player.id, file, "team")
                          e.target.value = ""
                        }}
                        className="hidden"
                        id={`upload-team-${player.id}`}
                      />
                      <Label
                        htmlFor={`upload-team-${player.id}`}
                        className="cursor-pointer flex items-center justify-center gap-1 text-xs text-green-400 hover:text-green-300"
                      >
                        <Upload className="w-3 h-3" />
                        {player.teamImage ? "Change Team Logo" : "Upload Team Logo"}
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

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

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
