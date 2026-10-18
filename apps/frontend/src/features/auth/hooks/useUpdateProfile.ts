import { useMutation, useQueryClient } from "@tanstack/react-query"

import { authKeys } from "@/lib/auth-keys"
import { NO_MOOD } from "@/lib/quack-moods"

import type { ProfileValues } from "@/features/auth/api/profileSchema"
import { authClient } from "@/features/auth/lib/auth-client"

/** A failed save. `code` is BetterAuth's / our error code, e.g. USERNAME_IS_ALREADY_TAKEN. */
export class ProfileUpdateError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = "ProfileUpdateError"
  }
}

// One call saves everything, so a username clash can never leave the other
// fields half-saved.
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: ProfileValues) => {
      const { error } = await authClient.updateUser({
        username: values.username,
        name: values.name,
        bio: values.bio,
        // The server stores "" / "none" as no mood.
        defaultMood: values.defaultMood === NO_MOOD ? "" : values.defaultMood,
      })
      if (error) {
        throw new ProfileUpdateError(error.message ?? "Couldn't save your settings", error.code)
      }
    },
    // Awaited, so the session (header menu, form defaults) is fresh by the time
    // the save resolves.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.session() }),
  })
}
