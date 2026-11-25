// Likes: the rules in cases.md ("Rules (unit)", backend). The repository is
// mocked, so these test what the service decides, not what the database does.
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const me = { id: 'u1' } as Identity;

describe('QuacksService likes', () => {
  let repository: MockProxy<QuackRepository>;
  let service: QuacksService;

  beforeEach(() => {
    repository = mock<QuackRepository>();
    service = new QuacksService(repository);
  });

  // Case: Like a live quack.
  it('likes a live quack and answers with the new state', async () => {
    repository.likeQuack.mockResolvedValue({ likeCount: 1, likedByMe: true });

    await expect(service.likeQuack(me, 'q1')).resolves.toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    expect(repository.likeQuack).toHaveBeenCalledWith('q1', 'u1');
  });

  // Case: Like your own quack. The service has no author check for likes:
  // it never looks the author up, it just stores the like.
  it('lets the author like their own quack', async () => {
    repository.likeQuack.mockResolvedValue({ likeCount: 1, likedByMe: true });

    await expect(service.likeQuack(me, 'my-quack')).resolves.toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    expect(repository.findQuackForDelete).not.toHaveBeenCalled();
    expect(repository.likeQuack).toHaveBeenCalledWith('my-quack', 'u1');
  });

  it('unlikes a quack and answers with the new state', async () => {
    repository.unlikeQuack.mockResolvedValue({
      likeCount: 0,
      likedByMe: false,
    });

    await expect(service.unlikeQuack(me, 'q1')).resolves.toEqual({
      likeCount: 0,
      likedByMe: false,
    });
    expect(repository.unlikeQuack).toHaveBeenCalledWith('q1', 'u1');
  });

  // Case: Like a tombstone.
  it('refuses to like a deleted quack with 409', async () => {
    repository.likeQuack.mockResolvedValue('deleted');

    await expect(service.likeQuack(me, 'q1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses to unlike a deleted quack with 409', async () => {
    repository.unlikeQuack.mockResolvedValue('deleted');

    await expect(service.unlikeQuack(me, 'q1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // Case: Like a missing quack.
  it('answers 404 when liking a quack that does not exist', async () => {
    repository.likeQuack.mockResolvedValue('not-found');

    await expect(service.likeQuack(me, 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('answers 404 when unliking a quack that does not exist', async () => {
    repository.unlikeQuack.mockResolvedValue('not-found');

    await expect(service.unlikeQuack(me, 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // Case: The liker comes from the session.
  it('likes and unlikes as the signed-in user', async () => {
    const someoneElse = { id: 'u2' } as Identity;
    repository.likeQuack.mockResolvedValue({ likeCount: 1, likedByMe: true });
    repository.unlikeQuack.mockResolvedValue({
      likeCount: 0,
      likedByMe: false,
    });

    await service.likeQuack(someoneElse, 'q1');
    await service.unlikeQuack(someoneElse, 'q1');

    expect(repository.likeQuack).toHaveBeenCalledWith('q1', 'u2');
    expect(repository.unlikeQuack).toHaveBeenCalledWith('q1', 'u2');
  });
});
