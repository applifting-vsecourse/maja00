import { splitByWords } from "@/features/quack/lib/highlight"

type HighlightedProps = { text: string; words: string[] }

// <mark> is the semantic element for search hits; its default yellow is
// replaced with a token so it follows the theme.
export function Highlighted({ text, words }: HighlightedProps) {
  return splitByWords(text, words).map((segment, index) =>
    segment.match ? (
      <mark
        key={index}
        className="rounded-sm bg-secondary px-0.5 text-foreground"
      >
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  )
}
