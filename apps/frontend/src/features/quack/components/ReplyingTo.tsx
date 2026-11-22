import { Link } from "@tanstack/react-router"

import type { QuackParent } from "@/features/quack/api/quackSchemas"

type ReplyingToProps = {
  parent: QuackParent
}

// "Replying to @name", linking to the thread of the quack replied to.
export function ReplyingTo({ parent }: ReplyingToProps) {
  return (
    <p className="text-xs text-muted-foreground">
      <Link
        to="/quacks/$quackId"
        params={{ quackId: parent.id }}
        className="hover:underline"
      >
        {parent.deleted || parent.username === null
          ? "Replying to a deleted quack"
          : `Replying to @${parent.username}`}
      </Link>
    </p>
  )
}
