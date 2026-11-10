import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Poll as PrismaPoll,
  PollOption as PrismaPollOption,
} from '@/generated/prisma/client';
import { Poll, PollView, toPollView } from '@/modules/quack/domain/poll';
import {
  Quack,
  QuackMood,
  QuackParent,
  QuackThread,
} from '@/modules/quack/domain/quack';
import { escapeLike, toSearchWords } from '@/modules/quack/domain/quack-search';
import { Injectable } from '@nestjs/common';

type PrismaPollWithOptions = PrismaPoll & { options: PrismaPollOption[] };

type Username = { username: string | null; displayUsername: string | null };

// The spelling the user typed; `username` itself is stored lowercase.
const usernameOf = (user: Username): string =>
  user.displayUsername ?? user.username ?? '';

/** What every quack read loads: author, poll, and the quack it answers. */
const QUACK_INCLUDE = {
  user: true,
  poll: { include: { options: true } },
  parent: {
    select: {
      id: true,
      deletedAt: true,
      user: { select: { username: true, displayUsername: true } },
    },
  },
} satisfies Prisma.QuackInclude;

type PrismaQuackRow = {
  id: string;
  text: string | null;
  mood: QuackMood | null;
  userId: string | null;
  parentId?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: ({ id: string; name: string } & Username) | null;
  poll?: PrismaPollWithOptions | null;
  parent?: {
    id: string;
    deletedAt: Date | null;
    user: Username | null;
  } | null;
};

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

const mapParent = (
  parent: PrismaQuackRow['parent'],
): QuackParent | null | undefined => {
  if (parent === undefined) return undefined;
  if (parent === null) return null;
  if (parent.deletedAt || !parent.user) {
    return { id: parent.id, deleted: true, username: null };
  }
  return { id: parent.id, deleted: false, username: usernameOf(parent.user) };
};

const mapPrismaQuackToDomain = (
  quack: PrismaQuackRow,
  poll?: PollView | null,
  replyCount?: number,
): Quack => {
  const base = {
    id: quack.id,
    parentId: quack.parentId ?? null,
    createdAt: quack.createdAt,
    updatedAt: quack.updatedAt,
    replyCount,
    parent: mapParent(quack.parent),
  };
  if (quack.deletedAt || quack.text === null || quack.userId === null) {
    // A tombstone: nothing of the deleted quack leaves the repository.
    return {
      ...base,
      deleted: true,
      text: null,
      mood: null,
      userId: null,
      user: null,
      poll: null,
    };
  }
  return {
    ...base,
    deleted: false,
    text: quack.text,
    mood: quack.mood,
    userId: quack.userId,
    user: quack.user
      ? {
          id: quack.user.id,
          name: quack.user.name,
          username: usernameOf(quack.user),
        }
      : undefined,
    poll,
  };
};

export type CreateReplyResult = Quack | 'parent-not-found' | 'parent-deleted';

