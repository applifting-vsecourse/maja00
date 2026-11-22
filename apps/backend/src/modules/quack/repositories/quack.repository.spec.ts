import { PrismaService } from '@/core/prisma/prisma.service';
import { mockDeep } from 'jest-mock-extended';
import { QuackRepository } from './quack.repository';

const prismaQuack = (user: {
  username: string | null;
  displayUsername: string | null;
}): unknown => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', ...user },
});

// `groupBy` is generic, which the deep mock's types can't follow.
const mockReplyCounts = (
  prisma: ReturnType<typeof mockDeep<PrismaService>>,
  rows: { parentId: string; _count: { _all: number } }[] = [],
): jest.Mock => {
  const groupBy = prisma.quack.groupBy as unknown as jest.Mock;
  groupBy.mockResolvedValue(rows as never);
  return groupBy;
};

const newPrisma = (): ReturnType<typeof mockDeep<PrismaService>> => {
  const prisma = mockDeep<PrismaService>();
  mockReplyCounts(prisma);
  return prisma;
};

const authorOf = async (user: {
  username: string | null;
  displayUsername: string | null;
}): Promise<string | undefined> => {
  const prisma = newPrisma();
  prisma.quack.findMany.mockResolvedValue([prismaQuack(user)] as never);
  const [quack] = await new QuackRepository(prisma).getQuacks(
    'viewer',
    new Date(),
  );
  return quack.deleted ? undefined : quack.user?.username;
};

describe('QuackRepository author username', () => {
  it('shows the spelling the author typed', async () => {
    await expect(
      authorOf({ username: 'duck.fan', displayUsername: 'Duck.Fan' }),
    ).resolves.toBe('Duck.Fan');
  });

  it('falls back to the stored username', async () => {
    await expect(
      authorOf({ username: 'duck.fan', displayUsername: null }),
    ).resolves.toBe('duck.fan');
  });

  it('is empty when the author has no username', async () => {
    await expect(
      authorOf({ username: null, displayUsername: null }),
    ).resolves.toBe('');
  });
});

const mockGroupBy = (
  prisma: ReturnType<typeof mockDeep<PrismaService>>,
): jest.Mock => prisma.pollVote.groupBy as unknown as jest.Mock;

describe('QuackRepository polls', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const withPoll = (id: string, userId: string): unknown => ({
    ...(prismaQuack({ username: 'a', displayUsername: null }) as object),
    id,
    userId,
    poll: {
      id: `poll-${id}`,
      quackId: id,
      closesAt: new Date('2026-10-20T12:00:00Z'),
      options: [
        { id: `${id}-a`, pollId: `poll-${id}`, text: 'Pizza', position: 0 },
        { id: `${id}-b`, pollId: `poll-${id}`, text: 'Ramen', position: 1 },
      ],
    },
  });

  it('loads votes for all polls in two queries, not two per poll', async () => {
    const prisma = newPrisma();
    prisma.quack.findMany.mockResolvedValue([
      withPoll('q1', 'author'),
      withPoll('q2', 'author'),
      withPoll('q3', 'author'),
    ] as never);
    mockGroupBy(prisma).mockResolvedValue([] as never);
    prisma.pollVote.findMany.mockResolvedValue([] as never);

    await new QuackRepository(prisma).getQuacks('viewer', now);

    expect(prisma.pollVote.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.pollVote.findMany).toHaveBeenCalledTimes(1);
  });

  it('shapes each poll for the viewer', async () => {
    const prisma = newPrisma();
    prisma.quack.findMany.mockResolvedValue([
      withPoll('q1', 'author'),
      withPoll('q2', 'author'),
    ] as never);
    mockGroupBy(prisma).mockResolvedValue([
      { optionId: 'q1-a', _count: { _all: 3 } },
      { optionId: 'q1-b', _count: { _all: 1 } },
      { optionId: 'q2-a', _count: { _all: 5 } },
    ] as never);
    // the viewer voted in q1 only
    prisma.pollVote.findMany.mockResolvedValue([
      { pollId: 'poll-q1', userId: 'viewer', optionId: 'q1-b' },
    ] as never);

    const [first, second] = await new QuackRepository(prisma).getQuacks(
      'viewer',
      now,
    );

    if (first.deleted || second.deleted)
      throw new Error('expected live quacks');
    expect(first.poll?.totalVotes).toBe(4);
    expect(first.poll?.myVoteOptionId).toBe('q1-b');
    // no vote in q2: counts stay hidden
    expect(second.poll?.totalVotes).toBeNull();
    expect(second.poll?.options.every((o) => o.votes === null)).toBe(true);
  });

  it('does not touch the vote tables when no quack has a poll', async () => {
    const prisma = newPrisma();
    prisma.quack.findMany.mockResolvedValue([
      prismaQuack({ username: 'a', displayUsername: null }),
    ] as never);

    const [quack] = await new QuackRepository(prisma).getQuacks('v', now);

    expect(quack.poll).toBeNull();
    expect(prisma.pollVote.groupBy).not.toHaveBeenCalled();
  });
});

