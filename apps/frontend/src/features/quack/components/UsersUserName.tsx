import { Highlighted } from "@/features/quack/components/Highlighted"

type UsersUserNameProps = {
  username: string
  highlight?: string[]
}

export function UsersUserName({ username, highlight = [] }: UsersUserNameProps) {
  return (
    <span className="text-sm text-muted-foreground">
      @
      <Highlighted
        text={username}
        words={highlight}
      />
    </span>
  )
}
