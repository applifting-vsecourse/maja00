import {
  Quack,
  QUACK_MOODS,
  QuackMood,
  QuackThread,
} from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';
import { PollResponseDto } from './poll.response.dto';

class QuackUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;
}

class QuackParentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'The quack replied to was deleted' })
  deleted!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'null when the quack replied to was deleted',
  })
  username!: string | null;
}

/**
 * A quack, or a tombstone (`deleted: true`) whose text, mood, author and poll
 * are always null: they no longer exist on the server.
 */
export class QuackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'A deleted quack that still has replies' })
  deleted!: boolean;

  @ApiProperty({ type: String, nullable: true })
  text!: string | null;

  @ApiProperty({ enum: QUACK_MOODS, nullable: true })
  mood!: QuackMood | null;

  @ApiProperty({ type: String, nullable: true })
  userId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: QuackUserDto, nullable: true })
  user!: QuackUserDto | null;

  @ApiProperty({ type: PollResponseDto, nullable: true })
  poll!: PollResponseDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The quack this one replies to; null for a top-level quack',
  })
  parentId!: string | null;

  @ApiProperty({
    type: QuackParentDto,
    nullable: true,
    description: 'What a reply answers; null for a top-level quack',
  })
  parent!: QuackParentDto | null;

  @ApiProperty({ description: 'Number of direct replies' })
  replyCount!: number;

  static fromDomain(quack: Quack): QuackResponseDto {
    const common = {
      id: quack.id,
      createdAt: quack.createdAt,
      parentId: quack.parentId,
      parent: quack.parent ?? null,
      replyCount: quack.replyCount ?? 0,
    };
    if (quack.deleted) {
      return {
        ...common,
        deleted: true,
        text: null,
        mood: null,
        userId: null,
        user: null,
        poll: null,
      };
    }
    if (!quack.user) {
      throw new Error(
        `QuackResponseDto.fromDomain expected quack.user to be loaded for quack ${quack.id}`,
      );
    }
    return {
      ...common,
      deleted: false,
      text: quack.text,
      mood: quack.mood,
      userId: quack.userId,
      user: {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username,
      },
      poll: quack.poll ? PollResponseDto.fromDomain(quack.poll) : null,
    };
  }
}

export class QuackThreadResponseDto {
  @ApiProperty({
    type: [QuackResponseDto],
    description: 'The quacks above the opened one, the top-level quack first',
  })
  ancestors!: QuackResponseDto[];

  @ApiProperty({ type: QuackResponseDto })
  focus!: QuackResponseDto;

  @ApiProperty({
    type: [QuackResponseDto],
    description:
      'Every reply under the opened quack, at any depth, oldest first. Build the tree from parentId.',
  })
  descendants!: QuackResponseDto[];

  static fromDomain(thread: QuackThread): QuackThreadResponseDto {
    return {
      ancestors: thread.ancestors.map(QuackResponseDto.fromDomain),
      focus: QuackResponseDto.fromDomain(thread.focus),
      descendants: thread.descendants.map(QuackResponseDto.fromDomain),
    };
  }
}
