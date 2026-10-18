import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { toSearchWords } from '@/modules/quack/domain/quack-search';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class QuacksService {
  private readonly logger = new Logger(QuacksService.name);

  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(search?: string): Promise<Quack[]> {
    const quacks = await this.quackRepository.getQuacks(search);
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
    quackData: { text: string; mood?: QuackMood },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood ?? null,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
