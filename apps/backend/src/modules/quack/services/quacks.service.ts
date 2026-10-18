import { closesAtFor, isClosed, PollView } from '@/modules/quack/domain/poll';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { toSearchWords } from '@/modules/quack/domain/quack-search';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class QuacksService {
  private readonly logger = new Logger(QuacksService.name);

  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(viewerId: string, search?: string): Promise<Quack[]> {
    const quacks = await this.quackRepository.getQuacks(
      viewerId,
      new Date(),
      search,
    );
    if (search) {
      // Usage metric only: how long, how many words, how many hits. The search
      // words themselves are never logged — they can be personal.
      this.logger.log(
        `Quack search: queryLength=${search.length} words=${toSearchWords(search).length} results=${quacks.length}`,
      );
    }
    return quacks;
  }

  async createQuack(
    user: Identity,
    quackData: {
      text: string;
      mood?: QuackMood;
      poll?: { options: string[]; durationMinutes: number };
    },
  ): Promise<Quack> {
    const now = new Date();
    return this.quackRepository.createQuack(
      {
        text: quackData.text,
        mood: quackData.mood ?? null,
        // the author is taken from the session, never from the request body
        userId: user.id,
        poll: quackData.poll
          ? {
              options: quackData.poll.options,
              closesAt: closesAtFor(quackData.poll.durationMinutes, now),
            }
          : null,
      },
      now,
    );
  }

  async voteOnPoll(
    user: Identity,
    quackId: string,
    optionId: string,
  ): Promise<PollView> {
    const found = await this.quackRepository.findPollByQuackId(quackId);
    if (!found) {
      throw new NotFoundException('This quack has no poll');
    }
    const { poll, authorId } = found;
    if (authorId === user.id) {
      throw new ForbiddenException('You cannot vote in your own poll');
    }
    if (!poll.options.some((option) => option.id === optionId)) {
      throw new NotFoundException('That option is not part of this poll');
    }
    const now = new Date();
    if (isClosed(poll, now)) {
      throw new ConflictException('This poll is closed');
    }
    const result = await this.quackRepository.castVote(
      { pollId: poll.id, userId: user.id, optionId },
      now,
    );
    if (result === 'closed') {
      throw new ConflictException('This poll is closed');
    }
    return this.quackRepository.getPollView(poll, authorId, user.id, now);
  }
}
