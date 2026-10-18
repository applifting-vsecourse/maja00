import { queryOptions } from "@tanstack/react-query"

import { authKeys } from "@/lib/auth-keys"

import { toSessionUser, type SessionUser } from "@/features/auth/api/sessionUser"
import { authClient } from "@/features/auth/lib/auth-client"

export type { SessionUser }

export type Session = {
  user: SessionUser
} | null

export const authSessionQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.session(),
    queryFn: async (): Promise<Session> => {
      const { data, error } = await authClient.getSession()
      if (error) throw new Error(error.message ?? "Failed to load session")
      if (!data?.user) return null

      return { user: toSessionUser(data.user) }
    },
    staleTime: 30_000,
  })
