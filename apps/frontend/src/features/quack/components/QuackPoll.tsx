import { Check } from "lucide-react"

import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import type { Poll } from "@/features/quack/api/quackSchemas"
import { useVoteOnPoll, voteErrorMessage } from "@/features/quack/hooks/useVoteOnPoll"
import { hasCounts, percentOf, timeLeft } from "@/features/quack/lib/poll"

type QuackPollProps = {
  quackId: string
  poll: Poll
}

type OptionBodyProps = {
  text: string
  votes: number | null
  total: number | null
  isMine: boolean
  // The viewer has picked, but the server's counts have not arrived yet.
  isPending: boolean
}

function OptionBody({ text, votes, total, isMine, isPending }: OptionBodyProps) {
  const percent = votes !== null && total !== null ? percentOf(votes, total) : null

  return (
    <span className="flex w-full flex-col gap-1">
      <span className="flex items-baseline justify-between gap-3">
        <span className={cn("flex items-center gap-2 text-sm", isMine && "font-medium")}>
          {isMine ? (
            <Check
              className="size-4 shrink-0"
              aria-hidden="true"
            />
          ) : null}
          {text}
          {isMine ? <span className="sr-only">(your vote)</span> : null}
        </span>
        {votes !== null && percent !== null ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {votes} · {percent}%
          </span>
        ) : isPending ? (
          <Skeleton className="h-4 w-12" />
        ) : null}
      </span>
      {percent !== null ? (
        <Progress
          value={percent}
          aria-label={`${text}: ${percent}%`}
        />
      ) : null}
    </span>
  )
}

function summary(poll: Poll): string {
  const hasVisibleCounts = hasCounts(poll)
  const votes = poll.totalVotes ?? 0
  const parts: string[] = []
  if (hasVisibleCounts) parts.push(votes === 1 ? "1 vote" : `${votes} votes`)
  else if (poll.canVote) parts.push("Vote to see the results")
  parts.push(poll.closed ? "Closed" : timeLeft(poll.closesAt))
  return parts.join(" · ")
}

export function QuackPoll({ quackId, poll }: QuackPollProps) {
  const vote = useVoteOnPoll()
  const isPending = poll.myVoteOptionId !== null && !hasCounts(poll)

  return (
    <div className="mt-2 flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {poll.options.map((option) => {
          const isMine = option.id === poll.myVoteOptionId
          const body = (
            <OptionBody
              text={option.text}
              votes={option.votes}
              total={poll.totalVotes}
              isMine={isMine}
              isPending={isPending}
            />
          )

          return (
            <li key={option.id}>
              {poll.canVote ? (
                <button
                  type="button"
                  aria-pressed={isMine}
                  // Not `disabled`: that would dim every option for the moment
                  // a vote is in flight. Extra clicks are just ignored.
                  onClick={() => {
                    if (vote.isPending || isMine) return
                    vote.mutate({ quackId, optionId: option.id })
                  }}
                  className={cn(
                    "flex w-full rounded-md border border-border px-3 py-2 text-left transition-colors",
                    "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isMine && "bg-accent",
                  )}
                >
                  {body}
                </button>
              ) : (
                <div
                  className={cn(
                    "flex w-full rounded-md border border-border px-3 py-2",
                    isMine && "bg-accent",
                  )}
                >
                  {body}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-muted-foreground">{summary(poll)}</p>

      {vote.error ? (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {voteErrorMessage(vote.error)}
        </p>
      ) : null}
    </div>
  )
}
