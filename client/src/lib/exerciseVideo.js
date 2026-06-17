// Provider abstraction for exercise form videos.
// To swap providers (Vimeo, self-hosted CDN, etc.), change only this file.
// All callers receive a ready-to-use iframe src string or null.

/**
 * Returns a YouTube embed src for the given video ID, or null if none.
 * @param {string|null|undefined} youtubeId
 * @returns {string|null}
 */
export function getExerciseVideoEmbed(youtubeId) {
  if (!youtubeId) return null;
  // rel=0 suppresses related-video suggestions; modestbranding=1 reduces logo clutter.
  return `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`;
}
