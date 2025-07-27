// Export production parser (optimized for performance)
export { Parser as ProdParser, parse as parseProd } from './prod';
export type { ASTNode as ProdASTNode } from './prod';

// Export LSP parser (rich features for IDE support)
export { LSPParser, parseLSP, parsePartialLSP } from './lsp';
export type { LSPASTNode, LSPParseResult, PartialParseResult } from './lsp';

// Re-export shared types
export { NodeType } from './base';
export type { Position } from './base';

// Default export is the production parser
export { Parser, parse } from './prod';
export type { ASTNode } from './prod';