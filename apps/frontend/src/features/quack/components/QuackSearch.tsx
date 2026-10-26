import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router"
import { Search, X } from "lucide-react"

import { ROUTES } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  quacksSearchSchema,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  toSearchQuery,
} from "@/features/quack/api/quackSearch"

// Pause after the last keystroke before the search runs.
const DEBOUNCE_MS = 300

// The search box lives in the header, so it works on every page. The search
// itself lives in the URL (/quacks?q=...): the feed reads it from there, and a
// reload or a shared link gives the same results.
//
// The root element is a flex item of the header bar — it takes its own row on
// small screens and sits between the nav and the user menu on wider ones.
export function QuackSearch() {
  const router = useRouter()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  // The search currently in the URL (only meaningful on the feed).
  const urlQuery = useRouterState({
    select: (state) =>
      state.location.pathname === ROUTES.quacks
        ? quacksSearchSchema.parse(state.location.search).q
        : undefined,
  })

  const [text, setText] = useState(urlQuery ?? "")
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery)

  // The URL changed from outside the box (back button, "Clear search" in the
  // list, leaving the feed): follow it, unless the box already shows that
  // search. Done while rendering rather than in an effect, so there is no
  // frame with a stale box.
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery)
    if (toSearchQuery(text) !== urlQuery) setText(urlQuery ?? "")
  }

  // Reads the live location, not a render-time copy: this also runs from a
  // timer, and must not undo a navigation that happened in the meantime.
  const commit = useCallback(
    (value: string) => {
      const query = toSearchQuery(value)
      const { pathname, search } = router.state.location
      const isOnFeed = pathname === ROUTES.quacks
      const parsed = isOnFeed ? quacksSearchSchema.parse(search) : undefined
      const current = parsed?.q

      if (query === current) return
      // Nothing to clear when we are not on the feed — don't pull people there.
      if (!isOnFeed && !query) return
      // `replace`: back leaves the search instead of stepping through 'd', 'du', 'duc'...
      // The All/Mine tab stays as it was.
      void navigate({
        to: ROUTES.quacks,
        search: { ...(query ? { q: query } : {}), ...(parsed?.view ? { view: parsed.view } : {}) },
        replace: true,
      })
    },
    [router, navigate],
  )

  useEffect(() => {
    const timer = setTimeout(() => commit(text), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, commit])

  const clear = () => {
    setText("")
    commit("")
    inputRef.current?.focus()
  }

  const isTooShort = text.trim().length > 0 && text.trim().length < SEARCH_MIN_LENGTH

  return (
    <search className="relative order-last flex basis-full items-center gap-2 md:order-none md:max-w-xs md:flex-1 md:basis-auto">
      <label
        htmlFor="quack-search"
        className="text-sm whitespace-nowrap text-muted-foreground"
      >
        Search quacks
      </label>
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          id="quack-search"
          type="search"
          autoComplete="off"
          value={text}
          maxLength={SEARCH_MAX_LENGTH}
          aria-describedby={isTooShort ? "quack-search-hint" : undefined}
          onChange={(event) => setText(event.target.value)}
          // Our own clear button below replaces the browser's.
          className="pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {text ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Clear search"
            onClick={clear}
            className="absolute top-1/2 right-1 -translate-y-1/2"
          >
            <X />
          </Button>
        ) : null}
        {isTooShort ? (
          <p
            id="quack-search-hint"
            className="absolute top-full right-0 left-0 z-10 mt-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
          >
            Type at least {SEARCH_MIN_LENGTH} characters
          </p>
        ) : null}
      </div>
    </search>
  )
}
