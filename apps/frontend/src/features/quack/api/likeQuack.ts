import type { LikeState } from "@/features/quack/api/quackSchemas"

// PUT /api/quacks/:quackId/like. Safe to repeat.
export function likeQuack(_quackId: string): Promise<LikeState> {
  return Promise.reject(new Error("not implemented"))
}

// DELETE /api/quacks/:quackId/like. Safe to repeat.
export function unlikeQuack(_quackId: string): Promise<LikeState> {
  return Promise.reject(new Error("not implemented"))
}
