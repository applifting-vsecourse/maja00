import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { useSession } from "@/features/auth/hooks/useSession"
import { QuackThreadView } from "@/features/quack/components/QuackThreadView"

// `quacks_` (trailing underscore): the thread is its own page at
// /quacks/$quackId, not something rendered inside the feed route.
export const Route = createFileRoute("/_ProtectedPages/quacks_/$quackId")({
  component: ThreadPage,
})

function ThreadPage() {
  const { user } = useSession()
  const { quackId } = Route.useParams()

  return (
    <>
      <Seo title="Thread" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <QuackThreadView
          // A new thread starts with no reply form open.
          key={quackId}
          quackId={quackId}
          currentUserId={user?.id}
          canModerate={user?.role === "admin"}
          defaultMood={user?.defaultMood}
        />
      </section>
    </>
  )
}
