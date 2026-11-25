import { api } from "@/lib/api-client"

import { likeStateSchema, type LikeState } from "@/features/quack/api/quackSchemas"

// PUT /api/quacks/:quackId/like. Safe to repeat.
export async function likeQuack(quackId: string): Promise<LikeState> {
  const json = await api.put(`quacks/${encodeURIComponent(quackId)}/like`).json()
  return likeStateSchema.parse(json)
}

// DELETE /api/quacks/:quackId/like. Safe to repeat.
export async function unlikeQuack(quackId: string): Promise<LikeState> {
  const json = await api.delete(`quacks/${encodeURIComponent(quackId)}/like`).json()
  return likeStateSchema.parse(json)
}
