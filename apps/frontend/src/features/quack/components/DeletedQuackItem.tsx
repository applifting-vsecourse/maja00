import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type DeletedQuackItemProps = {
  // e.g. a link to the replies that are still there
  footer?: ReactNode
  className?: string
}

// What is left of a deleted quack that has replies. The server sends nothing
// else about it — no text, author, time or poll — so there is nothing else to show.
export function DeletedQuackItem({ footer, className }: DeletedQuackItemProps) {
  return (
    <article
      className={cn(
        "flex w-full flex-wrap items-center gap-2 border-b border-border pt-2 pb-4 last:border-b-0",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground italic">This quack was deleted</p>
      {footer}
    </article>
  )
}
