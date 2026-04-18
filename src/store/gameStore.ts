'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Movie, movies } from '@/data/movies'

export interface GameResult {
  date: string
  score: number
  mode: string
  correct: number
}

export interface LeaderboardEntry {
  name: string
  score: number
  isCurrentUser: boolean
  isTwitch: boolean
}

interface GameStore {
  username: string
  twitchLogin: string
  isTwitchAuth: boolean
  gamesPlayed: number
  bestScore: number
  history: GameResult[]
  isPlaying: boolean
  currentQuestion: number
  score: number
  hintsUsed: number
  questions: Movie[]
  answers: (boolean | null)[]
  setUsername: (name: string) => void
  loginWithTwitch: (twitchLogin: string) => void
  logout: () => void
  startGame: (mode: 'all' | 'film' | 'serial') => void
  answerQuestion: (answer: string) => boolean
  useHint: () => string | null
  nextQuestion: () => void
  endGame: () => void
  resetGame: () => void
  getLeaderboard: (period: 'day' | 'week' | 'all') => LeaderboardEntry[]
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function normalizeAnswer(answer: string): string {
  return answer.toLowerCase().trim().replace(/ё/g, 'е').replace(/[-:.,!?'"\s]+/g, ' ')
}

function checkAnswer(input: string, movie: Movie): boolean {
  const normalized = normalizeAnswer(input)
  for (const alias of movie.aliases) {
    const normAlias = normalizeAnswer(alias)
    if (normalized === normAlias) return true
    if (normalized.length >= 4 && (normalized.includes(normAlias) || normAlias.includes(normalized))) return true
  }
  return false
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      username: '',
      twitchLogin: '',
      isTwitchAuth: false,
      gamesPlayed: 0,
      bestScore: 0,
      history: [],
      isPlaying: false,
      currentQuestion: 0,
      score: 0,
      hintsUsed: 0,
      questions: [],
      answers: [],

      setUsername: (name) => set({ username: name }),

      loginWithTwitch: (twitchLogin) => set({ 
        username: twitchLogin, 
        twitchLogin, 
        isTwitchAuth: true 
      }),

      logout: () => set({ 
        username: '', 
        twitchLogin: '', 
        isTwitchAuth: false,
        gamesPlayed: 0,
        bestScore: 0,
        history: []
      }),

      startGame: (mode) => {
        const pool = mode === 'all' ? movies : movies.filter(m => m.type === mode)
        const questions = shuffle(pool).slice(0, 5)
        set({
          isPlaying: true,
          currentQuestion: 0,
          score: 0,
          hintsUsed: 0,
          questions,
          answers: []
        })
      },

      answerQuestion: (answer) => {
        const { questions, currentQuestion, score } = get()
        const movie = questions[currentQuestion]
        const isCorrect = checkAnswer(answer, movie)
        
        set((state) => ({
          score: isCorrect ? state.score + Math.max(2, 5 - state.hintsUsed) : state.score,
          answers: [...state.answers, isCorrect]
        }))
        
        return isCorrect
      },

      useHint: () => {
        const { questions, currentQuestion, hintsUsed } = get()
        if (hintsUsed >= 3) return null
        set({ hintsUsed: hintsUsed + 1 })
        return questions[currentQuestion].hints[hintsUsed]
      },

      nextQuestion: () => {
        const { currentQuestion, questions } = get()
        if (currentQuestion < questions.length - 1) {
          set({ currentQuestion: currentQuestion + 1, hintsUsed: 0 })
        } else {
          get().endGame()
        }
      },

      endGame: () => {
        const { score, bestScore, gamesPlayed, history, username } = get()
        const newHistory: GameResult = {
          date: new Date().toLocaleDateString('ru'),
          score,
          mode: 'all',
          correct: get().answers.filter(a => a === true).length
        }
        set({
          isPlaying: false,
          gamesPlayed: gamesPlayed + 1,
          bestScore: Math.max(score, bestScore),
          history: [newHistory, ...history].slice(0, 20)
        })
      },

      resetGame: () => set({
        isPlaying: false,
        currentQuestion: 0,
        score: 0,
        hintsUsed: 0,
        questions: [],
        answers: []
      }),

      getLeaderboard: (period) => {
        const { username, bestScore, isTwitchAuth, gamesPlayed, history } = get()
        
        const entries: LeaderboardEntry[] = []
        
        if (username && gamesPlayed > 0) {
          entries.push({ 
            name: username, 
            score: bestScore, 
            isCurrentUser: true,
            isTwitch: isTwitchAuth
          })
        }
        
        entries.sort((a, b) => b.score - a.score)
        return entries.slice(0, 20)
      }
    }),
    {
      name: 'emoji-cinema-storage'
    }
  )
)