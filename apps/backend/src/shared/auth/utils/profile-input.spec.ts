import { normalizeProfileInput, ProfileInputError } from './profile-input';

const update = (body: Record<string, unknown>): Record<string, unknown> => {
  normalizeProfileInput('/update-user', body);
  return body;
};

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof ProfileInputError) return error.code;
    throw error;
  }
  return undefined;
};

describe('normalizeProfileInput', () => {
  describe('other requests', () => {
    it('leaves other endpoints alone', () => {
      const body = { name: '   ', bio: 5, defaultMood: 'bored' };
      expect(() => normalizeProfileInput('/sign-in/email', body)).not.toThrow();
      expect(body).toEqual({ name: '   ', bio: 5, defaultMood: 'bored' });
    });

    it.each([undefined, null, 'text', 5, []])('ignores a %p body', (body) => {
      expect(() => normalizeProfileInput('/update-user', body)).not.toThrow();
    });

    it('does not add fields that were not sent', () => {
      expect(update({ username: 'Duck' })).toEqual({
        username: 'Duck',
        displayUsername: 'Duck',
      });
    });
  });

  describe('displayUsername', () => {
    it('is the typed username, whatever the client sent', () => {
      expect(
        update({ username: 'Duck.Fan', displayUsername: 'Admin' }),
      ).toEqual({ username: 'Duck.Fan', displayUsername: 'Duck.Fan' });
    });

    it('cannot be changed on its own when updating', () => {
      expect(update({ name: 'Duck', displayUsername: 'Admin' })).toEqual({
        name: 'Duck',
      });
    });

    it('may arrive alone on sign-up (the username plugin derives the username from it)', () => {
      const body = { displayUsername: 'Duck', email: 'a@b.cz' };
      normalizeProfileInput('/sign-up/email', body);
      expect(body.displayUsername).toBe('Duck');
    });

    it('is overridden on sign-up too', () => {
      const body = { username: 'Duck', displayUsername: 'Admin' };
      normalizeProfileInput('/sign-up/email', body);
      expect(body.displayUsername).toBe('Duck');
    });
  });

  describe('name', () => {
    it('is trimmed', () => {
      expect(update({ name: '  Caffeinated Duck ' }).name).toBe(
        'Caffeinated Duck',
      );
    });

    it.each(['', '   ', null, 5])('is required: rejects %p', (name) => {
      expect(codeOf(() => update({ name }))).toBe('NAME_REQUIRED');
    });

    it('accepts 50 characters and rejects 51', () => {
      expect(codeOf(() => update({ name: 'a'.repeat(50) }))).toBeUndefined();
      expect(codeOf(() => update({ name: 'a'.repeat(51) }))).toBe(
        'NAME_TOO_LONG',
      );
    });

    it('counts the trimmed name', () => {
      expect(
        codeOf(() => update({ name: ` ${'a'.repeat(50)} ` })),
      ).toBeUndefined();
    });
  });

  describe('bio', () => {
    it('is trimmed', () => {
      expect(update({ bio: '  Quack. ' }).bio).toBe('Quack.');
    });

    it.each(['', '   ', null])('stores %p as nothing', (bio) => {
      expect(update({ bio }).bio).toBeNull();
    });

    it('accepts 160 characters and rejects 161', () => {
      expect(codeOf(() => update({ bio: 'a'.repeat(160) }))).toBeUndefined();
      expect(codeOf(() => update({ bio: 'a'.repeat(161) }))).toBe(
        'BIO_TOO_LONG',
      );
    });

    it.each([5, true, ['x'], {}])('rejects %p', (bio) => {
      expect(codeOf(() => update({ bio }))).toBe('INVALID_BIO');
    });
  });

  describe('defaultMood', () => {
    it.each(['happy', 'sad', 'angry', 'silly'])('accepts %s', (defaultMood) => {
      expect(update({ defaultMood }).defaultMood).toBe(defaultMood);
    });

    it.each(['', 'none', null])('stores %p as no mood', (defaultMood) => {
      expect(update({ defaultMood }).defaultMood).toBeNull();
    });

    it.each(['bored', 'HAPPY', 5, ['happy']])('rejects %p', (defaultMood) => {
      expect(codeOf(() => update({ defaultMood }))).toBe(
        'INVALID_DEFAULT_MOOD',
      );
    });
  });

  it('applies the same rules on sign-up', () => {
    expect(
      codeOf(() =>
        normalizeProfileInput('/sign-up/email', { bio: 'a'.repeat(161) }),
      ),
    ).toBe('BIO_TOO_LONG');
  });
});
