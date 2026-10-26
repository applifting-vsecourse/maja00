import { api } from "@/lib/api-client"

// The server answers 204 with no body, so there is nothing to parse.
export async function deleteQuack(quackId: string): Promise<void> {
  await api.delete(`quacks/${encodeURIComponent(quackId)}`)
}
