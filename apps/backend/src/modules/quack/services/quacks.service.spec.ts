// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Logger } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  ...overrides,
});

describe('QuacksService', () => {
  it('returns quacks from the repository', async () => {
    const quacks = [aQuack()];
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue(quacks);

    const service = new QuacksService(repository);

    await expect(service.getQuacks()).resolves.toEqual(quacks);
    expect(repository.getQuacks).toHaveBeenCalledTimes(1);
  });

  it('creates a quack owned by the signed-in user', async () => {
    const created = aQuack({ id: 'q2', text: 'hello' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(service.createQuack(user, { text: 'hello' })).resolves.toEqual(
      created,
    );
    // the author comes from the session, not from the caller's payload
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      mood: null,
      userId: 'u1',
    });
  });

  it('passes the chosen mood through to the repository', async () => {
    const created = aQuack({ id: 'q3', text: 'lol', mood: 'silly' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(
      service.createQuack(user, { text: 'lol', mood: 'silly' }),
    ).resolves.toEqual(created);
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'lol',
      mood: 'silly',
      userId: 'u1',
    });
  });

  describe('searching', () => {
    it('passes the search through to the repository', async () => {
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue([aQuack()]);
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      const service = new QuacksService(repository);

      await expect(service.getQuacks('duck')).resolves.toHaveLength(1);
      expect(repository.getQuacks).toHaveBeenCalledWith('duck');
      log.mockRestore();
    });

    it('logs the size of a search but never its words', async () => {
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue([aQuack(), aQuack({ id: 'q2' })]);
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      await new QuacksService(repository).getQuacks('secret pond');

      expect(log).toHaveBeenCalledTimes(1);
      const message = String(log.mock.calls[0][0]);
      expect(message).toContain('queryLength=11');
      expect(message).toContain('words=2');
      expect(message).toContain('results=2');
      expect(message).not.toContain('secret');
      log.mockRestore();
    });

    it('does not log when there is no search', async () => {
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue([]);
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      await new QuacksService(repository).getQuacks();

      expect(log).not.toHaveBeenCalled();
      log.mockRestore();
    });
  });
});
