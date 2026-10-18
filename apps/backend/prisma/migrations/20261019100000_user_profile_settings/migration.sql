-- Profile settings: a short bio and the mood the new-post form starts with.
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "bio" VARCHAR(160),
ADD COLUMN     "defaultMood" "quack_mood";

-- The username plugin stores `username` lowercased (so uniqueness ignores case)
-- and keeps the spelling the user typed in `displayUsername`. Users created by
-- the seed script bypassed that: mixed-case `username`, no `displayUsername`.
-- Bring them in line. This fails (and rolls back) if two usernames differ only
-- by case, since `username` is unique.
UPDATE "user"
SET "displayUsername" = COALESCE("displayUsername", "username"),
    "username" = lower("username")
WHERE "username" IS NOT NULL
  AND ("username" <> lower("username") OR "displayUsername" IS NULL);
