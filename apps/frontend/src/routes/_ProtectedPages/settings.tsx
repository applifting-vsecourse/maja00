import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"
import { NO_MOOD } from "@/lib/quack-moods"

import type { ProfileValues } from "@/features/auth/api/profileSchema"
import { ProfileForm } from "@/features/auth/components/ProfileForm"
import { useSession } from "@/features/auth/hooks/useSession"
import { useUpdateProfile } from "@/features/auth/hooks/useUpdateProfile"
import { quackKeys } from "@/features/quack/api/quackKeys"

export const Route = createFileRoute("/_ProtectedPages/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const updateProfile = useUpdateProfile()

  const handleSave = async (values: ProfileValues) => {
    await updateProfile.mutateAsync(values)
    // The feed shows the author's name and @username, so it has to refetch too.
    void queryClient.invalidateQueries({ queryKey: quackKeys.all() })
  }

  return (
    <>
      <Seo title="Settings" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

        {user ? (
          <ProfileForm
            saved={{
              username: user.username,
              name: user.name,
              bio: user.bio ?? "",
              defaultMood: user.defaultMood ?? NO_MOOD,
            }}
            onSave={handleSave}
          />
        ) : null}
      </section>
    </>
  )
}
