const idCharacters = 'abcdef0123456789';

/**
 * Returns a random id in Archi's format: `id-` followed by 32 hex characters.
 */
export function randomArchiId(): string {
  let id = 'id-';
  for (let i = 0; i < 32; i++) {
    id += idCharacters.charAt(Math.floor(Math.random() * idCharacters.length));
  }
  return id;
}
