import { PrismaService } from '@/core/prisma/prisma.service';

type CreatePollParams = {
  quackId: string;
  options: string[];
  closesAt: Date;
  // The option index each user picked.
  votes?: { userId: string; optionIndex: number }[];
};

export async function createPoll(
  prisma: PrismaService,
  params: CreatePollParams,
): Promise<void> {
  const { quackId, options, closesAt, votes = [] } = params;

  const poll = await prisma.poll.create({
    data: {
      quackId,
      closesAt,
      options: {
        create: options.map((text, position) => ({ text, position })),
      },
    },
    include: { options: true },
  });

  for (const { userId, optionIndex } of votes) {
    const option = poll.options.find((o) => o.position === optionIndex);
    if (!option) {
      throw new Error(`Seed poll has no option at index ${optionIndex}`);
    }
    await prisma.pollVote.create({
      data: { pollId: poll.id, userId, optionId: option.id },
    });
  }
}
