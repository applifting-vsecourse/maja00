import { PollView } from '@/modules/quack/domain/poll';
import { ApiProperty } from '@nestjs/swagger';

class PollOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'null until the viewer is allowed to see counts',
  })
  votes!: number | null;
}

export class PollResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  closesAt!: Date;

  @ApiProperty()
  closed!: boolean;

  @ApiProperty({ type: [PollOptionDto] })
  options!: PollOptionDto[];

  @ApiProperty({ type: Number, nullable: true })
  totalVotes!: number | null;

  @ApiProperty({ type: String, nullable: true })
  myVoteOptionId!: string | null;

  @ApiProperty()
  canVote!: boolean;

  static fromDomain(poll: PollView): PollResponseDto {
    return {
      id: poll.id,
      closesAt: poll.closesAt,
      closed: poll.closed,
      options: poll.options.map((o) => ({
        id: o.id,
        text: o.text,
        votes: o.votes,
      })),
      totalVotes: poll.totalVotes,
      myVoteOptionId: poll.myVoteOptionId,
      canVote: poll.canVote,
    };
  }
}
