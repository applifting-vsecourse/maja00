import { expect, test, type Page } from "@playwright/test"

import { signIn } from "./signIn"

const API = "http://localhost:4050/api"

async function findQuackNotBy(page: Page, username: string): Promise<{ id: string }> {
  // Deleted quacks (tombstones) have no author, so they are nobody's.
  const quacks: { id: string; user: { username: string } | null }[] = await (
    await page.request.get(`${API}/quacks`)
  ).json()
  return quacks.find((quack) => quack.user !== null && quack.user.username !== username)!
}

test("author can post a quack and delete it", async ({ page }) => {
  const text = `E2E quack ${Date.now()}`
  await signIn(page, "caffeinatedduck@example.com", "password1")
  await page.goto("/quacks")

  await page.getByLabel("New quack").fill(text)
  await page.getByRole("button", { name: "Quack", exact: true }).click()
  const quack = page.getByRole("article").filter({ hasText: text })
  await expect(quack).toBeVisible()

  await quack.getByRole("button", { name: "Delete quack" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Delete" }).click()
  // The dialog only closes when the server accepted the delete. While it is
  // open the rest of the page is hidden from getByRole, so "gone" would pass
  // too early without this line.
  await expect(dialog).toBeHidden()
  await expect(quack).toHaveCount(0)
})

test("nobody can delete someone else's quack", async ({ page }) => {
  await signIn(page, "deepduckthoughts@example.com", "password2")
  await page.goto("/quacks")

  const othersQuack = page.getByRole("article").filter({ hasNotText: "@DeepDuckThoughts" }).first()
  await expect(othersQuack.getByRole("button", { name: "Delete quack" })).toHaveCount(0)

  // The button is hidden. Now skip the UI and ask the server directly.
  const notMine = await findQuackNotBy(page, "DeepDuckThoughts")
  const response = await page.request.delete(`${API}/quacks/${notMine.id}`)
  expect(response.status()).toBe(403)
})

test("admin can delete someone else's quack", async ({ browser }) => {
  const text = `Spam ${Date.now()}`
  const author = await browser.newPage()
  await signIn(author, "caffeinatedduck@example.com", "password1")
  const created = await author.request.post(`${API}/quacks`, { data: { text } })
  expect(created.status()).toBe(201)

  const admin = await browser.newPage()
  await signIn(admin, "admin@example.com", "adminpassword")
  await admin.goto("/quacks")

  const quack = admin.getByRole("article").filter({ hasText: text })
  await expect(quack).toBeVisible()
  await quack.getByRole("button", { name: "Delete quack" }).click()
  const dialog = admin.getByRole("dialog")
  await expect(dialog).toContainText("as a moderator")
  await dialog.getByRole("button", { name: "Delete" }).click()
  await expect(dialog).toBeHidden()
  await expect(quack).toHaveCount(0)
})

test("Mine shows only my quacks", async ({ page }) => {
  await signIn(page, "deepduckthoughts@example.com", "password2")
  await page.goto("/quacks")

  await page.getByRole("tab", { name: "Mine" }).click()
  await expect(page).toHaveURL(/view=mine/)

  const quacks = page.getByRole("article")
  await expect(quacks.first()).toBeVisible()
  await expect(quacks.filter({ hasNotText: "@DeepDuckThoughts" })).toHaveCount(0)
})

test("replies stay when their quack is deleted, and its text is gone everywhere", async ({
  browser,
}) => {
  const stamp = Date.now()
  const original = `Pond meeting at noon ${stamp}`
  const replyText = `I will bring bread ${stamp}`

  // The author posts a quack.
  const author = await browser.newPage()
  await signIn(author, "caffeinatedduck@example.com", "password1")
  const created = await author.request.post(`${API}/quacks`, { data: { text: original } })
  expect(created.status()).toBe(201)
  const { id } = (await created.json()) as { id: string }

  // Someone else opens its thread and replies.
  const replier = await browser.newPage()
  await signIn(replier, "breadcritic@example.com", "password3")
  await replier.goto(`/quacks/${id}`)
  await expect(replier.getByRole("article").filter({ hasText: original })).toBeVisible()
  await replier.getByRole("button", { name: "Reply" }).first().click()
  await replier.getByLabel("Your reply").fill(replyText)
  await replier.getByRole("button", { name: "Reply", exact: true }).last().click()
  const replies = replier.getByRole("list", { name: "Replies" })
  await expect(replies.getByText(replyText)).toBeVisible()

  // The feed shows the reply count.
  await author.goto("/quacks")
  const inFeed = author.getByRole("article").filter({ hasText: original })
  await expect(inFeed.getByRole("link", { name: "1 reply" })).toBeVisible()

  // The author deletes it: the dialog says the replies stay.
  await inFeed.getByRole("button", { name: "Delete quack" }).click()
  const dialog = author.getByRole("dialog")
  await expect(dialog).toContainText("The replies stay")
  await dialog.getByRole("button", { name: "Delete" }).click()
  await expect(dialog).toBeHidden()

  // Feed: a placeholder that still leads to the reply, without the text.
  await expect(author.getByText(original)).toHaveCount(0)

  // Thread: placeholder on top, reply still there.
  await replier.reload()
  await expect(replier.getByText("This quack was deleted")).toBeVisible()
  await expect(replier.getByRole("list", { name: "Replies" }).getByText(replyText)).toBeVisible()
  await expect(replier.getByText(original)).toHaveCount(0)

  // Search and the raw API: the text is nowhere.
  const searched = await (
    await replier.request.get(`${API}/quacks`, { params: { q: `meeting ${stamp}` } })
  ).json()
  expect(searched).toEqual([])
  const thread = await (await replier.request.get(`${API}/quacks/${id}/thread`)).text()
  expect(thread).not.toContain(original)
  expect(thread).toContain(replyText)
})
