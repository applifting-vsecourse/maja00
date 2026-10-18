import { quackMoodSchema, type QuackMood } from "@/lib/quack-moods"

export type SessionUser = {
  id: string
  email: string
  name: string
  // The spelling the user typed ("Duck.Fan"); the stored username is lowercase.
  username: string
  role?: string
  bio: string | null
  defaultMood: QuackMood | null
}

type ServerUser = {
  id: string
  email: string
  name: string
  username?: string | null
  displayUsername?: string | null
  role?: string | null
  bio?: string | null
  defaultMood?: string | null
}

/** Flattens the user BetterAuth returns into what the app works with. */
export function toSessionUser(user: ServerUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.displayUsername ?? user.username ?? "",
    role: user.role ?? undefined,
    bio: user.bio ?? null,
    // An unknown value (e.g. a mood added on the server first) means "no mood".
    defaultMood: quackMoodSchema
      .nullable()
      .catch(null)
      .parse(user.defaultMood ?? null),
  }
}
