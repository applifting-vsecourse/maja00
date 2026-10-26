import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useSession } from "@/features/auth/hooks/useSession"
import { quacksSearchSchema } from "@/features/quack/api/quackSearch"
import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  validateSearch: (search) => quacksSearchSchema.parse(search),
  component: QuacksPage,
})

function QuacksPage() {
  const { user } = useSession()
  const { q, view } = Route.useSearch()
  const navigate = Route.useNavigate()
  const isMine = view === "mine"
  const quacksQuery = useQuery(quacksQueryOptions(q, isMine))

  // The All/Mine tab lives in the URL, next to the search, so a reload keeps it.
  const showView = (next: string) =>
    void navigate({
      search: (previous) => ({ ...previous, view: next === "mine" ? "mine" : undefined }),
      replace: true,
    })

  // The form is a sibling feature component, so the route reaches its field
  // through the DOM rather than importing form internals.
  const focusNewQuack = () =>
    document.querySelector<HTMLTextAreaElement>("textarea[name=text]")?.focus()

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <QuackForm
          className="mb-4"
          defaultMood={user?.defaultMood}
        />

        <Tabs
          value={isMine ? "mine" : "all"}
          onValueChange={showView}
        >
          <TabsList aria-label="Which quacks to show">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="mine">Mine</TabsTrigger>
          </TabsList>

          <TabsContent value={isMine ? "mine" : "all"}>
            <QuackList
              quacks={quacksQuery.data ?? []}
              isLoading={quacksQuery.isLoading}
              error={quacksQuery.error ?? undefined}
              // Only the error state offers a retry — posting invalidates the list,
              // and refocusing the tab refetches it.
              onReload={() => void quacksQuery.refetch()}
              search={q}
              onClearSearch={() => void navigate({ search: isMine ? { view } : {}, replace: true })}
              isStale={quacksQuery.isPlaceholderData}
              currentUserId={user?.id}
              isMine={isMine}
              onWriteFirst={focusNewQuack}
            />
          </TabsContent>
        </Tabs>
      </section>
    </>
  )
}
