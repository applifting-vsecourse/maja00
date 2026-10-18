export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/** Splits a search query into its words. Every word has to match a quack. */
export const toSearchWords = (query: string): string[] =>
  query.trim().split(/\s+/).filter(Boolean);

/** Makes `%`, `_` and `\` match literally inside a LIKE pattern. */
export const escapeLike = (word: string): string =>
  word.replace(/[\\%_]/g, (char) => `\\${char}`);
