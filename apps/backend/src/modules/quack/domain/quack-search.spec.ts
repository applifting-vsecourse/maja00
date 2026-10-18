import { escapeLike, toSearchWords } from './quack-search';

describe('toSearchWords', () => {
  it('splits on any whitespace and ignores the edges', () => {
    expect(toSearchWords('  pond \t crumb\nduck ')).toEqual([
      'pond',
      'crumb',
      'duck',
    ]);
  });

  it('returns no words for a blank query', () => {
    expect(toSearchWords('   ')).toEqual([]);
  });
});

describe('escapeLike', () => {
  it('escapes the LIKE wildcards and the escape character', () => {
    expect(escapeLike('100%')).toBe(String.raw`100\%`);
    expect(escapeLike('a_b')).toBe(String.raw`a\_b`);
    expect(escapeLike(String.raw`a\b`)).toBe(String.raw`a\\b`);
  });

  it('leaves ordinary words alone', () => {
    expect(escapeLike('café')).toBe('café');
  });
});
