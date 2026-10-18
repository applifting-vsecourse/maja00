export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
export const POLL_OPTION_MAX_LENGTH = 50;
export const POLL_MIN_DURATION_MINUTES = 1;
export const POLL_MAX_DURATION_MINUTES = 7 * 24 * 60;

const MINUTE_IN_MS = 60 * 1000;

export type PollOption = {
  id: string;
  text: string;
  position: number;
};

/** A poll as stored: no viewer, no counts. */
export type Poll = {
  id: string;
  quackId: string;
  closesAt: Date;
  options: PollOption[];
};

/** A poll as one viewer is allowed to see it. */
export type PollView = {
  id: string;
  closesAt: Date;
  closed: boolean;
  options: { id: string; text: string; votes: number | null }[];
  totalVotes: number | null;
  myVoteOptionId: string | null;
  canVote: boolean;
};

export const closesAtFor = (durationMinutes: number, now: Date): Date =>
  new Date(now.getTime() + durationMinutes * MINUTE_IN_MS);

export const isClosed = (poll: Pick<Poll, 'closesAt'>, now: Date): boolean =>
  poll.closesAt.getTime() <= now.getTime();

/**
 * The one place that decides what a viewer may see of a poll.
 *
 * Counts are visible to the author, to anyone who has voted, and to everyone
 * once the poll is closed. Otherwise they are `null`, so a client can never
 * show what the server did not send.
 */
export function toPollView(params: {
  poll: Poll;
  // Votes per option id. Options nobody picked may be missing.
  counts: Map<string, number>;
  viewerId: string;
  authorId: string;
  myVoteOptionId: string | null;
  now: Date;
}): PollView {
  const { poll, counts, viewerId, authorId, myVoteOptionId, now } = params;
  const closed = isClosed(poll, now);
  const isAuthor = viewerId === authorId;
  const showCounts = closed || isAuthor || myVoteOptionId !== null;

  const options = [...poll.options]
    .sort((a, b) => a.position - b.position)
    .map((option) => ({
      id: option.id,
      text: option.text,
      votes: showCounts ? (counts.get(option.id) ?? 0) : null,
    }));

  return {
    id: poll.id,
    closesAt: poll.closesAt,
    closed,
    options,
    totalVotes: showCounts
      ? options.reduce((sum, option) => sum + (option.votes ?? 0), 0)
      : null,
    // The author cannot vote, so they never have a vote of their own.
    myVoteOptionId: isAuthor ? null : myVoteOptionId,
    canVote: !closed && !isAuthor,
  };
}
