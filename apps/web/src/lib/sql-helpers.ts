/**
 * Escape `%`, `_` and `\` so user input is matched literally inside an
 * ILIKE pattern (Postgres' default LIKE escape character is `\`).
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** `%input%` with wildcards in the input escaped. */
export function containsPattern(input: string): string {
  return `%${escapeLike(input)}%`;
}
