import { closesAtFor, isClosed, PollView } from '@/modules/quack/domain/poll';
import { Quack, QuackMood, QuackThread } from '@/modules/quack/domain/quack';
import { toSearchWords } from '@/modules/quack/domain/quack-search';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  BadRequestException,
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

  async getQuacks(
    viewerId: string,
    search?: string,
    onlyMine = false,
  ): Promise<Quack[]> {
    const quacks = await this.quackRepository.getQuacks(
      viewerId,
      new Date(),
      search,
      // "mine" is the signed-in user, never an id sent by the client
      onlyMine ? viewerId : undefined,
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
      // Set: the quack is a reply to this quack.
      parentId?: string;
    },
  ): Promise<Quack> {
    if (quackData.parentId !== undefined) {
      if (quackData.poll) {
        throw new BadRequestException('A reply cannot have a poll');
      }
      return this.replyToQuack(user, quackData.parentId, quackData);
    }
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

  async getThread(viewerId: string, quackId: string): Promise<QuackThread> {
    const thread = await this.quackRepository.getThread(
      quackId,
      viewerId,
      new Date(),
    );
    if (!thread) {
      throw new NotFoundException('This quack does not exist');
    }
    return thread;
  }

  private async replyToQuack(
    user: Identity,
    parentId: string,
    reply: { text: string; mood?: QuackMood },
  ): Promise<Quack> {
    const result = await this.quackRepository.createReply({
      text: reply.text,
      mood: reply.mood ?? null,
      // the author is taken from the session, never from the request body
      userId: user.id,
      parentId,
    });
    if (result === 'parent-not-found') {
      throw new NotFoundException(
        'The quack you are replying to does not exist',
      );
    }
    if (result === 'parent-deleted') {
      throw new ConflictException('The quack you are replying to was deleted');
    }
    return result;
  }

  /**
   * Deletes completely, or leaves a tombstone when the quack has replies.
   * See docs/adr/0001-anonymous-tombstones.md.
   */
  async deleteQuack(user: Identity, quackId: string): Promise<void> {
    const found = await this.quackRepository.findQuackForDelete(quackId);
    if (found === null) {
      throw new NotFoundException('This quack does not exist');
    }
    // A tombstone has no author left to own it, and nothing left to delete.
    if (found.deleted) {
      throw new ConflictException('This quack was already deleted');
    }
    const { authorId } = found;
    // the owner or an admin may delete; checked on the server, on every request
    const isOwner = authorId === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You can only delete your own quacks');
    }
    const result = await this.quackRepository.deleteQuack(quackId, new Date());
    // Deleted by someone else between the check and the delete.
    if (result === 'not-found') {
      throw new NotFoundException('This quack does not exist');
    }
    if (result === 'already-deleted') {
      throw new ConflictException('This quack was already deleted');
    }
    if (!isOwner) {
      // Ids only: who moderated what, without any personal data.
      this.logger.log(
        `Moderation: admin ${user.id} deleted quack ${quackId} written by ${authorId}`,
      );
    }
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
