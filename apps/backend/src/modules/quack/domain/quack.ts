import { PollView } from '@/modules/quack/domain/poll';

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;

export type QuackMood = (typeof QUACK_MOODS)[number];

export type Quack = {
  id: string;
  text: string;
  mood: QuackMood | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: QuackAuthor;
  // Shaped for the viewer the quack was loaded for. `null`: no poll.
  poll?: PollView | null;
};
