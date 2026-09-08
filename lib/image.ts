// Candidate images are static repository assets served from /public/candidates.
// No remote image fetching or runtime file uploads are required.
// This file is kept for compatibility with older code that may import it.
export function candidateImagePath(path: string): string {
  const value = path.trim();
  if (!value) return "";
  return value.startsWith("/") ? value : `/candidates/${value}`;
}
