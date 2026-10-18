import { Highlighted } from "@/features/quack/components/Highlighted"

type UsersNameProps = {
  name: string
  highlight?: string[]
}

export function UsersName({ name, highlight = [] }: UsersNameProps) {
  return (
    <span className="font-semibold text-foreground">
      <Highlighted
        text={name}
        words={highlight}
      />
    </span>
  )
}
