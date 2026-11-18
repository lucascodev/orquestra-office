export function decodePathSegment(text) {
  try {
    return decodeURIComponent(text);
  } catch (error) {
    if (error instanceof URIError) return null;
    throw error;
  }
}
