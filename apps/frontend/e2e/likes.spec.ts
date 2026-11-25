// Likes: "Flows (E2E)" in cases.md. Each test names its case.
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test"

import { signIn } from "./signIn"

const API = "http://localhost:4050/api"

/** Signs a seeded user in on a new page and posts a quack (or a reply) through the API. */
async function postAs(
  browser: Browser,
  email: string,
  password: string,
  text: string,
  parentId?: string,
): Promise<{ page: Page; id: string }> {
  const page = await browser.newPage()
  await signIn(page, email, password)
  const created = await page.request.post(`${API}/quacks`, {
    data: parentId ? { text, parentId } : { text },
  })
  expect(created.status()).toBe(201)
  const { id } = (await created.json()) as { id: string }
  return { page, id }
}

const duckOf = (quack: Locator) => quack.getByRole("button", { name: /^(Like|Unlike),/ })

// Case: Like and unlike in the feed.
test("like and unlike a quack in the feed", async ({ browser }) => {
  const text = `Who wants bread ${Date.now()}`
  await postAs(browser, "caffeinatedduck@example.com", "password1", text)

  const me = await browser.newPage()
  await signIn(me, "deepduckthoughts@example.com", "password2")
  await me.goto("/quacks")
  const quack = me.getByRole("article").filter({ hasText: text })
  const duck = duckOf(quack)
  await expect(duck).toHaveAttribute("aria-pressed", "false")
  await expect(duck).toHaveAccessibleName("Like, 0 likes")

  await duck.click()
  await expect(duck).toHaveAttribute("aria-pressed", "true")
  await expect(duck).toHaveText("1")

  // It was stored, not just drawn.
  await me.reload()
  await expect(duck).toHaveAttribute("aria-pressed", "true")
  await expect(duck).toHaveText("1")

  await duck.click()
  await expect(duck).toHaveAttribute("aria-pressed", "false")
  await expect(duck).toHaveAccessibleName("Like, 0 likes")
  await expect(duck).toHaveText("")
})

// Case: Another user sees the count, not my like.
test("another user sees the count but not as their own like", async ({ browser }) => {
  const text = `Pond is warm ${Date.now()}`
  const { id } = await postAs(browser, "caffeinatedduck@example.com", "password1", text)

  const a = await browser.newPage()
  await signIn(a, "deepduckthoughts@example.com", "password2")
  const liked = await a.request.put(`${API}/quacks/${id}/like`)
  expect(liked.status()).toBe(200)

  const b = await browser.newPage()
  await signIn(b, "breadcritic@example.com", "password3")
  await b.goto("/quacks")
  const duck = duckOf(b.getByRole("article").filter({ hasText: text }))
  await expect(duck).toHaveText("1")
  await expect(duck).toHaveAttribute("aria-pressed", "false")
})

// Case: Like a reply.
test("like a reply on the thread page", async ({ browser }) => {
  const stamp = Date.now()
  const { id } = await postAs(
    browser,
    "caffeinatedduck@example.com",
    "password1",
    `Lunch at the pond ${stamp}`,
  )
  const replyText = `Count me in ${stamp}`
  await postAs(browser, "breadcritic@example.com", "password3", replyText, id)

  const me = await browser.newPage()
  await signIn(me, "deepduckthoughts@example.com", "password2")
  await me.goto(`/quacks/${id}`)
  const reply = me.getByRole("list", { name: "Replies" }).getByRole("article").filter({
    hasText: replyText,
  })
  const duck = duckOf(reply)

  await duck.click()
  await expect(duck).toHaveAttribute("aria-pressed", "true")
  await expect(duck).toHaveText("1")
})