export type DeleteQuackResult =
  | 'not-found'
  | 'already-deleted'
  // removed completely, with its poll
  | 'deleted'
  // it had replies: emptied into a tombstone
  | 'tombstoned';

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The feed (no search, not "mine"): top-level quacks, plus top-level
   * tombstones that still have replies, so those replies stay reachable.
   * A search or "mine": live quacks at any level, never tombstones.
   */
  async getQuacks(
    viewerId: string,
    now: Date,
    search?: string,
    authorId?: string,
  ): Promise<Quack[]> {
    const words = search ? toSearchWords(search) : [];
    const isFeed = words.length === 0 && !authorId;
    const where: Prisma.QuackWhereInput = isFeed
      ? {
          parentId: null,
          OR: [{ deletedAt: null }, { replies: { some: {} } }],
        }
      : {
          deletedAt: null,
          ...(authorId ? { userId: authorId } : {}),
          ...(words.length > 0
            ? { id: { in: await this.findIds(words) } }
            : {}),
        };
    const quacks = await this.prisma.quack.findMany({
      where,
      include: QUACK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return this.toDomain(quacks, viewerId, now);
  }

  /**
   * A quack with the chain of quacks above it and every reply below it.
   * Prisma can't recurse, hence the two recursive CTEs. They only collect
   * ids; the rows are then loaded like every other list.
   */
  async getThread(
    quackId: string,
    viewerId: string,
    now: Date,
  ): Promise<QuackThread | null> {
    const up = await this.prisma.$queryRaw<{ id: string; depth: number }[]>(
      Prisma.sql`WITH RECURSIVE up AS (
          SELECT "id", "parentId", 0 AS depth FROM "quack" WHERE "id" = ${quackId}
          UNION ALL
          SELECT q."id", q."parentId", up.depth + 1
          FROM "quack" q JOIN up ON q."id" = up."parentId"
        ) SELECT "id", depth FROM up`,
    );
    if (up.length === 0) return null;
    const down = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`WITH RECURSIVE down AS (
          SELECT "id" FROM "quack" WHERE "parentId" = ${quackId}
          UNION ALL
          SELECT q."id" FROM "quack" q JOIN down ON q."parentId" = down."id"
        ) SELECT "id" FROM down`,
    );
    const rows = await this.prisma.quack.findMany({
      where: { id: { in: [...up, ...down].map((row) => row.id) } },
      include: QUACK_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    const quacks = await this.toDomain(rows, viewerId, now);
    const byId = new Map(quacks.map((quack) => [quack.id, quack]));
    const focus = byId.get(quackId);
    // Deleted between the queries.
    if (!focus) return null;
    const ancestors = up
      .filter((row) => row.id !== quackId)
      .sort((a, b) => Number(b.depth) - Number(a.depth))
      .flatMap((row) => byId.get(row.id) ?? []);
    const downIds = new Set(down.map((row) => row.id));
    return {
      ancestors,
      focus,
      descendants: quacks.filter((quack) => downIds.has(quack.id)),
    };
  }

  /** Adds reply counts and viewer-shaped polls, in a fixed number of queries. */
  private async toDomain(
    quacks: PrismaQuackRow[],
    viewerId: string,
    now: Date,
  ): Promise<Quack[]> {
    const polls = quacks.flatMap((quack) =>
      quack.poll && quack.userId
        ? [{ poll: quack.poll, quackId: quack.id, authorId: quack.userId }]
        : [],
    );
    const pollIds = polls.map(({ poll }) => poll.id);
    // Two queries for all polls on the page, not two per poll.
    const counts = await this.countVotes(pollIds);
    const myVoteByPoll = await this.votesOf(viewerId, pollIds);
    const viewByQuack = new Map(
      polls.map(({ poll, quackId, authorId }) => [
        quackId,
        toPollView({
          poll: mapPrismaPollToDomain(poll),
          counts,
          viewerId,
          authorId,
          myVoteOptionId: myVoteByPoll.get(poll.id) ?? null,
          now,
        }),
      ]),
    );
    const replyCounts = await this.countReplies(
      quacks.map((quack) => quack.id),
    );
    return quacks.map((quack) =>
      mapPrismaQuackToDomain(
        quack,
        viewByQuack.get(quack.id) ?? null,
        replyCounts.get(quack.id) ?? 0,
      ),
    );
  }

  /** Direct replies per quack id, tombstones included. One query. */
  private async countReplies(quackIds: string[]): Promise<Map<string, number>> {
    if (quackIds.length === 0) return new Map();
    const rows = await this.prisma.quack.groupBy({
      by: ['parentId'],
      where: { parentId: { in: quackIds } },
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.parentId) counts.set(row.parentId, row._count._all);
    }
    return counts;
  }

  /**
   * Ids of the live quacks matching every word in the text, author name or
   * author username. Prisma has no accent-insensitive filter, hence the raw
   * query (needs the `unaccent` extension, see the quack_search_unaccent
   * migration). The words travel as bound parameters, never inlined into the
   * SQL. Tombstones never match: they have no text and no author.
   */
  private async findIds(words: string[]): Promise<string[]> {
    const matchesWord = (word: string): Prisma.Sql =>
      Prisma.sql`unaccent(q."text" || ' ' || u."name" || ' ' || coalesce(u."username", ''))
        ILIKE unaccent(${`%${escapeLike(word)}%`}::text)`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT q."id" FROM "quack" q JOIN "user" u ON u."id" = q."userId"
        WHERE q."deletedAt" IS NULL AND ${Prisma.join(words.map(matchesWord), ' AND ')}`,
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
      include: QUACK_INCLUDE,
    });
    // A new poll has no votes yet, and its viewer is its author.
    const view = quack.poll
      ? toPollView({
          poll: mapPrismaPollToDomain(quack.poll),
          counts: new Map(),
          viewerId: createQuackData.userId,
          authorId: createQuackData.userId,
          myVoteOptionId: null,
          now,
        })
      : null;
    return mapPrismaQuackToDomain(quack, view, 0);
  }

  /**
   * Creates a reply. The parent row is locked first, so it can't be deleted
   * (or turned into a tombstone) while the reply is being written.
   */
  async createReply(reply: {
    text: string;
    mood: QuackMood | null;
    userId: string;
    parentId: string;
  }): Promise<CreateReplyResult> {
    return this.prisma.$transaction(async (tx) => {
      const parent = await this.lockQuack(tx, reply.parentId);
      if (!parent) return 'parent-not-found';
      if (parent.deletedAt) return 'parent-deleted';
      const quack = await tx.quack.create({
        data: {
          text: reply.text,
          mood: reply.mood,
          user: { connect: { id: reply.userId } },
          parent: { connect: { id: reply.parentId } },
        },
        include: QUACK_INCLUDE,
      });
      return mapPrismaQuackToDomain(quack, null, 0);
    });
  }

  /** Who wrote the quack and whether it is a tombstone, or null if there is no such quack. */
  async findQuackForDelete(
    quackId: string,
  ): Promise<{ authorId: string | null; deleted: boolean } | null> {
    const quack = await this.prisma.quack.findUnique({
      where: { id: quackId },
      select: { userId: true, deletedAt: true },
    });
    return quack
      ? { authorId: quack.userId, deleted: quack.deletedAt !== null }
      : null;
  }

  /**
   * Deletes a quack the way docs/adr/0001-anonymous-tombstones.md says:
   * - no replies: the row goes, its poll and votes cascade with it, and any
   *   tombstone above it left without replies goes too, up the chain;
   * - replies: the row stays as a tombstone, its text, mood, author and poll
   *   removed.
   * Every row it decides about is locked first, always child before parent,
   * so concurrent deletes and replies queue up instead of racing.
   */
  async deleteQuack(quackId: string, now: Date): Promise<DeleteQuackResult> {
    return this.prisma.$transaction(async (tx) => {
      const target = await this.lockQuack(tx, quackId);
      if (!target) return 'not-found';
      if (target.deletedAt) return 'already-deleted';

      if ((await tx.quack.count({ where: { parentId: quackId } })) > 0) {
        await tx.poll.deleteMany({ where: { quackId } });
        await tx.quack.update({
          where: { id: quackId },
          data: { text: null, mood: null, userId: null, deletedAt: now },
        });
        return 'tombstoned';
      }

      await tx.quack.delete({ where: { id: quackId } });
      let parentId = target.parentId;
      while (parentId) {
        const parent = await this.lockQuack(tx, parentId);
        if (!parent?.deletedAt) break;
        if ((await tx.quack.count({ where: { parentId } })) > 0) break;
        await tx.quack.delete({ where: { id: parentId } });
        parentId = parent.parentId;
      }
      return 'deleted';
    });
  }

  /** Locks one quack row until the transaction ends. */
  private async lockQuack(
    tx: Prisma.TransactionClient,
    quackId: string,
  ): Promise<{ parentId: string | null; deletedAt: Date | null } | null> {
    const rows = await tx.$queryRaw<
      { parentId: string | null; deletedAt: Date | null }[]
    >(
      Prisma.sql`SELECT "parentId", "deletedAt" FROM "quack" WHERE "id" = ${quackId} FOR UPDATE`,
    );
    return rows[0] ?? null;
  }

  /** The poll of a quack and the quack's author, or null if there is none. */
  async findPollByQuackId(
    quackId: string,
  ): Promise<{ poll: Poll; authorId: string } | null> {
    const poll = await this.prisma.poll.findUnique({
      where: { quackId },
      include: { options: true, quack: { select: { userId: true } } },
    });
    // A tombstone has no poll and no author.
    return poll && poll.quack.userId
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
