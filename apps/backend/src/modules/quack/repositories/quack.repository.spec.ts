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
  const [quack] = await new QuackRepository(prisma).getQuacks();
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
