import { Channel, TokenType } from '../lexer';
import type { Token } from '../lexer';
import type { TriviaInfo } from '../types';

export interface TriviaSpans {
  leadingByStart: Map<number, TriviaInfo[]>;
  trailingByEnd: Map<number, TriviaInfo[]>;
  tokenByStart: Map<number, Token>;
  tokenByEnd: Map<number, Token>;
}

export function computeTriviaSpans(allTokens: Token[]): TriviaSpans {
  const leadingByStart = new Map<number, TriviaInfo[]>();
  const trailingByEnd = new Map<number, TriviaInfo[]>();
  const tokenByStart = new Map<number, Token>();
  const tokenByEnd = new Map<number, Token>();

  let acc: TriviaInfo[] = [];
  let lastDefault: Token | undefined;

  const toTrivia = (token: Token): TriviaInfo | null => {
    const range = token.range || {
      start: { line: 0, character: 0, offset: token.start },
      end: { line: 0, character: 0, offset: token.end }
    };
    if (token.type === TokenType.WHITESPACE) {
      return { type: 'whitespace', value: token.value, range };
    }
    if (token.type === TokenType.LINE_COMMENT) {
      return { type: 'lineComment', value: token.value, range };
    }
    if (token.type === TokenType.BLOCK_COMMENT) {
      return { type: 'comment', value: token.value, range };
    }
    return null;
  };

  for (const tok of allTokens) {
    const isHidden = tok.channel === Channel.HIDDEN;
    if (isHidden) {
      const trivia = toTrivia(tok);
      if (trivia) acc.push(trivia);
      continue;
    }
    const accCopy = acc.length ? acc.slice() : [];
    if (lastDefault) {
      trailingByEnd.set(lastDefault.end, accCopy);
    }
    leadingByStart.set(tok.start, accCopy);
    tokenByStart.set(tok.start, tok);
    tokenByEnd.set(tok.end, tok);
    acc = [];
    lastDefault = tok;
  }

  return { leadingByStart, trailingByEnd, tokenByStart, tokenByEnd };
}

