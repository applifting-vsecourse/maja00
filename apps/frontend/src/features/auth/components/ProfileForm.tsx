import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"

import { MoodSelect } from "@/components/MoodSelect"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import {
  BIO_MAX_LENGTH,
  profileSchema,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type ProfileValues,
} from "@/features/auth/api/profileSchema"
import { ProfileUpdateError } from "@/features/auth/hooks/useUpdateProfile"

type ProfileFormProps = {
  // What is saved right now. The form starts from it, and Discard goes back to it.
  saved: ProfileValues
  // Saves the values. Rejects with a ProfileUpdateError when the server says no.
  onSave: (values: ProfileValues) => Promise<void>
  className?: string
}

// Which field an error from the server belongs under, by its error code.
function fieldForErrorCode(code: string | undefined): keyof ProfileValues | null {
  if (!code) return null
  if (code.includes("USERNAME")) return "username"
  if (code.startsWith("NAME_")) return "name"
  if (code.includes("BIO")) return "bio"
  if (code === "INVALID_DEFAULT_MOOD") return "defaultMood"
  return null
}

export function ProfileForm({ saved, onSave, className }: ProfileFormProps) {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: saved,
  })
  const [hasSaved, setHasSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { isDirty, isSubmitting } = form.formState
  const bio = useWatch({ control: form.control, name: "bio" })
  const bioLength = bio?.length ?? 0
  // "Saved" only holds while the form still matches what was saved.
  const shouldShowSaved = hasSaved && !isDirty

  const handleSubmit = async (values: ProfileValues) => {
    setHasSaved(false)
    setErrorMessage(null)
    try {
      await onSave(values)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't save your settings"
      const field = fieldForErrorCode(error instanceof ProfileUpdateError ? error.code : undefined)
      if (field) {
        // Shown next to the field; what was typed stays where it is.
        form.setError(field, { type: "server", message }, { shouldFocus: true })
      } else {
        setErrorMessage(message)
      }
      return
    }
    // The saved values become the new baseline for Discard.
    form.reset(values)
    setHasSaved(true)
  }

  const handleDiscard = () => {
    form.reset()
    setHasSaved(false)
    setErrorMessage(null)
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={className}
      >
        {/* Always in the page, so screen readers announce it when it fills in. */}
        <div role="status">
          {shouldShowSaved ? <p className="mb-6 text-sm font-medium">Settings saved</p> : null}
        </div>

        {errorMessage ? (
          <Alert
            variant="destructive"
            className="mb-6"
          >
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-8">
          <section
            aria-labelledby="profile-heading"
            className="flex flex-col gap-4"
          >
            <h2
              id="profile-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Profile
            </h2>

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} letters, numbers, dots or
                    underscores.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="name"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className={cn(bioLength > BIO_MAX_LENGTH && "text-destructive")}>
                    {bioLength}/{BIO_MAX_LENGTH}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <Separator />

          <section
            aria-labelledby="posting-heading"
            className="flex flex-col gap-4"
          >
            <h2
              id="posting-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Posting
            </h2>

            <FormField
              control={form.control}
              name="defaultMood"
              render={({ field }) => (
                <FormItem className="sm:max-w-xs">
                  <FormLabel>Default mood</FormLabel>
                  <MoodSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    isDisabled={isSubmitting}
                  />
                  <FormDescription>
                    New posts start with this mood. You can still change it for each post.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscard}
              disabled={!isDirty || isSubmitting}
            >
              Discard changes
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}
