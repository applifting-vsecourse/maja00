import { QuackMood } from '@/generated/prisma/enums';

export const PROFILE_NAME_MAX_LENGTH = 50;
export const PROFILE_BIO_MAX_LENGTH = 160;

const MOODS: readonly string[] = Object.values(QuackMood);

// Where BetterAuth accepts profile fields from clients.
const PROFILE_PATHS = ['/update-user', '/sign-up/email'];

/** A rejected profile field. The auth hook turns it into a 400 with the same code. */
export class ProfileInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Cleans up and checks the profile fields of a sign-up / update-user request
 * body, in place. Kept free of any better-auth import so it can be unit tested.
 *
 * BetterAuth validates `username` itself (length, characters, uniqueness) but
 * nothing else here: without these checks an over-long bio or an unknown mood
 * would reach the database and come back as a 500.
 */
export function normalizeProfileInput(path: string, body: unknown): void {
  if (
    !PROFILE_PATHS.includes(path) ||
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body)
  ) {
    return;
  }
  const input = body as Record<string, unknown>;

  // `displayUsername` is the spelling shown to people. It must be the typed
  // username, never something a client picks separately — otherwise someone
  // could appear as another user.
  if (typeof input.username === 'string') {
    input.displayUsername = input.username;
  } else if (path === '/update-user') {
    delete input.displayUsername;
  }

  if ('name' in input) {
    if (typeof input.name !== 'string' || input.name.trim() === '') {
      throw new ProfileInputError('NAME_REQUIRED', 'Display name is required');
    }
    const name = input.name.trim();
    if (name.length > PROFILE_NAME_MAX_LENGTH) {
      throw new ProfileInputError(
        'NAME_TOO_LONG',
        `Display name can be at most ${PROFILE_NAME_MAX_LENGTH} characters`,
      );
    }
    input.name = name;
  }

  if ('bio' in input) {
    if (input.bio !== null && typeof input.bio !== 'string') {
      throw new ProfileInputError('INVALID_BIO', 'Bio must be text');
    }
    const bio = input.bio?.trim() ?? '';
    if (bio.length > PROFILE_BIO_MAX_LENGTH) {
      throw new ProfileInputError(
        'BIO_TOO_LONG',
        `Bio can be at most ${PROFILE_BIO_MAX_LENGTH} characters`,
      );
    }
    input.bio = bio === '' ? null : bio;
  }

  if ('defaultMood' in input) {
    const mood = input.defaultMood;
    if (mood === null || mood === '' || mood === 'none') {
      input.defaultMood = null;
    } else if (typeof mood !== 'string' || !MOODS.includes(mood)) {
      throw new ProfileInputError(
        'INVALID_DEFAULT_MOOD',
        `Default mood must be one of: ${MOODS.join(', ')}`,
      );
    }
  }
}
