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

const authorOf = async (user: {
  username: string | null;
  displayUsername: string | null;
}): Promise<string | undefined> => {
  const prisma = mockDeep<PrismaService>();
  prisma.quack.findMany.mockResolvedValue([prismaQuack(user)] as never);
  const [quack] = await new QuackRepository(prisma).getQuacks(
    'viewer',
    new Date(),
  );
  return quack?.user?.username;
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

// `groupBy` is generic, which the deep mock's types can't follow.
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
    const prisma = mockDeep<PrismaService>();
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
    const prisma = mockDeep<PrismaService>();
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

    expect(first.poll?.totalVotes).toBe(4);
    expect(first.poll?.myVoteOptionId).toBe('q1-b');
    // no vote in q2: counts stay hidden
    expect(second.poll?.totalVotes).toBeNull();
    expect(second.poll?.options.every((o) => o.votes === null)).toBe(true);
  });

  it('does not touch the vote tables when no quack has a poll', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.quack.findMany.mockResolvedValue([
      prismaQuack({ username: 'a', displayUsername: null }),
    ] as never);

    const [quack] = await new QuackRepository(prisma).getQuacks('v', now);

    expect(quack.poll).toBeNull();
    expect(prisma.pollVote.groupBy).not.toHaveBeenCalled();
  });
});
