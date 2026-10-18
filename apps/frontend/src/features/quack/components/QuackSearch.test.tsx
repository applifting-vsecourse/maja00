import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { quacksSearchSchema } from "@/features/quack/api/quackSearch"
import { QuackSearch } from "@/features/quack/components/QuackSearch"

// A tiny app: the search box in a "header", plus the home page and the feed.
async function renderAt(url: string) {
  const root = createRootRoute({
    component: () => (
      <>
        <QuackSearch />
        <Outlet />
      </>
    ),
  })
  const home = createRoute({ getParentRoute: () => root, path: "/", component: () => <p>Home</p> })
  const feed = createRoute({
    getParentRoute: () => root,
    path: "/quacks",
    validateSearch: (search) => quacksSearchSchema.parse(search),
    component: () => <p>Feed</p>,
  })
  const router = createRouter({
    routeTree: root.addChildren([home, feed]),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  render(<RouterProvider router={router as never} />)
  await screen.findByLabelText("Search quacks")
  return router
}

const searchOf = (router: Awaited<ReturnType<typeof renderAt>>) =>
  new URLSearchParams(router.state.location.searchStr).get("q")

describe("QuackSearch", () => {
  it("starts out with the search from the URL", async () => {
    await renderAt("/quacks?q=duck")

    expect(screen.getByLabelText("Search quacks")).toHaveValue("duck")
  })

  it("puts a search of 2+ characters in the URL after a pause", async () => {
    const router = await renderAt("/quacks")

    await userEvent.type(screen.getByLabelText("Search quacks"), "  duck pond ")
    expect(searchOf(router)).toBeNull() // still within the pause

    await waitFor(() => expect(searchOf(router)).toBe("duck pond"))
  })

  it("takes you from another page to the feed once a valid search is typed", async () => {
    const router = await renderAt("/")

    await userEvent.type(screen.getByLabelText("Search quacks"), "duck")

    await waitFor(() => expect(router.state.location.pathname).toBe("/quacks"))
    expect(searchOf(router)).toBe("duck")
  })

  it("keeps you on the page when a search is cleared elsewhere", async () => {
    const router = await renderAt("/")

    await userEvent.type(screen.getByLabelText("Search quacks"), "d")
    await userEvent.clear(screen.getByLabelText("Search quacks"))
    await new Promise((resolve) => setTimeout(resolve, 450))

    expect(router.state.location.pathname).toBe("/")
  })

  it("shows a hint for one character and drops the search from the URL", async () => {
    const router = await renderAt("/quacks?q=duck")

    await userEvent.clear(screen.getByLabelText("Search quacks"))
    await userEvent.type(screen.getByLabelText("Search quacks"), "d")

    expect(screen.getByText("Type at least 2 characters")).toBeInTheDocument()
    await waitFor(() => expect(searchOf(router)).toBeNull())
    expect(router.state.location.pathname).toBe("/quacks")
  })

  it("has a clear button only while there is text, and it empties the search at once", async () => {
    const router = await renderAt("/quacks?q=duck")
    const input = screen.getByLabelText("Search quacks")

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }))

    expect(input).toHaveValue("")
    expect(input).toHaveFocus()
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()
    await waitFor(() => expect(searchOf(router)).toBeNull())
  })

  it("follows the URL when it changes from outside", async () => {
    const router = await renderAt("/quacks?q=duck")

    await router.navigate({ to: "/quacks", search: {} })

    await waitFor(() => expect(screen.getByLabelText("Search quacks")).toHaveValue(""))
  })

  it("limits the search to 100 characters", async () => {
    await renderAt("/quacks")

    expect(screen.getByLabelText("Search quacks")).toHaveAttribute("maxlength", "100")
  })
})
