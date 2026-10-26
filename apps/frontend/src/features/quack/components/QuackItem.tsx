import { MoodLabel } from "@/components/MoodLabel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDate } from "@/lib/date"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { DeleteQuackButton } from "@/features/quack/components/DeleteQuackButton"
import { Highlighted } from "@/features/quack/components/Highlighted"
import { QuackPoll } from "@/features/quack/components/QuackPoll"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type QuackItemProps = {
  quack: Quack
  // Words of the active search, highlighted wherever they match.
  highlight?: string[]
  // Whether to offer the Delete action. A convenience only: the server checks too.
  canDelete?: boolean
}

export function QuackItem({ quack, highlight = [], canDelete = false }: QuackItemProps) {
  const { name, username } = quack.user

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <article className="flex w-full gap-4 border-b border-border pt-2 pb-4 last:border-b-0">
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
          {canDelete ? <DeleteQuackButton quackId={quack.id} /> : null}
        </div>
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
      </div>
    </article>
  )
}
