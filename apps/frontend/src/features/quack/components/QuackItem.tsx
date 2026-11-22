import type { ReactNode } from "react"

import { MoodLabel } from "@/components/MoodLabel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDate } from "@/lib/date"
import { cn } from "@/lib/utils"

import type { LiveQuack, QuackParent } from "@/features/quack/api/quackSchemas"
import { DeleteQuackButton } from "@/features/quack/components/DeleteQuackButton"
import { Highlighted } from "@/features/quack/components/Highlighted"
import { QuackPoll } from "@/features/quack/components/QuackPoll"
import { ReplyingTo } from "@/features/quack/components/ReplyingTo"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type QuackItemProps = {
  quack: LiveQuack
  // Words of the active search, highlighted wherever they match.
  highlight?: string[]
  // Whether to offer the Delete action. A convenience only: the server checks too.
  canDelete?: boolean
  // The Delete action is a moderator's, not the author's.
  isModeration?: boolean
  // Set: show which quack this one answers, as a link to its thread.
  replyingTo?: QuackParent | null
  // Actions under the text: a link to the replies, or a Reply button.
  footer?: ReactNode
  // Extra classes for the article, e.g. to mark the opened quack of a thread.
  className?: string
}

export function QuackItem({
  quack,
  highlight = [],
  canDelete = false,
  isModeration = false,
  replyingTo,
  footer,
  className,
}: QuackItemProps) {
  const { name, username } = quack.user

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <article
      className={cn(
        "flex w-full gap-4 border-b border-border pt-2 pb-4 last:border-b-0",
        className,
      )}
    >
      <Avatar className="size-12">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span>
            <UsersName
              name={name}
              highlight={highlight}
            />{" "}
            <UsersUserName
              username={username}
              highlight={highlight}
            />
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>
          {quack.mood ? (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <MoodLabel
                mood={quack.mood}
                className="text-xs text-muted-foreground"
              />
            </>
          ) : null}
          {canDelete ? (
            <DeleteQuackButton
              quackId={quack.id}
              isModeration={isModeration}
              replyCount={quack.replyCount}
            />
          ) : null}
        </div>
        {replyingTo ? <ReplyingTo parent={replyingTo} /> : null}
        <p className="text-sm break-words whitespace-pre-line">
          <Highlighted
            text={quack.text}
            words={highlight}
          />
        </p>
        {quack.poll ? (
          <QuackPoll
            quackId={quack.id}
            poll={quack.poll}
          />
        ) : null}
        {footer ? <div className="flex items-center gap-2 pt-1">{footer}</div> : null}
      </div>
    </article>
  )
}
