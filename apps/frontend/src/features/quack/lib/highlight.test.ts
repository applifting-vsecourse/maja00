import { describe, expect, it } from "vitest"

import { splitByWords } from "@/features/quack/lib/highlight"

describe("splitByWords", () => {
  it("returns the text untouched when there is nothing to highlight", () => {
    expect(splitByWords("hello", [])).toEqual([{ text: "hello", match: false }])
    expect(splitByWords("", ["a"])).toEqual([{ text: "", match: false }])
  })

  it("marks matches and keeps the original casing", () => {
    expect(splitByWords("Throw a Crumb into the pond", ["crumb"])).toEqual([
      { text: "Throw a ", match: false },
      { text: "Crumb", match: true },
      { text: " into the pond", match: false },
    ])
  })

  it("ignores accents in the text and in the word", () => {
    expect(splitByWords("Café au lait", ["cafe"])).toEqual([
      { text: "Café", match: true },
      { text: " au lait", match: false },
    ])
    expect(splitByWords("cafe", ["café"])).toEqual([{ text: "cafe", match: true }])
  })

  it("matches parts of words and every occurrence", () => {
    expect(splitByWords("crumbs, crumbs", ["crumb"])).toEqual([
      { text: "crumb", match: true },
      { text: "s, ", match: false },
      { text: "crumb", match: true },
      { text: "s", match: false },
    ])
  })

  it("merges overlapping matches from several words", () => {
    expect(splitByWords("duckling", ["duck", "ckl"])).toEqual([
      { text: "duckl", match: true },
      { text: "ing", match: false },
    ])
  })

  it("does not break on emoji", () => {
    expect(splitByWords("😄 happy", ["happy"])).toEqual([
      { text: "😄 ", match: false },
      { text: "happy", match: true },
    ])
  })
})
