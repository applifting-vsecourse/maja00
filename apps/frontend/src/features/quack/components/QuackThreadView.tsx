import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeft, Loader2, MessageCircle, RefreshCw } from "lucide-react"

import { ROUTES } from "@/app/routes"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { HTTPError } from "@/lib/api-client"
import type { QuackMood } from "@/lib/quack-moods"
import { cn } from "@/lib/utils"

import type { Quack, QuackParent } from "@/features/quack/api/quackSchemas"
import { threadQueryOptions } from "@/features/quack/api/threadQueryOptions"
import { DeletedQuackItem } from "@/features/quack/components/DeletedQuackItem"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackItem } from "@/features/quack/components/QuackItem"
import { RepliesLink } from "@/features/quack/components/RepliesLink"
import { buildReplyTree, MAX_INDENT_DEPTH, toParent } from "@/features/quack/lib/thread"

type QuackThreadViewProps = {
  quackId: string
  // The signed-in user. Their own quacks get a Delete action.
  currentUserId?: string
  // The signed-in user is a moderator: every quack gets a Delete action.
  canModerate?: boolean
  // The mood a reply starts with, from the user's settings.
  defaultMood?: QuackMood | null
}

// What every quack of the thread needs to know about the viewer and the page.
type ThreadContext = {
  currentUserId?: string
  canModerate: boolean
  defaultMood?: QuackMood | null
  // The one quack whose reply form is open; one at a time keeps one primary button.
  replyingToId: string | null
  setReplyingToId: (quackId: string | null) => void
}

export function QuackThreadView({
  quackId,
  currentUserId,
  canModerate = false,
  defaultMood,
}: QuackThreadViewProps) {
  const threadQuery = useQuery(threadQueryOptions(quackId))
  const [replyingToId, setReplyingToId] = useState<string | null>(null)

  const context: ThreadContext = {
    currentUserId,
    canModerate,
    defaultMood,
    replyingToId,
    setReplyingToId,
  }

  const backLink = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="mb-4 -ml-2 text-muted-foreground"
    >
      <Link to={ROUTES.quacks}>
        <ArrowLeft className="size-4" />
        All quacks
      </Link>
    </Button>
  )

  if (threadQuery.isLoading) {
    return (
      <>
        {backLink}
        <div
          className="flex items-center justify-center py-8 text-muted-foreground"
          aria-busy
        >
          <Loader2 className="size-5 animate-spin" />
        </div>
      </>
    )
  }

  if (threadQuery.error) {
    const isNotFound =
      threadQuery.error instanceof HTTPError && threadQuery.error.response.status === 404
    return (
      <>
        {backLink}
        {isNotFound ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            This quack doesn&apos;t exist. It may have been deleted.
          </p>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t load this thread</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{threadQuery.error.message}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void threadQuery.refetch()}
              >
                <RefreshCw className="size-4" />
                Reload
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </>
    )
  }

  if (!threadQuery.data) return null
  const { ancestors, focus, descendants } = threadQuery.data
  const childrenOf = buildReplyTree(descendants)
  const byId = new Map([focus, ...descendants].map((quack) => [quack.id, quack]))
  const replies = childrenOf.get(focus.id) ?? []

  return (
    <>
      {backLink}
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Thread</h1>

      {ancestors.length > 0 ? (
        <ol
          aria-label="Earlier in the thread"
          className="mb-2"
        >
          {ancestors.map((quack) => (
            <li key={quack.id}>
              <ThreadQuack
                quack={quack}
                context={context}
                // Context only: replying happens in that quack's own thread.
                footer={
                  <RepliesLink
                    quackId={quack.id}
                    replyCount={quack.replyCount}
                  />
                }
              />
            </li>
          ))}
        </ol>
      ) : null}

      <ThreadQuack
        quack={focus}
        context={context}
        className="rounded-lg bg-secondary px-3 pt-3"
      />

      <h2 className="mt-8 mb-2 text-lg font-semibold tracking-tight">
        {replies.length === 0 ? "Replies" : `Replies (${descendants.length})`}
      </h2>
      {replies.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          {focus.deleted ? "No replies left." : "No replies yet. Be the first to reply."}
        </p>
      ) : (
        <ol aria-label="Replies">
          {replies.map((reply) => (
            <ThreadNode
              key={reply.id}
              quack={reply}
              depth={1}
              childrenOf={childrenOf}
              byId={byId}
              context={context}
            />
          ))}
        </ol>
      )}
    </>
  )
}

type ThreadNodeProps = {
  quack: Quack
  // 1: a direct reply to the opened quack
  depth: number
  childrenOf: Map<string, Quack[]>
  byId: Map<string, Quack>
  context: ThreadContext
}

// A reply and everything under it. Indentation stops growing after a few
// levels; deeper replies say whom they answer instead.
function ThreadNode({ quack, depth, childrenOf, byId, context }: ThreadNodeProps) {
  const children = childrenOf.get(quack.id) ?? []
  const parent = quack.parentId ? byId.get(quack.parentId) : undefined

  return (
    <li>
      <ThreadQuack
        quack={quack}
        context={context}
        replyingTo={depth > MAX_INDENT_DEPTH && parent ? toParent(parent) : undefined}
      />
      {children.length > 0 ? (
        <ol className={cn(depth < MAX_INDENT_DEPTH && "ml-4 border-l border-border pl-4")}>
          {children.map((child) => (
            <ThreadNode
              key={child.id}
              quack={child}
              depth={depth + 1}
              childrenOf={childrenOf}
              byId={byId}
              context={context}
            />
          ))}
        </ol>
      ) : null}
    </li>
  )
}

type ThreadQuackProps = {
  quack: Quack
  context: ThreadContext
  replyingTo?: QuackParent
  // Replaces the Reply button.
  footer?: React.ReactNode
  className?: string
}

function ThreadQuack({ quack, context, replyingTo, footer, className }: ThreadQuackProps) {
  if (quack.deleted) {
    return <DeletedQuackItem className={className} />
  }
  const isOwn = context.currentUserId !== undefined && quack.userId === context.currentUserId
  const isReplying = context.replyingToId === quack.id

  return (
    <>
      <QuackItem
        quack={quack}
        canDelete={isOwn || context.canModerate}
        isModeration={!isOwn}
        replyingTo={replyingTo}
        className={className}
        footer={
          footer ?? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground"
              aria-expanded={isReplying}
              onClick={() => context.setReplyingToId(isReplying ? null : quack.id)}
            >
              <MessageCircle className="size-4" />
              Reply
            </Button>
          )
        }
      />
      {isReplying ? (
        <QuackForm
          className="pt-2 pb-4 pl-16"
          parentId={quack.id}
          defaultMood={context.defaultMood}
          onPosted={() => context.setReplyingToId(null)}
        />
      ) : null}
    </>
  )
}
