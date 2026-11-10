import { Link } from "@tanstack/react-router"
import { MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

type RepliesLinkProps = {
  quackId: string
  replyCount: number
}

export function repliesLabel(replyCount: number): string {
  if (replyCount === 0) return "Reply"
  return replyCount === 1 ? "1 reply" : `${replyCount} replies`
}

// Opens the thread of a quack: its replies, and the place to add one.
export function RepliesLink({ quackId, replyCount }: RepliesLinkProps) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="-ml-2 text-muted-foreground"
    >
      <Link
        to="/quacks/$quackId"
        params={{ quackId }}
      >
        <MessageCircle className="size-4" />
        {repliesLabel(replyCount)}
      </Link>
    </Button>
  )
}
