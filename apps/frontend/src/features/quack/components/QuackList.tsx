import { Loader2, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { toSearchWords } from "@/features/quack/api/quackSearch"
import { QuackItem } from "@/features/quack/components/QuackItem"

type QuackListProps = {
  quacks: Quack[]
  isLoading?: boolean
  error?: Error
  onReload?: () => void
  // The active search, if any. Switches on highlighting, the count line and
  // the "nothing matches" state.
  search?: string
  onClearSearch?: () => void
  // The quacks shown belong to an earlier search; the new ones are loading.
  isStale?: boolean
  // The signed-in user. Their own quacks get a Delete action.
  currentUserId?: string
  // Showing only the signed-in user's quacks (the Mine tab).
  isMine?: boolean
  // Empty Mine tab: takes the user to the place where they can post.
  onWriteFirst?: () => void
}

export function QuackList({
  quacks,
  isLoading,
  error,
  onReload,
  search,
  onClearSearch,
  isStale,
  currentUserId,
  isMine,
  onWriteFirst,
}: QuackListProps) {
  const words = toSearchWords(search)
  const isBusy = (isStale ?? false) || (isLoading ?? false)
  const shouldShowCount = search !== undefined && !isStale && !error && quacks.length > 0

  return (
    <div
      className="flex flex-col"
      aria-busy={isBusy}
    >
      {/* Always in the page while a search is active, so screen readers
          announce the text each time it changes. */}
      {search !== undefined ? (
        <p
          role="status"
          className="mb-2 text-sm text-muted-foreground"
        >
          {shouldShowCount
            ? quacks.length === 1
              ? `1 quack matches "${search}"`
              : `${quacks.length} quacks match "${search}"`
            : null}
        </p>
      ) : null}

      {isLoading && quacks.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : null}

      {error ? (
        <Alert
          variant="destructive"
          className="mb-4"
        >
          <AlertTitle>Couldn&apos;t load quacks</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error.message}</span>
            {onReload ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onReload}
              >
                <RefreshCw className="size-4" />
                Reload
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !isStale && !error && quacks.length === 0 ? (
        search !== undefined ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">No quacks match &quot;{search}&quot;.</p>
            {onClearSearch ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearSearch}
              >
                Clear search
              </Button>
            ) : null}
          </div>
        ) : isMine ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">You haven&apos;t posted any quacks yet.</p>
            {onWriteFirst ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onWriteFirst}
              >
                Write your first quack
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No quacks yet. Post the first one.
          </p>
        )
      ) : null}

      <div className={cn(isStale && "opacity-60 transition-opacity")}>
        {quacks.map((quack) => (
          <QuackItem
            key={quack.id}
            quack={quack}
            highlight={words}
            canDelete={currentUserId !== undefined && quack.userId === currentUserId}
          />
        ))}
      </div>
    </div>
  )
}
