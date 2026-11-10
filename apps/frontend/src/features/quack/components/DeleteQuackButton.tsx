import { useState } from "react"
import { Loader2, Trash2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { useDeleteQuack } from "@/features/quack/hooks/useDeleteQuack"

type DeleteQuackButtonProps = {
  quackId: string
  // A moderator deleting a quack someone else wrote.
  isModeration?: boolean
  // Replies stay when their quack is deleted; the dialog says so.
  replyCount?: number
}

// Hiding this button is a convenience. The server decides who may delete.
export function DeleteQuackButton({
  quackId,
  isModeration = false,
  replyCount = 0,
}: DeleteQuackButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const deleteQuack = useDeleteQuack()

  const handleOpenChange = (isOpenNext: boolean) => {
    setIsOpen(isOpenNext)
    if (!isOpenNext) deleteQuack.reset()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Delete quack"
          className="ml-auto text-muted-foreground"
        >
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this quack?</DialogTitle>
          <DialogDescription>
            {isModeration
              ? "You are deleting a quack written by someone else as a moderator. "
              : null}
            {replyCount > 0
              ? "Its text is removed for everyone. The replies stay, under “This quack was deleted”. "
              : "It disappears from the feed for everyone. "}
            This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        {deleteQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{deleteQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={deleteQuack.isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteQuack.isPending}
            onClick={() => deleteQuack.mutate(quackId, { onSuccess: () => setIsOpen(false) })}
          >
            {deleteQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
