/**
 * The likes of one quack as one viewer sees them. Like and unlike answer with
 * this, whatever they changed. See docs/adr/0002-likes.md.
 */
export type LikeState = {
  likeCount: number;
  likedByMe: boolean;
};
