import { closesAtFor, isClosed, Poll, PollView, toPollView } from './poll';

const now = new Date('2026-10-19T12:00:00Z');
const poll: Poll = {
  id: 'p1',
  quackId: 'q1',
  closesAt: new Date('2026-10-20T12:00:00Z'),
  // deliberately out of order
  options: [
    { id: 'b', text: 'Ramen', position: 1 },
    { id: 'a', text: 'Pizza', position: 0 },
  ],
};
const counts = new Map([['a', 6]]);

const view = (
  overrides: Partial<Parameters<typeof toPollView>[0]> = {},
): PollView =>
  toPollView({
    poll,
    counts,
    viewerId: 'viewer',
    authorId: 'author',
    myVoteOptionId: null,
    now,
    ...overrides,
  });

describe('toPollView', () => {
  it('hides counts from a non-author who has not voted on an open poll', () => {
    const result = view();
    expect(result.totalVotes).toBeNull();
    expect(result.options.every((o) => o.votes === null)).toBe(true);
    expect(result.canVote).toBe(true);
    expect(result.myVoteOptionId).toBeNull();
  });

  it('shows counts to someone who has voted, with 0 for unpicked options', () => {
    const result = view({ myVoteOptionId: 'a' });
    expect(result.options).toEqual([
      { id: 'a', text: 'Pizza', votes: 6 },
      { id: 'b', text: 'Ramen', votes: 0 },
    ]);
    expect(result.totalVotes).toBe(6);
    expect(result.myVoteOptionId).toBe('a');
    expect(result.canVote).toBe(true);
  });

  it('shows counts to the author, who cannot vote', () => {
    const result = view({ viewerId: 'author' });
    expect(result.totalVotes).toBe(6);
    expect(result.canVote).toBe(false);
    expect(result.myVoteOptionId).toBeNull();
  });

  it('shows counts to everyone once closed, and blocks voting', () => {
    const result = view({ now: new Date('2026-10-21T00:00:00Z') });
    expect(result.closed).toBe(true);
    expect(result.totalVotes).toBe(6);
    expect(result.canVote).toBe(false);
  });

  it('orders options by position', () => {
    expect(view().options.map((o) => o.id)).toEqual(['a', 'b']);
  });
});

describe('isClosed / closesAtFor', () => {
  it('is closed exactly at closesAt', () => {
    expect(isClosed({ closesAt: now }, now)).toBe(true);
    expect(isClosed({ closesAt: new Date(now.getTime() + 1) }, now)).toBe(
      false,
    );
  });

  it('adds whole minutes', () => {
    expect(closesAtFor(24 * 60, now).toISOString()).toBe(
      '2026-10-20T12:00:00.000Z',
    );
  });
});
