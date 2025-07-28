// Export production parser (optimized for performance)
export { Parser as ProdParser, parse as parseProd } from '../../src/parser';
export type { ASTNode as ProdASTNode } from '../../src/parser';

// Export LSP parser (rich features for IDE support)
export { LSPParser, parseLSP, parsePartialLSP } from '../../src/parser-lsp';
export type { LSPASTNode, LSPParseResult, PartialParseResult } from '../../src/parser-lsp';

// Re-export shared types
export { NodeType } from '../../src/parser-base';
export type { Position } from '../../src/parser-base';

// Default export is the production parser
export { Parser, parse } from '../../src/parser';
export type { ASTNode } from '../../src/parser';