export interface Player {
  id: string
  name: string
  image: string | null
  teamImage: string | null
}

export interface Fixture {
  id: string
  gameweek: number
  player1: Player
  player2: Player
}
