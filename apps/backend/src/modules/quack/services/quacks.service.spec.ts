// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { Poll } from '@/modules/quack/domain/poll';
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
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

    await expect(service.getQuacks('u1')).resolves.toEqual(quacks);
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
    expect(repository.createQuack).toHaveBeenCalledWith(
      { text: 'hello', mood: null, userId: 'u1', poll: null },
      expect.any(Date),
    );
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
    expect(repository.createQuack).toHaveBeenCalledWith(
      { text: 'lol', mood: 'silly', userId: 'u1', poll: null },
      expect.any(Date),
    );
  });

  describe('searching', () => {
    it('passes the search through to the repository', async () => {
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue([aQuack()]);
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      const service = new QuacksService(repository);

      await expect(service.getQuacks('u1', 'duck')).resolves.toHaveLength(1);
      expect(repository.getQuacks).toHaveBeenCalledWith(
        'u1',
        expect.any(Date),
        'duck',
        undefined,
      );
      log.mockRestore();
    });

    it('logs the size of a search but never its words', async () => {
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue([aQuack(), aQuack({ id: 'q2' })]);
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      await new QuacksService(repository).getQuacks('u1', 'secret pond');

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

      await new QuacksService(repository).getQuacks('u1');

      expect(log).not.toHaveBeenCalled();
      log.mockRestore();
    });
  });

  describe('only my quacks', () => {
    it('limits the list to the signed-in user', async () => {
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue([aQuack()]);

      await new QuacksService(repository).getQuacks('u1', undefined, true);

      expect(repository.getQuacks).toHaveBeenCalledWith(
        'u1',
        expect.any(Date),
        undefined,
        'u1',
      );
    });

    it('does not limit the list by default', async () => {
      const repository = mock<QuackRepository>();
      repository.getQuacks.mockResolvedValue([]);

      await new QuacksService(repository).getQuacks('u1');

      expect(repository.getQuacks).toHaveBeenCalledWith(
        'u1',
        expect.any(Date),
        undefined,
        undefined,
      );
    });
  });

  describe('deleting a quack', () => {
    const author = { id: 'u1' } as Identity;
    const someoneElse = { id: 'u2' } as Identity;

    it('lets the author delete their quack', async () => {
      const repository = mock<QuackRepository>();
      repository.findQuackAuthorId.mockResolvedValue('u1');

      await new QuacksService(repository).deleteQuack(author, 'q1');

      expect(repository.deleteQuack).toHaveBeenCalledWith('q1');
    });

    it("rejects someone else's quack with Forbidden", async () => {
      const repository = mock<QuackRepository>();
      repository.findQuackAuthorId.mockResolvedValue('u1');

      await expect(
        new QuacksService(repository).deleteQuack(someoneElse, 'q1'),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.deleteQuack).not.toHaveBeenCalled();
    });

    it("lets an admin delete someone else's quack and logs it", async () => {
      const repository = mock<QuackRepository>();
      repository.findQuackAuthorId.mockResolvedValue('u1');
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      const admin = { id: 'admin1', role: 'admin' } as Identity;

      await new QuacksService(repository).deleteQuack(admin, 'q1');

      expect(repository.deleteQuack).toHaveBeenCalledWith('q1');
      expect(log).toHaveBeenCalledTimes(1);
      const message = String(log.mock.calls[0][0]);
      expect(message).toContain('admin1');
      expect(message).toContain('q1');
      expect(message).toContain('u1');
      log.mockRestore();
    });

    it('does not log an ordinary delete by the author', async () => {
      const repository = mock<QuackRepository>();
      repository.findQuackAuthorId.mockResolvedValue('u1');
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      await new QuacksService(repository).deleteQuack(author, 'q1');

      expect(log).not.toHaveBeenCalled();
      log.mockRestore();
    });

    it('rejects a user whose role is not admin', async () => {
      const repository = mock<QuackRepository>();
      repository.findQuackAuthorId.mockResolvedValue('u1');
      const regular = { id: 'u2', role: 'user' } as Identity;

      await expect(
        new QuacksService(repository).deleteQuack(regular, 'q1'),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.deleteQuack).not.toHaveBeenCalled();
    });

    it('still says NotFound to an admin when the quack does not exist', async () => {
      const repository = mock<QuackRepository>();
      repository.findQuackAuthorId.mockResolvedValue(null);
      const admin = { id: 'admin1', role: 'admin' } as Identity;

      await expect(
        new QuacksService(repository).deleteQuack(admin, 'nope'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a quack that does not exist with NotFound', async () => {
      const repository = mock<QuackRepository>();
      repository.findQuackAuthorId.mockResolvedValue(null);

      await expect(
        new QuacksService(repository).deleteQuack(author, 'nope'),
      ).rejects.toThrow(NotFoundException);
      expect(repository.deleteQuack).not.toHaveBeenCalled();
    });
  });

  describe('creating a poll', () => {
    it('closes the poll after the chosen number of minutes', async () => {
      const repository = mock<QuackRepository>();
      repository.createQuack.mockResolvedValue(aQuack());
      const before = Date.now();

      await new QuacksService(repository).createQuack(
        { id: 'u1' } as Identity,
        {
          text: 'lunch?',
          poll: { options: ['a', 'b'], durationMinutes: 90 },
        },
      );

      const [data] = repository.createQuack.mock.calls[0];
      expect(data.poll?.options).toEqual(['a', 'b']);
      const closesIn = (data.poll?.closesAt.getTime() ?? 0) - before;
      expect(closesIn).toBeGreaterThanOrEqual(90 * 60 * 1000);
      expect(closesIn).toBeLessThan(90 * 60 * 1000 + 5000);
    });
  });

  describe('voting', () => {
    const open: Poll = {
      id: 'p1',
      quackId: 'q1',
      closesAt: new Date(Date.now() + 60 * 60 * 1000),
      options: [
        { id: 'a', text: 'Pizza', position: 0 },
        { id: 'b', text: 'Ramen', position: 1 },
      ],
    };
    const voter = { id: 'voter' } as Identity;
    const setup = (
      poll: Poll = open,
      authorId = 'author',
    ): { repository: MockProxy<QuackRepository>; service: QuacksService } => {
      const repository = mock<QuackRepository>();
      repository.findPollByQuackId.mockResolvedValue({ poll, authorId });
      repository.castVote.mockResolvedValue('voted');
      return { repository, service: new QuacksService(repository) };
    };

    it('records the vote for the signed-in user', async () => {
      const { repository, service } = setup();
      await service.voteOnPoll(voter, 'q1', 'b');
      expect(repository.castVote).toHaveBeenCalledWith(
        { pollId: 'p1', userId: 'voter', optionId: 'b' },
        expect.any(Date),
      );
      expect(repository.getPollView).toHaveBeenCalledTimes(1);
    });

    it('rejects the author', async () => {
      const { repository, service } = setup(open, 'voter');
      await expect(service.voteOnPoll(voter, 'q1', 'a')).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.castVote).not.toHaveBeenCalled();
    });

    it('rejects a quack without a poll', async () => {
      const repository = mock<QuackRepository>();
      repository.findPollByQuackId.mockResolvedValue(null);
      await expect(
        new QuacksService(repository).voteOnPoll(voter, 'q1', 'a'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an option from another poll', async () => {
      const { repository, service } = setup();
      await expect(
        service.voteOnPoll(voter, 'q1', 'other-poll-option'),
      ).rejects.toThrow(NotFoundException);
      expect(repository.castVote).not.toHaveBeenCalled();
    });

    it('rejects a vote on a closed poll', async () => {
      const { repository, service } = setup({
        ...open,
        closesAt: new Date(Date.now() - 1000),
      });
      await expect(service.voteOnPoll(voter, 'q1', 'a')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.castVote).not.toHaveBeenCalled();
    });

    it('rejects a vote when the poll closed while the request ran', async () => {
      const { repository, service } = setup();
      repository.castVote.mockResolvedValue('closed');
      await expect(service.voteOnPoll(voter, 'q1', 'a')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.getPollView).not.toHaveBeenCalled();
    });
  });
});
