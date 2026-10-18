import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { escapeLike, toSearchWords } from '@/modules/quack/domain/quack-search';
import { Injectable } from '@nestjs/common';

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & { user?: PrismaUser },
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
});

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getQuacks(search?: string): Promise<Quack[]> {
    const words = search ? toSearchWords(search) : [];
    const quacks = await this.prisma.quack.findMany({
      where: words.length > 0 ? { id: { in: await this.findIds(words) } } : {},
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
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

  async createQuack(createQuackData: {
    text: string;
    mood: QuackMood | null;
    userId: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
      },
      include: { user: true },
    });
    return mapPrismaQuackToDomain(quack);
  }
}
