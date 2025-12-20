/**
 * Utility function to format driver notes with proper line breaks for numbered instructions
 * This function takes merged numbered instructions and formats them for better readability
 */

export function formatDriverNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  
  // Clean up the input string
  let formattedNotes = notes.trim();
  
  // Regex pattern to match numbered instructions (1., 2., 3., etc.)
  // This will match patterns like "1. TEXT" or "1.TEXT" followed by more content
  const numberedPattern = /(\d+\.\s*)/g;
  
  // Split the text at numbered points and rejoin with line breaks
  // First, add line breaks before numbered items (except the first one)
  formattedNotes = formattedNotes.replace(/(\s+)(\d+\.\s*)/g, '\n\n$2');
  
  // Clean up any multiple consecutive line breaks
  formattedNotes = formattedNotes.replace(/\n{3,}/g, '\n\n');
  
  // Trim any leading/trailing whitespace
  formattedNotes = formattedNotes.trim();
  
  return formattedNotes;
}

/**
 * Alternative function that returns formatted notes as an array of lines
 * Useful for React components that need to render each line separately
 */
export function formatDriverNotesAsArray(notes: string | null | undefined): string[] {
  const formatted = formatDriverNotes(notes);
  if (!formatted) return [];
  
  return formatted.split('\n').filter(line => line.trim().length > 0);
}

/**
 * Function to format notes for HTML display with proper line breaks
 * Converts \n to <br> tags for HTML rendering
 */
export function formatDriverNotesForHTML(notes: string | null | undefined): string {
  const formatted = formatDriverNotes(notes);
  return formatted.replace(/\n/g, '<br>');
}