describe('QuackRepository replies and tombstones', () => {
  const now = new Date('2026-11-10T12:00:00Z');

  it('shows only top-level quacks in the feed, and tombstones only while they have replies', async () => {
    const prisma = newPrisma();
    prisma.quack.findMany.mockResolvedValue([] as never);

    await new QuackRepository(prisma).getQuacks('viewer', now);

    expect(prisma.quack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          parentId: null,
          OR: [{ deletedAt: null }, { replies: { some: {} } }],
        },
      }),
    );
  });

  it('shows replies but never tombstones in Mine', async () => {
    const prisma = newPrisma();
    prisma.quack.findMany.mockResolvedValue([] as never);

    await new QuackRepository(prisma).getQuacks('me', now, undefined, 'me');

    expect(prisma.quack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, userId: 'me' } }),
    );
  });

  it('never lets tombstones match a search', async () => {
    const prisma = newPrisma();
    prisma.$queryRaw.mockResolvedValue([] as never);
    prisma.quack.findMany.mockResolvedValue([] as never);

    await new QuackRepository(prisma).getQuacks('me', now, 'duck');

    const sql = (prisma.$queryRaw.mock.calls[0][0] as { sql: string }).sql;
    expect(sql).toContain('"deletedAt" IS NULL');
    expect(prisma.quack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, id: { in: [] } },
      }),
    );
  });

  it('maps a tombstone to nothing but its place in the thread', async () => {
    const prisma = newPrisma();
    mockReplyCounts(prisma, [{ parentId: 'q1', _count: { _all: 2 } }]);
    prisma.quack.findMany.mockResolvedValue([
      {
        id: 'q1',
        text: null,
        mood: null,
        userId: null,
        user: null,
        poll: null,
        parentId: null,
        parent: null,
        deletedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ] as never);

    const [quack] = await new QuackRepository(prisma).getQuacks('v', now);

    expect(quack).toMatchObject({
      id: 'q1',
      deleted: true,
      text: null,
      user: null,
      replyCount: 2,
    });
  });

  it('tells a reply what it answers, without the author of a deleted parent', async () => {
    const prisma = newPrisma();
    const reply = (id: string, parent: unknown): unknown => ({
      ...(prismaQuack({ username: 'a', displayUsername: null }) as object),
      id,
      parentId: 'p',
      deletedAt: null,
      parent,
    });
    prisma.quack.findMany.mockResolvedValue([
      reply('r1', {
        id: 'p',
        deletedAt: null,
        user: { username: 'duck', displayUsername: 'Duck' },
      }),
      reply('r2', { id: 'p', deletedAt: now, user: null }),
    ] as never);

    const [toLive, toDeleted] = await new QuackRepository(prisma).getQuacks(
      'me',
      now,
      undefined,
      'me',
    );

    expect(toLive.parent).toEqual({
      id: 'p',
      deleted: false,
      username: 'Duck',
    });
    expect(toDeleted.parent).toEqual({
      id: 'p',
      deleted: true,
      username: null,
    });
  });

  describe('deleting', () => {
    type Row = { parentId: string | null; deletedAt: Date | null };

    // The transaction runs on the same mock, so every step is visible.
    // `rows` is what the row lock finds, `replies` the reply count per id.
    const prismaWith = (
      rows: Record<string, Row>,
      replies: Record<string, number>,
    ): ReturnType<typeof mockDeep<PrismaService>> => {
      const prisma = newPrisma();
      prisma.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) =>
        fn(prisma)) as never);
      prisma.$queryRaw.mockImplementation(((query: { values: unknown[] }) => {
        const row = rows[String(query.values[0])];
        return Promise.resolve(row ? [row] : []);
      }) as never);
      prisma.quack.count.mockImplementation(((args: {
        where: { parentId: string };
      }) => Promise.resolve(replies[args.where.parentId] ?? 0)) as never);
      return prisma;
    };

    const deletedIds = (
      prisma: ReturnType<typeof mockDeep<PrismaService>>,
    ): unknown[] =>
      prisma.quack.delete.mock.calls.map(([args]) => args.where.id);

    it('removes a quack without replies completely', async () => {
      const prisma = prismaWith(
        { q1: { parentId: null, deletedAt: null } },
        {},
      );

      await expect(
        new QuackRepository(prisma).deleteQuack('q1', now),
      ).resolves.toBe('deleted');
      expect(deletedIds(prisma)).toEqual(['q1']);
      expect(prisma.quack.update).not.toHaveBeenCalled();
    });

    it('empties a quack with replies into a tombstone and drops its poll', async () => {
      const prisma = prismaWith(
        { q1: { parentId: null, deletedAt: null } },
        { q1: 1 },
      );

      await expect(
        new QuackRepository(prisma).deleteQuack('q1', now),
      ).resolves.toBe('tombstoned');
      expect(prisma.poll.deleteMany).toHaveBeenCalledWith({
        where: { quackId: 'q1' },
      });
      expect(prisma.quack.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: { text: null, mood: null, userId: null, deletedAt: now },
      });
      expect(prisma.quack.delete).not.toHaveBeenCalled();
    });

    it('removes tombstones left without replies, up the chain', async () => {
      // root (tombstone) <- middle (tombstone) <- leaf
      const prisma = prismaWith(
        {
          leaf: { parentId: 'middle', deletedAt: null },
          middle: { parentId: 'root', deletedAt: now },
          root: { parentId: null, deletedAt: now },
        },
        {},
      );

      await new QuackRepository(prisma).deleteQuack('leaf', now);

      expect(deletedIds(prisma)).toEqual(['leaf', 'middle', 'root']);
    });

    it('keeps a tombstone that still has other replies', async () => {
      const prisma = prismaWith(
        {
          leaf: { parentId: 'middle', deletedAt: null },
          middle: { parentId: null, deletedAt: now },
        },
        { middle: 1 },
      );

      await new QuackRepository(prisma).deleteQuack('leaf', now);

      expect(deletedIds(prisma)).toEqual(['leaf']);
    });

    it('stops at a live parent', async () => {
      const prisma = prismaWith(
        {
          leaf: { parentId: 'live', deletedAt: null },
          live: { parentId: null, deletedAt: null },
        },
        {},
      );

      await new QuackRepository(prisma).deleteQuack('leaf', now);

      expect(deletedIds(prisma)).toEqual(['leaf']);
    });

    it('reports a tombstone as already deleted', async () => {
      const prisma = prismaWith({ q1: { parentId: null, deletedAt: now } }, {});

      await expect(
        new QuackRepository(prisma).deleteQuack('q1', now),
      ).resolves.toBe('already-deleted');
      expect(prisma.quack.delete).not.toHaveBeenCalled();
    });
  });

  it('refuses to reply to a tombstone', async () => {
    const prisma = newPrisma();
    prisma.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) =>
      fn(prisma)) as never);
    prisma.$queryRaw.mockResolvedValue([
      { parentId: null, deletedAt: now },
    ] as never);

    await expect(
      new QuackRepository(prisma).createReply({
        text: 'hi',
        mood: null,
        userId: 'u1',
        parentId: 'gone',
      }),
    ).resolves.toBe('parent-deleted');
    expect(prisma.quack.create).not.toHaveBeenCalled();
  });
});
