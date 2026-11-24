import { LikeState } from '@/modules/quack/domain/like';
import { ApiProperty } from '@nestjs/swagger';

/** The likes of a quack after liking or unliking it. */
export class LikeResponseDto {
  @ApiProperty({ description: 'Number of likes on the quack' })
  likeCount!: number;

  @ApiProperty({ description: 'Whether the signed-in user likes it' })
  likedByMe!: boolean;

  static fromDomain(state: LikeState): LikeResponseDto {
    return { likeCount: state.likeCount, likedByMe: state.likedByMe };
  }
}
