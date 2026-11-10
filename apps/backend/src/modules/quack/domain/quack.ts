import { PollView } from '@/modules/quack/domain/poll';

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;

export type QuackMood = (typeof QUACK_MOODS)[number];

/** What a reply shows about the quack it answers. */
export type QuackParent = {
  id: string;
  deleted: boolean;
  // null when the parent is a tombstone: its author is not kept
  username: string | null;
};

type QuackBase = {
  id: string;
  // null: a top-level quack
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Direct replies, tombstones included. Loaded with lists and threads.
  replyCount?: number;
  // Loaded with lists, so a reply can say what it answers.
  parent?: QuackParent | null;
};

export type LiveQuack = QuackBase & {
  deleted: false;
  text: string;
  mood: QuackMood | null;
  userId: string;
  user?: QuackAuthor;
  // Shaped for the viewer the quack was loaded for. `null`: no poll.
  poll?: PollView | null;
};

/**
 * A deleted quack that still has replies. Its text, mood, author and poll are
 * gone from the database; only its place in the thread is left.
 * See docs/adr/0001-anonymous-tombstones.md.
 */
export type DeletedQuack = QuackBase & {
  deleted: true;
  text: null;
  mood: null;
  userId: null;
  user: null;
  poll: null;
};

export type Quack = LiveQuack | DeletedQuack;

/** A quack, the quacks above it (root first) and everything below it. */
export type QuackThread = {
  ancestors: Quack[];
  focus: Quack;
  // Every reply under `focus`, at any depth, oldest first.
  descendants: Quack[];
};
