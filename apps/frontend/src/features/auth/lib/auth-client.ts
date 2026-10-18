import { inferAdditionalFields, usernameClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { env } from "@/config/env"

export const authClient = createAuthClient({
  baseURL: env.VITE_BETTER_AUTH_URL,
  plugins: [
    usernameClient(),
    // The extra user columns the backend adds (see better-auth.config.ts).
    // Declared here rather than imported from the backend, which the frontend
    // never depends on.
    inferAdditionalFields({
      user: {
        bio: { type: "string", required: false },
        defaultMood: { type: "string", required: false },
      },
    }),
  ],
})
