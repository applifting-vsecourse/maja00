import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Poll, PollView, toPollView } from '@/modules/quack/domain/poll';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { escapeLike, toSearchWords } from '@/modules/quack/domain/quack-search';
import { Injectable } from '@nestjs/common';

type PrismaPollWithOptions = PrismaPoll & { options: PrismaPollOption[] };

const mapPrismaPollToDomain = (poll: PrismaPollWithOptions): Poll => ({
  id: poll.id,
  quackId: poll.quackId,
  closesAt: poll.closesAt,
  options: poll.options.map((option) => ({
    id: option.id,
    text: option.text,
    position: option.position,
  })),
});

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & { user?: PrismaUser },
  poll?: PollView | null,
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        // The spelling the user typed; `username` itself is stored lowercase.
        username: quack.user.displayUsername ?? quack.user.username ?? '',
      }
    : undefined,
  poll,
});

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getQuacks(
    viewerId: string,
    now: Date,
    search?: string,
  ): Promise<Quack[]> {
    const words = search ? toSearchWords(search) : [];
    const quacks = await this.prisma.quack.findMany({
      where: words.length > 0 ? { id: { in: await this.findIds(words) } } : {},
      include: { user: true, poll: { include: { options: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const polls = quacks.flatMap((quack) =>
      quack.poll ? [{ quack, poll: quack.poll }] : [],
    );
    const pollIds = polls.map(({ poll }) => poll.id);
    // Two queries for all polls on the page, not two per poll.
    const counts = await this.countVotes(pollIds);
    const myVoteByPoll = await this.votesOf(viewerId, pollIds);
    const viewByQuack = new Map(
      polls.map(({ quack, poll }) => [
        quack.id,
        toPollView({
          poll: mapPrismaPollToDomain(poll),
          counts,
          viewerId,
          authorId: quack.userId,
          myVoteOptionId: myVoteByPoll.get(poll.id) ?? null,
          now,
        }),
      ]),
    );
    return quacks.map((quack) =>
      mapPrismaQuackToDomain(quack, viewByQuack.get(quack.id) ?? null),
    );
  }

  /**
   * Ids of the quacks matching every word in the text, author name or author
   * username. Prisma has no accent-insensitive filter, hence the raw query
   * (needs the `unaccent` extension, see the quack_search_unaccent migration).
   * The words travel as bound parameters, never inlined into the SQL.
   */
  private async findIds(words: string[]): Promise<string[]> {
    const matchesWord = (word: string): Prisma.Sql =>
      Prisma.sql`unaccent(q."text" || ' ' || u."name" || ' ' || coalesce(u."username", ''))
        ILIKE unaccent(${`%${escapeLike(word)}%`}::text)`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT q."id" FROM "quack" q JOIN "user" u ON u."id" = q."userId"
        WHERE ${Prisma.join(words.map(matchesWord), ' AND ')}`,
    );
    return rows.map((row) => row.id);
  }

  async createQuack(
    createQuackData: {
      text: string;
      mood: QuackMood | null;
      userId: string;
      poll: { options: string[]; closesAt: Date } | null;
    },
    now: Date,
  ): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
        ...(createQuackData.poll
          ? {
              poll: {
                create: {
                  closesAt: createQuackData.poll.closesAt,
                  options: {
                    create: createQuackData.poll.options.map(
                      (text, position) => ({ text, position }),
                    ),
                  },
                },
              },
            }
          : {}),
      },
      include: { user: true, poll: { include: { options: true } } },
    });
    // A new poll has no votes yet, and its viewer is its author.
    const view = quack.poll
      ? toPollView({
          poll: mapPrismaPollToDomain(quack.poll),
          counts: new Map(),
          viewerId: quack.userId,
          authorId: quack.userId,
          myVoteOptionId: null,
          now,
        })
      : null;
    return mapPrismaQuackToDomain(quack, view);
  }

  /** The poll of a quack and the quack's author, or null if there is none. */
  async findPollByQuackId(
    quackId: string,
  ): Promise<{ poll: Poll; authorId: string } | null> {
    const poll = await this.prisma.poll.findUnique({
      where: { quackId },
      include: { options: true, quack: { select: { userId: true } } },
    });
    return poll
      ? { poll: mapPrismaPollToDomain(poll), authorId: poll.quack.userId }
      : null;
  }

  /**
   * Sets the user's vote to `optionId`, creating or moving it. The closing time
   * is re-checked inside the transaction so a vote can't slip in after a close
   * that happened while the request was in flight.
   */
  async castVote(
    vote: { pollId: string; userId: string; optionId: string },
    now: Date,
  ): Promise<'voted' | 'closed'> {
    return this.prisma.$transaction(async (tx) => {
      const poll = await tx.poll.findUniqueOrThrow({
        where: { id: vote.pollId },
        select: { closesAt: true },
      });
      if (poll.closesAt.getTime() <= now.getTime()) {
        return 'closed';
      }
      await tx.pollVote.upsert({
        where: {
          pollId_userId: { pollId: vote.pollId, userId: vote.userId },
        },
        create: vote,
        update: { optionId: vote.optionId },
      });
      return 'voted';
    });
  }

  /** The poll as `viewerId` may see it. */
  async getPollView(
    poll: Poll,
    authorId: string,
    viewerId: string,
    now: Date,
  ): Promise<PollView> {
    const counts = await this.countVotes([poll.id]);
    const myVoteByPoll = await this.votesOf(viewerId, [poll.id]);
    return toPollView({
      poll,
      counts,
      viewerId,
      authorId,
      myVoteOptionId: myVoteByPoll.get(poll.id) ?? null,
      now,
    });
  }

  /** Votes per option id, for the options of the given polls. */
  private async countVotes(pollIds: string[]): Promise<Map<string, number>> {
    if (pollIds.length === 0) return new Map();
    const rows = await this.prisma.pollVote.groupBy({
      by: ['optionId'],
      where: { pollId: { in: pollIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.optionId, row._count._all]));
  }

  /** The option id a user picked, per poll id. */
  private async votesOf(
    userId: string,
    pollIds: string[],
  ): Promise<Map<string, string>> {
    if (pollIds.length === 0) return new Map();
    const votes = await this.prisma.pollVote.findMany({
      where: { pollId: { in: pollIds }, userId },
    });
    return new Map(votes.map((vote) => [vote.pollId, vote.optionId]));
  }
}
