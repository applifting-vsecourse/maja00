export type Segment = { text: string; match: boolean }

// Drops accents and case, one character at a time, so we can map every folded
// character back to where it came from in the original text.
const fold = (char: string): string => char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

const foldAll = (text: string): string => Array.from(text, fold).join("")

/**
 * Cuts `text` into runs that match one of `words` and runs that don't.
 * Ignores case and accents, like the server-side search does.
 */
export function splitByWords(text: string, words: string[]): Segment[] {
  const needles = words.map(foldAll).filter(Boolean)
  if (needles.length === 0 || text === "") return [{ text, match: false }]

  let folded = ""
  const origin: number[] = [] // folded index -> index in `text`
  let index = 0
  for (const char of text) {
    const f = fold(char)
    // one entry per UTF-16 unit, because `folded` is indexed in units
    origin.push(...Array.from({ length: f.length }, () => index))
    folded += f
    index += char.length
  }

  const marked = new Array<boolean>(text.length).fill(false)
  for (const needle of needles) {
    for (let at = folded.indexOf(needle); at !== -1; at = folded.indexOf(needle, at + 1)) {
      const start = origin[at] ?? 0
      const last = origin[at + needle.length - 1] ?? start
      const end = last + ((text.codePointAt(last) ?? 0) > 0xffff ? 2 : 1)
      for (let i = start; i < end; i++) marked[i] = true
    }
  }

  const segments: Segment[] = []
  let from = 0
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marked[i] !== marked[from]) {
      segments.push({ text: text.slice(from, i), match: marked[from] === true })
      from = i
    }
  }
  return segments
}
