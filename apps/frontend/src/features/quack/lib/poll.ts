import type { Poll } from "@/features/quack/api/quackSchemas"

// Mirror the server-side limits so the form can tell the user before the
// request is made — the server still validates independently.
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 4
export const POLL_OPTION_MAX_LENGTH = 50
export const POLL_MIN_DURATION_MINUTES = 1
export const POLL_MAX_DURATION_MINUTES = 7 * 24 * 60
export const POLL_DEFAULT_DURATION_DAYS = 1

/** Whether the counts are in the data, i.e. the server let this viewer see them. */
export function hasCounts(poll: Poll): boolean {
  return poll.totalVotes !== null
}

/** Whole-number percentage of the votes, 0 when nobody has voted. */
export function percentOf(votes: number, total: number): number {
  return total === 0 ? 0 : Math.round((votes / total) * 100)
}

/**
 * The poll as it will look once a vote for `optionId` has gone through. Used
 * for the instant update; the server's answer replaces it a moment later.
 *
 * Counts that are still hidden stay hidden: guessing them would break the
 * promise that the numbers are right.
 */
export function applyVote(poll: Poll, optionId: string): Poll {
  if (!poll.canVote || poll.closed || poll.myVoteOptionId === optionId) return poll

  const previous = poll.myVoteOptionId
  const hasKnownCounts = hasCounts(poll)

  return {
    ...poll,
    myVoteOptionId: optionId,
    options: poll.options.map((option) => {
      if (!hasKnownCounts || option.votes === null) return option
      if (option.id === optionId) return { ...option, votes: option.votes + 1 }
      if (option.id === previous) return { ...option, votes: option.votes - 1 }
      return option
    }),
    totalVotes: hasKnownCounts && previous === null ? (poll.totalVotes ?? 0) + 1 : poll.totalVotes,
  }
}

/**
 * "45 min left", "1 h 30 min left", "2 d 3 h left", or "Closing..." if the
 * time is up but the server has not said so yet. Rounds up to the minute, so
 * it never says "0 min left" while the poll is still open.
 */
export function timeLeft(closesAt: Date, now: Date = new Date()): string {
  const remaining = closesAt.getTime() - now.getTime()
  if (remaining <= 0) return "Closing..."

  const minutes = Math.ceil(remaining / 60_000)
  const days = Math.floor(minutes / (24 * 60))
  const hours = Math.floor((minutes % (24 * 60)) / 60)
  const rest = minutes % 60

  if (days > 0) return hours > 0 ? `${days} d ${hours} h left` : `${days} d left`
  if (hours > 0) return rest > 0 ? `${hours} h ${rest} min left` : `${hours} h left`
  return `${rest} min left`
}

/** The length of a poll, from what the form collects. */
export function totalMinutes(days: string, hours: string, minutes: string): number {
  return (Number(days) * 24 + Number(hours)) * 60 + Number(minutes)
}
