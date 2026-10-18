import { describe, expect, it } from "vitest"

import { toSessionUser } from "@/features/auth/api/sessionUser"

const serverUser = {
  id: "u1",
  email: "duck@example.com",
  name: "Caffeinated Duck",
  username: "caffeinatedduck",
  displayUsername: "CaffeinatedDuck",
}

describe("toSessionUser", () => {
  it("uses the spelling the user typed as the username", () => {
    expect(toSessionUser(serverUser).username).toBe("CaffeinatedDuck")
  })

  it("falls back to the stored username, then to nothing", () => {
    expect(toSessionUser({ ...serverUser, displayUsername: null }).username).toBe("caffeinatedduck")
    expect(toSessionUser({ ...serverUser, username: null, displayUsername: null }).username).toBe(
      "",
    )
  })

  it("has no bio and no default mood unless set", () => {
    const user = toSessionUser(serverUser)
    expect(user.bio).toBeNull()
    expect(user.defaultMood).toBeNull()
  })

  it("passes the bio and a known default mood through", () => {
    const user = toSessionUser({ ...serverUser, bio: "Quack.", defaultMood: "silly" })
    expect(user.bio).toBe("Quack.")
    expect(user.defaultMood).toBe("silly")
  })

  it("treats an unknown default mood as no mood", () => {
    expect(toSessionUser({ ...serverUser, defaultMood: "bored" }).defaultMood).toBeNull()
  })
})
