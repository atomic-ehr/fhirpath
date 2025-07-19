// Character classification lookup table for O(1) checks
export const CHAR_FLAGS = new Uint8Array(128);

// Bit flags for character properties
export const FLAG_DIGIT = 1 << 0;
export const FLAG_ALPHA = 1 << 1;
export const FLAG_WHITESPACE = 1 << 2;
export const FLAG_IDENTIFIER_START = 1 << 3;
export const FLAG_IDENTIFIER_CONT = 1 << 4;

// Initialize lookup table (called once at startup)
export function initCharTables(): void {
  // Digits
  for (let i = 48; i <= 57; i++) {
    CHAR_FLAGS[i]! |= FLAG_DIGIT | FLAG_IDENTIFIER_CONT;
  }
  
  // Letters
  for (let i = 65; i <= 90; i++) {
    CHAR_FLAGS[i]! |= FLAG_ALPHA | FLAG_IDENTIFIER_START | FLAG_IDENTIFIER_CONT;
  }
  for (let i = 97; i <= 122; i++) {
    CHAR_FLAGS[i]! |= FLAG_ALPHA | FLAG_IDENTIFIER_START | FLAG_IDENTIFIER_CONT;
  }
  
  // Underscore
  CHAR_FLAGS[95]! |= FLAG_IDENTIFIER_START | FLAG_IDENTIFIER_CONT;
  
  // Whitespace
  CHAR_FLAGS[32]! |= FLAG_WHITESPACE;  // space
  CHAR_FLAGS[9]! |= FLAG_WHITESPACE;   // tab
  CHAR_FLAGS[10]! |= FLAG_WHITESPACE;  // newline
  CHAR_FLAGS[13]! |= FLAG_WHITESPACE;  // carriage return
}

// Initialize the table immediately
initCharTables();