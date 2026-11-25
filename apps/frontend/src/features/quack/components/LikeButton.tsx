import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useLikeQuack } from "@/features/quack/hooks/useLikeQuack"

type LikeButtonProps = {
  quackId: string
  likeCount: number
  likedByMe: boolean
}

export function likeLabel(likeCount: number, isLiked: boolean): string {
  const count = likeCount === 1 ? "1 like" : `${likeCount} likes`
  return `${isLiked ? "Unlike" : "Like"}, ${count}`
}

// A duck seen from the side. lucide has no duck; stroke style matches its icons.
function DuckIcon({ isFilled, className }: { isFilled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={isFilled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M8 4.5a3.5 3.5 0 0 1 6.7 1.4l-.2 1.1h3.2l-2.1 2.2c2.4.6 4.4 2.4 4.4 5.3 0 3.4-3.1 5.5-7.5 5.5H9c-3.9 0-6.5-2.2-6.5-5.4 0-1.6.7-2.6 1.8-2.6 1.1 0 1.9.9 3.4.9 1 0 1.6-.6 1.6-1.3 0-.8-.8-1.4-1.3-2.6A3.6 3.6 0 0 1 8 4.5Z" />
    </svg>
  )
}

// The duck: likes a quack, or takes the like back. See cases.md.
export function LikeButton({ quackId, likeCount, likedByMe: isLiked }: LikeButtonProps) {
  const { mutate } = useLikeQuack(quackId)

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={isLiked}
      aria-label={likeLabel(likeCount, isLiked)}
      onClick={() => mutate({ shouldLike: !isLiked })}
      className={cn("-ml-2", isLiked ? "text-like hover:text-like" : "text-muted-foreground")}
    >
      <DuckIcon
        isFilled={isLiked}
        className="size-4"
      />
      {likeCount > 0 ? likeCount : null}
    </Button>
  )
}
