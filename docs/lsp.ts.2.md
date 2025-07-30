/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
export type DocumentUri = string;
export type URI = string;
export type integer = number;
export type uinteger = number;
export type decimal = number;

export type LSPAny = any;
export type LSPObject = object;
export type LSPArray = any[];

export interface Position {
	line: uinteger;
	character: uinteger;
}

export interface Range {
	start: Position;
	end: Position;
}

export interface Location {
	uri: DocumentUri;
	range: Range;
}

export interface LocationLink {
	originSelectionRange?: Range;
	targetUri: DocumentUri;
	targetRange: Range;
	targetSelectionRange: Range;
}
export interface Color {
	readonly red: decimal;
	readonly green: decimal;
	readonly blue: decimal;
	readonly alpha: decimal;
}

export interface ColorInformation {
	range: Range;
	color: Color;
}

export interface ColorPresentation {
	label: string;
	textEdit?: TextEdit;
	additionalTextEdits?: TextEdit[];
}

export interface FoldingRange {
	startLine: uinteger;
	startCharacter?: uinteger;
	endLine: uinteger;
	endCharacter?: uinteger;

	kind?: FoldingRangeKind;

	collapsedText?: string;
}

export interface DiagnosticRelatedInformation {
	location: Location;
	message: string;
}
export namespace DiagnosticSeverity {
	export const Error: 1 = 1;
	export const Warning: 2 = 2;
	export const Information: 3 = 3;
	export const Hint: 4 = 4;
}

export type DiagnosticSeverity = 1 | 2 | 3 | 4;
export type DiagnosticTag = 1 | 2;

export interface CodeDescription {
	href: URI;
}

export interface Diagnostic {
	range: Range;
	severity?: DiagnosticSeverity;
	code?: integer | string;
	codeDescription?: CodeDescription;
	source?: string;
	message: string;
	tags?: DiagnosticTag[];
	relatedInformation?: DiagnosticRelatedInformation[];
	data?: LSPAny;
}

export interface Command {
	title: string;
	tooltip?: string;
	command: string;
	arguments?: LSPAny[];
}

export interface TextEdit {
	range: Range;
	newText: string;
}
export interface ChangeAnnotation {
	label: string;
	needsConfirmation?: boolean;
	description?: string;
}

export type ChangeAnnotationIdentifier = string;

export interface AnnotatedTextEdit extends TextEdit {
	annotationId: ChangeAnnotationIdentifier;
}

export interface TextDocumentEdit {
	textDocument: OptionalVersionedTextDocumentIdentifier;
	edits: (TextEdit | AnnotatedTextEdit | SnippetTextEdit)[];
}

interface ResourceOperation {
	kind: string;
	annotationId?: ChangeAnnotationIdentifier;
}

export interface CreateFileOptions {
	overwrite?: boolean;
	ignoreIfExists?: boolean;
}

export interface CreateFile extends ResourceOperation {
	kind: 'create';
	uri: DocumentUri;
	options?: CreateFileOptions;
}

export interface RenameFileOptions {
	overwrite?: boolean;
	ignoreIfExists?: boolean;
}

export interface RenameFile extends ResourceOperation {
	kind: 'rename';
	oldUri: DocumentUri;
	newUri: DocumentUri;
	options?: RenameFileOptions;
}

export interface DeleteFileOptions {
	recursive?: boolean;
	ignoreIfNotExists?: boolean;
}

export interface DeleteFile extends ResourceOperation {
	kind: 'delete';
	uri: DocumentUri;
	options?: DeleteFileOptions;
}

export interface WorkspaceEdit {
	changes?: { [uri: DocumentUri]: TextEdit[] };
	documentChanges?: (TextDocumentEdit | CreateFile | RenameFile | DeleteFile)[];
	changeAnnotations?: { [id: ChangeAnnotationIdentifier]: ChangeAnnotation };
	changeAnnotations?: {
		[id: ChangeAnnotationIdentifier]: ChangeAnnotation;
	};
}

export type WorkspaceEditMetadata = {
	isRefactoring?: boolean;
};

export interface TextEditChange {
	edits: (TextEdit | AnnotatedTextEdit | SnippetTextEdit)[];
	changeAnnotations?: { [id: ChangeAnnotationIdentifier]: ChangeAnnotation };
	all(): (TextEdit | AnnotatedTextEdit | SnippetTextEdit)[];
	clear(): void;
	add(edit: TextEdit | AnnotatedTextEdit | SnippetTextEdit): void;
	
	insert(position: Position, newText: string): void;
	insert(position: Position, newText: string, annotation: ChangeAnnotation | ChangeAnnotationIdentifier): ChangeAnnotationIdentifier;
	replace(range: Range, newText: string): void;
	replace(range: Range, newText: string, annotation?: ChangeAnnotation | ChangeAnnotationIdentifier): ChangeAnnotationIdentifier;
	delete(range: Range): void;
	delete(range: Range, annotation?: ChangeAnnotation | ChangeAnnotationIdentifier): ChangeAnnotationIdentifier;
}

export interface TextDocumentIdentifier {
	uri: DocumentUri;
}

export interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
	version: integer;
}

export namespace CompletionItemKind {
	export const Text: 1 = 1;
	export const Method: 2 = 2;
	export const Function: 3 = 3;
	export const Constructor: 4 = 4;
	export const Field: 5 = 5;
	export const Variable: 6 = 6;
	export const Class: 7 = 7;
	export const Interface: 8 = 8;
	export const Module: 9 = 9;
	export const Property: 10 = 10;
	export const Unit: 11 = 11;
	export const Value: 12 = 12;
	export const Enum: 13 = 13;
	export const Keyword: 14 = 14;
	export const Snippet: 15 = 15;
	export const Color: 16 = 16;
	export const File: 17 = 17;
	export const Reference: 18 = 18;
	export const Folder: 19 = 19;
	export const EnumMember: 20 = 20;
	export const Constant: 21 = 21;
	export const Struct: 22 = 22;
	export const Event: 23 = 23;
	export const Operator: 24 = 24;
	export const TypeParameter: 25 = 25;
}

export type CompletionItemKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25;

export type InsertTextFormat = 1 | 2;

export namespace CompletionItemTag {
	export const Deprecated = 1;
}

export interface InsertReplaceEdit {
	newText: string;
	insert: Range;
	replace: Range;
}

export interface CompletionItemLabelDetails {
	detail?: string;
	description?: string;
}

export interface CompletionItem {
	label: string;
	labelDetails?: CompletionItemLabelDetails;
	kind?: CompletionItemKind;
	tags?: CompletionItemTag[];
	detail?: string;
	documentation?: string | MarkupContent;
	deprecated?: boolean;
	preselect?: boolean;
	sortText?: string;
	filterText?: string;
	insertText?: string;
	insertTextFormat?: InsertTextFormat;
	insertTextMode?: InsertTextMode;
	deprecated?: boolean;
	preselect?: boolean;
	sortText?: string;
	filterText?: string;
	insertText?: string;
	insertTextFormat?: InsertTextFormat;
	insertTextMode?: InsertTextMode;
	textEdit?: TextEdit | InsertReplaceEdit;
	textEditText?: string;
	additionalTextEdits?: TextEdit[];
	commitCharacters?: string[];
	command?: Command;
	data?: LSPAny;
}
export interface CompletionItemDefaults {
	commitCharacters?: string[];
	editRange?: Range | EditRangeWithInsertReplace;
	editRange?: Range | EditRangeWithInsertReplace;
	insertTextFormat?: InsertTextFormat;
	insertTextMode?: InsertTextMode;
	data?: LSPAny;
}

export interface CompletionList {
	isIncomplete: boolean;
	itemDefaults?: CompletionItemDefaults;
	applyKind?: CompletionItemApplyKinds;
	itemDefaults?: CompletionItemDefaults;
	/**
	 * The completion items.
	 */
	items: CompletionItem[];
}

/**
 * The CompletionList namespace provides functions to deal with
 * completion lists.
 */
export namespace CompletionList {
	/**
	 * Creates a new completion list.
	 *
	 * @param items The completion items.
	 * @param isIncomplete The list is not complete.
	 */
	export function create(items?: CompletionItem[], isIncomplete?: boolean): CompletionList {
		return { items: items ? items : [], isIncomplete: !!isIncomplete };
	}
}

/**
 * @since 3.18.0
 * @deprecated use MarkupContent instead.
 */
export type MarkedStringWithLanguage = {
	language: string;
	value: string;
};

/**
 * MarkedString can be used to render human readable text. It is either a markdown string
 * or a code-block that provides a language and a code snippet. The language identifier
 * is semantically equal to the optional language identifier in fenced code blocks in GitHub
 * issues. See https://help.github.com/articles/creating-and-highlighting-code-blocks/#syntax-highlighting
 *
 * The pair of a language and a value is an equivalent to markdown:
 * ```${language}
 * ${value}
 * ```
 *
 * Note that markdown strings will be sanitized - that means html will be escaped.
 * @deprecated use MarkupContent instead.
 */
export type MarkedString = string | MarkedStringWithLanguage;

export namespace MarkedString {
	/**
	 * Creates a marked string from plain text.
	 *
	 * @param plainText The plain text.
	 */
	export function fromPlainText(plainText: string): string {
		return plainText.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&'); // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
	}

	/**
	 * Checks whether the given value conforms to the {@link MarkedString} type.
	 */
	export function is(value: any): value is MarkedString {
		const candidate = value as MarkedString;
		return Is.string(candidate) || (Is.objectLiteral(candidate) && Is.string(candidate.language) && Is.string(candidate.value));
	}
}

/**
 * The result of a hover request.
 */
export interface Hover {
	/**
	 * The hover's content
	 */
	contents: MarkupContent | MarkedString | MarkedString[];

	/**
	 * An optional range inside the text document that is used to
	 * visualize the hover, e.g. by changing the background color.
	 */
	range?: Range;
}

export namespace Hover {
	/**
	 * Checks whether the given value conforms to the {@link Hover} interface.
	 */
	export function is(value: any): value is Hover {
		const candidate = value as Hover;
		return !!candidate && Is.objectLiteral(candidate) && (
			MarkupContent.is(candidate.contents) ||
			MarkedString.is(candidate.contents) ||
			Is.typedArray(candidate.contents, MarkedString.is)
		) && (
			value.range === undefined || Range.is(value.range)
		);
	}
}

/**
 * Represents a parameter of a callable-signature. A parameter can
 * have a label and a doc-comment.
 */
export interface ParameterInformation {

	/**
	 * The label of this parameter information.
	 *
	 * Either a string or an inclusive start and exclusive end offsets within its containing
	 * signature label. (see SignatureInformation.label). The offsets are based on a UTF-16
	 * string representation as `Position` and `Range` does.
	 *
	 * To avoid ambiguities a server should use the [start, end] offset value instead of using
	 * a substring. Whether a client support this is controlled via `labelOffsetSupport` client
	 * capability.
	 *
	 * *Note*: a label of type string should be a substring of its containing signature label.
	 * Its intended use case is to highlight the parameter label part in the `SignatureInformation.label`.
	 */
	label: string | [uinteger, uinteger];

	/**
	 * The human-readable doc-comment of this parameter. Will be shown
	 * in the UI but can be omitted.
	 */
	documentation?: string | MarkupContent;
}

/**
 * The ParameterInformation namespace provides helper functions to work with
 * {@link ParameterInformation} literals.
 */
export namespace ParameterInformation {
	/**
	 * Creates a new parameter information literal.
	 *
	 * @param label A label string.
	 * @param documentation A doc string.
	 */
	export function create(label: string | [uinteger, uinteger], documentation?: string): ParameterInformation {
		return documentation ? { label, documentation } : { label };
	}
}

/**
 * Represents the signature of something callable. A signature
 * can have a label, like a function-name, a doc-comment, and
 * a set of parameters.
 */
export interface SignatureInformation {
	/**
	 * The label of this signature. Will be shown in
	 * the UI.
	 */
	label: string;

	/**
	 * The human-readable doc-comment of this signature. Will be shown
	 * in the UI but can be omitted.
	 */
	documentation?: string | MarkupContent;

	/**
	 * The parameters of this signature.
	 */
	parameters?: ParameterInformation[];

	/**
	 * The index of the active parameter.
	 *
	 * If `null`, no parameter of the signature is active (for example a named
	 * argument that does not match any declared parameters). This is only valid
	 * if the client specifies the client capability
	 * `textDocument.signatureHelp.noActiveParameterSupport === true`
	 *
	 * If provided (or `null`), this is used in place of
	 * `SignatureHelp.activeParameter`.
	 *
	 * @since 3.16.0
	 */
	activeParameter?: uinteger | null;
}

/**
 * The SignatureInformation namespace provides helper functions to work with
 * {@link SignatureInformation} literals.
 */
export namespace SignatureInformation {
	export function create(label: string, documentation?: string, ...parameters: ParameterInformation[]): SignatureInformation {
		const result: SignatureInformation = { label };
		if (Is.defined(documentation)) {
			result.documentation = documentation;
		}
		if (Is.defined(parameters)) {
			result.parameters = parameters;
		} else {
			result.parameters = [];
		}
		return result;
	}
}

/**
 * Signature help represents the signature of something
 * callable. There can be multiple signature but only one
 * active and only one active parameter.
 */
export interface SignatureHelp {
	/**
	 * One or more signatures.
	 */
	signatures: SignatureInformation[];

	/**
	 * The active signature. If omitted or the value lies outside the
	 * range of `signatures` the value defaults to zero or is ignored if
	 * the `SignatureHelp` has no signatures.
	 *
	 * Whenever possible implementors should make an active decision about
	 * the active signature and shouldn't rely on a default value.
	 *
	 * In future version of the protocol this property might become
	 * mandatory to better express this.
	 */
	activeSignature?: uinteger;

	/**
	 * The active parameter of the active signature.
	 *
	 * If `null`, no parameter of the signature is active (for example a named
	 * argument that does not match any declared parameters). This is only valid
	 * if the client specifies the client capability
	 * `textDocument.signatureHelp.noActiveParameterSupport === true`
	 *
	 * If omitted or the value lies outside the range of
	 * `signatures[activeSignature].parameters` defaults to 0 if the active
	 * signature has parameters.
	 *
	 * If the active signature has no parameters it is ignored.
	 *
	 * In future version of the protocol this property might become
	 * mandatory (but still nullable) to better express the active parameter if
	 * the active signature does have any.
	 */
	activeParameter?: uinteger | null;
}

/**
 * The definition of a symbol represented as one or many {@link Location locations}.
 * For most programming languages there is only one location at which a symbol is
 * defined.
 *
 * Servers should prefer returning `DefinitionLink` over `Definition` if supported
 * by the client.
 */
export type Definition = Location | Location[];

/**
 * Information about where a symbol is defined.
 *
 * Provides additional metadata over normal {@link Location location} definitions, including the range of
 * the defining symbol
 */
export type DefinitionLink = LocationLink;

/**
 * The declaration of a symbol representation as one or many {@link Location locations}.
 */
export type Declaration = Location | Location[];

/**
 * Information about where a symbol is declared.
 *
 * Provides additional metadata over normal {@link Location location} declarations, including the range of
 * the declaring symbol.
 *
 * Servers should prefer returning `DeclarationLink` over `Declaration` if supported
 * by the client.
 */
export type DeclarationLink = LocationLink;

/**
 * Value-object that contains additional information when
 * requesting references.
 */
export interface ReferenceContext {
	/**
	 * Include the declaration of the current symbol.
	 */
	includeDeclaration: boolean;
}

/**
 * A document highlight kind.
 */
export namespace DocumentHighlightKind {
	/**
	 * A textual occurrence.
	 */
	export const Text: 1 = 1;

	/**
	 * Read-access of a symbol, like reading a variable.
	 */
	export const Read: 2 = 2;

	/**
	 * Write-access of a symbol, like writing to a variable.
	 */
	export const Write: 3 = 3;
}

export type DocumentHighlightKind = 1 | 2 | 3;

/**
 * A document highlight is a range inside a text document which deserves
 * special attention. Usually a document highlight is visualized by changing
 * the background color of its range.
 */
export interface DocumentHighlight {
	/**
	 * The range this highlight applies to.
	 */
	range: Range;

	/**
	 * The highlight kind, default is {@link DocumentHighlightKind.Text text}.
	 */
	kind?: DocumentHighlightKind;
}

/**
 * DocumentHighlight namespace to provide helper functions to work with
 * {@link DocumentHighlight} literals.
 */
export namespace DocumentHighlight {
	/**
	 * Create a DocumentHighlight object.
	 * @param range The range the highlight applies to.
	 * @param kind The highlight kind
	 */
	export function create(range: Range, kind?: DocumentHighlightKind): DocumentHighlight {
		const result: DocumentHighlight = { range };
		if (Is.number(kind)) {
			result.kind = kind;
		}
		return result;
	}
}

/**
 * A symbol kind.
 */
export namespace SymbolKind {
	export const File: 1 = 1;
	export const Module: 2 = 2;
	export const Namespace: 3 = 3;
	export const Package: 4 = 4;
	export const Class: 5 = 5;
	export const Method: 6 = 6;
	export const Property: 7 = 7;
	export const Field: 8 = 8;
	export const Constructor: 9 = 9;
	export const Enum: 10 = 10;
	export const Interface: 11 = 11;
	export const Function: 12 = 12;
	export const Variable: 13 = 13;
	export const Constant: 14 = 14;
	export const String: 15 = 15;
	export const Number: 16 = 16;
	export const Boolean: 17 = 17;
	export const Array: 18 = 18;
	export const Object: 19 = 19;
	export const Key: 20 = 20;
	export const Null: 21 = 21;
	export const EnumMember: 22 = 22;
	export const Struct: 23 = 23;
	export const Event: 24 = 24;
	export const Operator: 25 = 25;
	export const TypeParameter: 26 = 26;
}

export type SymbolKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26;

/**
 * Symbol tags are extra annotations that tweak the rendering of a symbol.
 *
 * @since 3.16
 */
export namespace SymbolTag {

	/**
	 * Render a symbol as obsolete, usually using a strike-out.
	 */
	export const Deprecated: 1 = 1;
}

export type SymbolTag = 1;


/**
 * A base for all symbol information.
 */
export interface BaseSymbolInformation {
	/**
	 * The name of this symbol.
	 */
	name: string;

	/**
	 * The kind of this symbol.
	 */
	kind: SymbolKind;

	/**
	 * Tags for this symbol.
	 *
	 * @since 3.16.0
	 */
	tags?: SymbolTag[];

	/**
	 * The name of the symbol containing this symbol. This information is for
	 * user interface purposes (e.g. to render a qualifier in the user interface
	 * if necessary). It can't be used to re-infer a hierarchy for the document
	 * symbols.
	 */
	containerName?: string;
}

/**
 * Represents information about programming constructs like variables, classes,
 * interfaces etc.
 */
export interface SymbolInformation extends BaseSymbolInformation {
	/**
	 * Indicates if this symbol is deprecated.
	 *
	 * @deprecated Use tags instead
	 */
	deprecated?: boolean;

	/**
	 * The location of this symbol. The location's range is used by a tool
	 * to reveal the location in the editor. If the symbol is selected in the
	 * tool the range's start information is used to position the cursor. So
	 * the range usually spans more than the actual symbol's name and does
	 * normally include things like visibility modifiers.
	 *
	 * The range doesn't have to denote a node range in the sense of an abstract
	 * syntax tree. It can therefore not be used to re-construct a hierarchy of
	 * the symbols.
	 */
	location: Location;
}

export namespace SymbolInformation {
	/**
	 * Creates a new symbol information literal.
	 *
	 * @param name The name of the symbol.
	 * @param kind The kind of the symbol.
	 * @param range The range of the location of the symbol.
	 * @param uri The resource of the location of symbol.
	 * @param containerName The name of the symbol containing the symbol.
	 */
	export function create(name: string, kind: SymbolKind, range: Range, uri: DocumentUri, containerName?: string): SymbolInformation {
		const result: SymbolInformation = {
			name,
			kind,
			location: { uri, range }
		};
		if (containerName) {
			result.containerName = containerName;
		}
		return result;
	}
}

/**
 * Location with only uri and does not include range.
 *
 * @since 3.18.0
 */
export type LocationUriOnly = {
	uri: DocumentUri;
};

/**
 * A special workspace symbol that supports locations without a range.
 *
 * See also SymbolInformation.
 *
 * @since 3.17.0
 */
export interface WorkspaceSymbol extends BaseSymbolInformation {
	/**
	 * The location of the symbol. Whether a server is allowed to
	 * return a location without a range depends on the client
	 * capability `workspace.symbol.resolveSupport`.
	 *
	 * See SymbolInformation#location for more details.
	 */
	location: Location | LocationUriOnly;

	/**
	 * A data entry field that is preserved on a workspace symbol between a
	 * workspace symbol request and a workspace symbol resolve request.
	 */
	data?: LSPAny;
}

export namespace WorkspaceSymbol {

	/**
	 * Create a new workspace symbol.
	 *
	 * @param name The name of the symbol.
	 * @param kind The kind of the symbol.
	 * @param uri The resource of the location of the symbol.
	 * @param range An options range of the location.
	 * @returns A WorkspaceSymbol.
	 */
	export function create(name: string, kind: SymbolKind, uri: DocumentUri, range?: Range): WorkspaceSymbol {
		return range !== undefined
			? { name, kind, location: { uri, range } }
			: { name, kind, location: { uri } };
	}
}

/**
 * Represents programming constructs like variables, classes, interfaces etc.
 * that appear in a document. Document symbols can be hierarchical and they
 * have two ranges: one that encloses its definition and one that points to
 * its most interesting range, e.g. the range of an identifier.
 */
export interface DocumentSymbol {

	/**
	 * The name of this symbol. Will be displayed in the user interface and therefore must not be
	 * an empty string or a string only consisting of white spaces.
	 */
	name: string;

	/**
	 * More detail for this symbol, e.g the signature of a function.
	 */
	detail?: string;

	/**
	 * The kind of this symbol.
	 */
	kind: SymbolKind;

	/**
	 * Tags for this document symbol.
	 *
	 * @since 3.16.0
	 */
	tags?: SymbolTag[];

	/**
	 * Indicates if this symbol is deprecated.
	 *
	 * @deprecated Use tags instead
	 */
	deprecated?: boolean;

	/**
	 * The range enclosing this symbol not including leading/trailing whitespace but everything else
	 * like comments. This information is typically used to determine if the clients cursor is
	 * inside the symbol to reveal in the symbol in the UI.
	 */
	range: Range;

	/**
	 * The range that should be selected and revealed when this symbol is being picked, e.g the name of a function.
	 * Must be contained by the `range`.
	 */
	selectionRange: Range;

	/**
	 * Children of this symbol, e.g. properties of a class.
	 */
	children?: DocumentSymbol[];
}

export namespace DocumentSymbol {
	/**
	 * Creates a new symbol information literal.
	 *
	 * @param name The name of the symbol.
	 * @param detail The detail of the symbol.
	 * @param kind The kind of the symbol.
	 * @param range The range of the symbol.
	 * @param selectionRange The selectionRange of the symbol.
	 * @param children Children of the symbol.
	 */
	export function create(name: string, detail: string | undefined, kind: SymbolKind, range: Range, selectionRange: Range, children?: DocumentSymbol[]): DocumentSymbol {
		const result: DocumentSymbol = {
			name,
			detail,
			kind,
			range,
			selectionRange
		};
		if (children !== undefined) {
			result.children = children;
		}
		return result;
	}
	/**
	 * Checks whether the given literal conforms to the {@link DocumentSymbol} interface.
	 */
	export function is(value: any): value is DocumentSymbol {
		const candidate: DocumentSymbol = value;
		return candidate &&
			Is.string(candidate.name) && Is.number(candidate.kind) &&
			Range.is(candidate.range) && Range.is(candidate.selectionRange) &&
			(candidate.detail === undefined || Is.string(candidate.detail)) &&
			(candidate.deprecated === undefined || Is.boolean(candidate.deprecated)) &&
			(candidate.children === undefined || Array.isArray(candidate.children)) &&
			(candidate.tags === undefined || Array.isArray(candidate.tags));
	}
}

/**
 * The kind of a code action.
 *
 * Kinds are a hierarchical list of identifiers separated by `.`, e.g. `"refactor.extract.function"`.
 *
 * The set of kinds is open and client needs to announce the kinds it supports to the server during
 * initialization.
 */
export type CodeActionKind = string;

/**
 * A set of predefined code action kinds
 */
export namespace CodeActionKind {

	/**
	 * Empty kind.
	 */
	export const Empty: '' = '';

	/**
	 * Base kind for quickfix actions: 'quickfix'
	 */
	export const QuickFix: 'quickfix' = 'quickfix';

	/**
	 * Base kind for refactoring actions: 'refactor'
	 */
	export const Refactor: 'refactor' = 'refactor';

	/**
	 * Base kind for refactoring extraction actions: 'refactor.extract'
	 *
	 * Example extract actions:
	 *
	 * - Extract method
	 * - Extract function
	 * - Extract variable
	 * - Extract interface from class
	 * - ...
	 */
	export const RefactorExtract: 'refactor.extract' = 'refactor.extract';

	/**
	 * Base kind for refactoring inline actions: 'refactor.inline'
	 *
	 * Example inline actions:
	 *
	 * - Inline function
	 * - Inline variable
	 * - Inline constant
	 * - ...
	 */
	export const RefactorInline: 'refactor.inline' = 'refactor.inline';

	/**
	 * Base kind for refactoring move actions: `refactor.move`
	 *
	 * Example move actions:
	 *
	 * - Move a function to a new file
	 * - Move a property between classes
	 * - Move method to base class
	 * - ...
	 *
	 * @since 3.18.0
	 * @proposed
	 */
	export const RefactorMove: 'refactor.move' = 'refactor.move';

	/**
	 * Base kind for refactoring rewrite actions: 'refactor.rewrite'
	 *
	 * Example rewrite actions:
	 *
	 * - Convert JavaScript function to class
	 * - Add or remove parameter
	 * - Encapsulate field
	 * - Make method static
	 * - Move method to base class
	 * - ...
	 */
	export const RefactorRewrite: 'refactor.rewrite' = 'refactor.rewrite';

	/**
	 * Base kind for source actions: `source`
	 *
	 * Source code actions apply to the entire file.
	 */
	export const Source: 'source' = 'source';

	/**
	 * Base kind for an organize imports source action: `source.organizeImports`
	 */
	export const SourceOrganizeImports: 'source.organizeImports' = 'source.organizeImports';

	/**
	 * Base kind for auto-fix source actions: `source.fixAll`.
	 *
	 * Fix all actions automatically fix errors that have a clear fix that do not require user input.
	 * They should not suppress errors or perform unsafe fixes such as generating new types or classes.
	 *
	 * @since 3.15.0
	 */
	export const SourceFixAll: 'source.fixAll' = 'source.fixAll';

	/**
	 * Base kind for all code actions applying to the entire notebook's scope. CodeActionKinds using
	 * this should always begin with `notebook.`
	 *
	 * @since 3.18.0
	 */
	export const Notebook: 'notebook' = 'notebook';
}

/**
 * The reason why code actions were requested.
 *
 * @since 3.17.0
 */
export namespace CodeActionTriggerKind {
	/**
	 * Code actions were explicitly requested by the user or by an extension.
	 */
	export const Invoked: 1 = 1;

	/**
	 * Code actions were requested automatically.
	 *
	 * This typically happens when current selection in a file changes, but can
	 * also be triggered when file content changes.
	 */
	export const Automatic: 2 = 2;
}

export type CodeActionTriggerKind = 1 | 2;


/**
 * Contains additional diagnostic information about the context in which
 * a {@link CodeActionProvider.provideCodeActions code action} is run.
 */
export interface CodeActionContext {
	/**
	 * An array of diagnostics known on the client side overlapping the range provided to the
	 * `textDocument/codeAction` request. They are provided so that the server knows which
	 * errors are currently presented to the user for the given range. There is no guarantee
	 * that these accurately reflect the error state of the resource. The primary parameter
	 * to compute code actions is the provided range.
	 */
	diagnostics: Diagnostic[];

	/**
	 * Requested kind of actions to return.
	 *
	 * Actions not of this kind are filtered out by the client before being shown. So servers
	 * can omit computing them.
	 */
	only?: CodeActionKind[];

	/**
	 * The reason why code actions were requested.
	 *
	 * @since 3.17.0
	 */
	triggerKind?: CodeActionTriggerKind;
}

/**
 * The CodeActionContext namespace provides helper functions to work with
 * {@link CodeActionContext} literals.
 */
export namespace CodeActionContext {
	/**
	 * Creates a new CodeActionContext literal.
	 */
	export function create(diagnostics: Diagnostic[], only?: CodeActionKind[], triggerKind?: CodeActionTriggerKind): CodeActionContext {
		const result: CodeActionContext = { diagnostics };
		if (only !== undefined && only !== null) {
			result.only = only;
		}
		if (triggerKind !== undefined && triggerKind !== null) {
			result.triggerKind = triggerKind;
		}
		return result;
	}
	/**
	 * Checks whether the given literal conforms to the {@link CodeActionContext} interface.
	 */
	export function is(value: any): value is CodeActionContext {
		const candidate = value as CodeActionContext;
		return Is.defined(candidate) && Is.typedArray<Diagnostic[]>(candidate.diagnostics, Diagnostic.is)
			&& (candidate.only === undefined || Is.typedArray(candidate.only, Is.string))
			&& (candidate.triggerKind === undefined || candidate.triggerKind === CodeActionTriggerKind.Invoked || candidate.triggerKind === CodeActionTriggerKind.Automatic);
	}
}


/**
 * Captures why the code action is currently disabled.
 *
 * @since 3.18.0
 */
export type CodeActionDisabled = {

	/**
	 * Human readable description of why the code action is currently disabled.
	 *
	 * This is displayed in the code actions UI.
	 */
	reason: string;
};

/**
 * Code action tags are extra annotations that tweak the behavior of a code action.
 *
 * @since 3.18.0 - proposed
 */
export namespace CodeActionTag {
	/**
	 * Marks the code action as LLM-generated.
	 */
	export const LLMGenerated = 1;

	/**
	 * Checks whether the given literal conforms to the {@link CodeActionTag} interface.
	 */
	export function is(value: any): value is CodeActionTag {
		return Is.defined(value) && value === CodeActionTag.LLMGenerated;
	}
}
export type CodeActionTag = 1;

/**
 * A code action represents a change that can be performed in code, e.g. to fix a problem or
 * to refactor code.
 *
 * A CodeAction must set either `edit` and/or a `command`. If both are supplied, the `edit` is applied first, then the `command` is executed.
 */
export interface CodeAction {

	/**
	 * A short, human-readable, title for this code action.
	 */
	title: string;

	/**
	 * The kind of the code action.
	 *
	 * Used to filter code actions.
	 */
	kind?: CodeActionKind;

	/**
	 * The diagnostics that this code action resolves.
	 */
	diagnostics?: Diagnostic[];

	/**
	 * Marks this as a preferred action. Preferred actions are used by the `auto fix` command and can be targeted
	 * by keybindings.
	 *
	 * A quick fix should be marked preferred if it properly addresses the underlying error.
	 * A refactoring should be marked preferred if it is the most reasonable choice of actions to take.
	 *
	 * @since 3.15.0
	 */
	isPreferred?: boolean;

	/**
	 * Marks that the code action cannot currently be applied.
	 *
	 * Clients should follow the following guidelines regarding disabled code actions:
	 *
	 *   - Disabled code actions are not shown in automatic [lightbulbs](https://code.visualstudio.com/docs/editor/editingevolved#_code-action)
	 *     code action menus.
	 *
	 *   - Disabled actions are shown as faded out in the code action menu when the user requests a more specific type
	 *     of code action, such as refactorings.
	 *
	 *   - If the user has a [keybinding](https://code.visualstudio.com/docs/editor/refactoring#_keybindings-for-code-actions)
	 *     that auto applies a code action and only disabled code actions are returned, the client should show the user an
	 *     error message with `reason` in the editor.
	 *
	 * @since 3.16.0
	 */
	disabled?: CodeActionDisabled;

	/**
	 * The workspace edit this code action performs.
	 */
	edit?: WorkspaceEdit;

	/**
	 * A command this code action executes. If a code action
	 * provides an edit and a command, first the edit is
	 * executed and then the command.
	 */
	command?: Command;

	/**
	 * A data entry field that is preserved on a code action between
	 * a `textDocument/codeAction` and a `codeAction/resolve` request.
	 *
	 * @since 3.16.0
	 */
	data?: LSPAny;

	/**
 	 * Tags for this code action.
	 *
	 * @since 3.18.0 - proposed
	 */
	tags?: CodeActionTag[];
}

export namespace CodeAction {
	/**
	 * Creates a new code action.
	 *
	 * @param title The title of the code action.
	 * @param kind The kind of the code action.
	 */
	export function create(title: string, kind?: CodeActionKind): CodeAction;

	/**
	 * Creates a new code action.
	 *
	 * @param title The title of the code action.
	 * @param command The command to execute.
	 * @param kind The kind of the code action.
	 */
	export function create(title: string, command: Command, kind?: CodeActionKind): CodeAction;

	/**
	 * Creates a new code action.
	 *
	 * @param title The title of the code action.
	 * @param edit The edit to perform.
	 * @param kind The kind of the code action.
	 */
	export function create(title: string, edit: WorkspaceEdit, kind?: CodeActionKind): CodeAction;

	export function create(title: string, kindOrCommandOrEdit?: CodeActionKind | Command | WorkspaceEdit, kind?: CodeActionKind): CodeAction {
		const result: CodeAction = { title };
		let checkKind: boolean = true;
		if (typeof kindOrCommandOrEdit === 'string') {
			checkKind = false;
			result.kind = kindOrCommandOrEdit;
		} else if (Command.is(kindOrCommandOrEdit)) {
			result.command = kindOrCommandOrEdit;
		} else {
			result.edit = kindOrCommandOrEdit;
		}
		if (checkKind && kind !== undefined) {
			result.kind = kind;
		}
		return result;
	}
	export function is(value: any): value is CodeAction {
		const candidate: CodeAction = value;
		return candidate && Is.string(candidate.title) &&
			(candidate.diagnostics === undefined || Is.typedArray(candidate.diagnostics, Diagnostic.is)) &&
			(candidate.kind === undefined || Is.string(candidate.kind)) &&
			(candidate.edit !== undefined || candidate.command !== undefined) &&
			(candidate.command === undefined || Command.is(candidate.command)) &&
			(candidate.isPreferred === undefined || Is.boolean(candidate.isPreferred)) &&
			(candidate.edit === undefined || WorkspaceEdit.is(candidate.edit)) &&
			(candidate.tags === undefined || Is.typedArray(candidate.tags, CodeActionTag.is));
	}
}

/**
 * A code lens represents a {@link Command command} that should be shown along with
 * source text, like the number of references, a way to run tests, etc.
 *
 * A code lens is _unresolved_ when no command is associated to it. For performance
 * reasons the creation of a code lens and resolving should be done in two stages.
 */
export interface CodeLens {
	/**
	 * The range in which this code lens is valid. Should only span a single line.
	 */
	range: Range;

	/**
	 * The command this code lens represents.
	 */
	command?: Command;

	/**
	 * A data entry field that is preserved on a code lens item between
	 * a {@link CodeLensRequest} and a {@link CodeLensResolveRequest}
	 */
	data?: LSPAny;
}

/**
 * The CodeLens namespace provides helper functions to work with
 * {@link CodeLens} literals.
 */
export namespace CodeLens {
	/**
	 * Creates a new CodeLens literal.
	 */
	export function create(range: Range, data?: LSPAny): CodeLens {
		const result: CodeLens = { range };
		if (Is.defined(data)) { result.data = data; }
		return result;
	}
	/**
	 * Checks whether the given literal conforms to the {@link CodeLens} interface.
	 */
	export function is(value: any): value is CodeLens {
		const candidate = value as CodeLens;
		return Is.defined(candidate) && Range.is(candidate.range) && (Is.undefined(candidate.command) || Command.is(candidate.command));
	}
}

/**
 * Value-object describing what options formatting should use.
 */
export interface FormattingOptions {
	/**
	 * Size of a tab in spaces.
	 */
	tabSize: uinteger;

	/**
	 * Prefer spaces over tabs.
	 */
	insertSpaces: boolean;

	/**
	 * Trim trailing whitespace on a line.
	 *
	 * @since 3.15.0
	 */
	trimTrailingWhitespace?: boolean;

	/**
	 * Insert a newline character at the end of the file if one does not exist.
	 *
	 * @since 3.15.0
	 */
	insertFinalNewline?: boolean;

	/**
	 * Trim all newlines after the final newline at the end of the file.
	 *
	 * @since 3.15.0
	 */
	trimFinalNewlines?: boolean;

	/**
	 * Signature for further properties.
	 */
	[key: string]: boolean | integer | string | undefined;
}

/**
 * The FormattingOptions namespace provides helper functions to work with
 * {@link FormattingOptions} literals.
 */
export namespace FormattingOptions {
	/**
	 * Creates a new FormattingOptions literal.
	 */
	export function create(tabSize: uinteger, insertSpaces: boolean): FormattingOptions {
		return { tabSize, insertSpaces };
	}
	/**
	 * Checks whether the given literal conforms to the {@link FormattingOptions} interface.
	 */
	export function is(value: any): value is FormattingOptions {
		const candidate = value as FormattingOptions;
		return Is.defined(candidate) && Is.uinteger(candidate.tabSize) && Is.boolean(candidate.insertSpaces);
	}
}

/**
 * A document link is a range in a text document that links to an internal or external resource, like another
 * text document or a web site.
 */
export interface DocumentLink {

	/**
	 * The range this link applies to.
	 */
	range: Range;

	/**
	 * The uri this link points to. If missing a resolve request is sent later.
	 */
	target?: URI;

	/**
	 * The tooltip text when you hover over this link.
	 *
	 * If a tooltip is provided, is will be displayed in a string that includes instructions on how to
	 * trigger the link, such as `{0} (ctrl + click)`. The specific instructions vary depending on OS,
	 * user settings, and localization.
	 *
	 * @since 3.15.0
	 */
	tooltip?: string;

	/**
	 * A data entry field that is preserved on a document link between a
	 * DocumentLinkRequest and a DocumentLinkResolveRequest.
	 */
	data?: LSPAny;
}

/**
 * The DocumentLink namespace provides helper functions to work with
 * {@link DocumentLink} literals.
 */
export namespace DocumentLink {
	/**
	 * Creates a new DocumentLink literal.
	 */
	export function create(range: Range, target?: string, data?: LSPAny): DocumentLink {
		return { range, target, data };
	}

	/**
	 * Checks whether the given literal conforms to the {@link DocumentLink} interface.
	 */
	export function is(value: any): value is DocumentLink {
		const candidate = value as DocumentLink;
		return Is.defined(candidate) && Range.is(candidate.range) && (Is.undefined(candidate.target) || Is.string(candidate.target));
	}
}

/**
 * A selection range represents a part of a selection hierarchy. A selection range
 * may have a parent selection range that contains it.
 */
export interface SelectionRange {

	/**
	 * The {@link Range range} of this selection range.
	 */
	range: Range;

	/**
	 * The parent selection range containing this range. Therefore `parent.range` must contain `this.range`.
	 */
	parent?: SelectionRange;

}

/**
 * The SelectionRange namespace provides helper function to work with
 * SelectionRange literals.
 */
export namespace SelectionRange {
	/**
	 * Creates a new SelectionRange
	 * @param range the range.
	 * @param parent an optional parent.
	 */
	export function create(range: Range, parent?: SelectionRange): SelectionRange {
		return { range, parent };
	}

	export function is(value: any): value is SelectionRange {
		const candidate = value as SelectionRange;
		return Is.objectLiteral(candidate) && Range.is(candidate.range) && (candidate.parent === undefined || SelectionRange.is(candidate.parent));
	}
}

/**
 * Represents programming constructs like functions or constructors in the context
 * of call hierarchy.
 *
 * @since 3.16.0
 */
export interface CallHierarchyItem {
	/**
	 * The name of this item.
	 */
	name: string;

	/**
	 * The kind of this item.
	 */
	kind: SymbolKind;

	/**
	 * Tags for this item.
	 */
	tags?: SymbolTag[];

	/**
	 * More detail for this item, e.g. the signature of a function.
	 */
	detail?: string;

	/**
	 * The resource identifier of this item.
	 */
	uri: DocumentUri;

	/**
	 * The range enclosing this symbol not including leading/trailing whitespace but everything else, e.g. comments and code.
	 */
	range: Range;

	/**
	 * The range that should be selected and revealed when this symbol is being picked, e.g. the name of a function.
	 * Must be contained by the {@link CallHierarchyItem.range `range`}.
	 */
	selectionRange: Range;

	/**
	 * A data entry field that is preserved between a call hierarchy prepare and
	 * incoming calls or outgoing calls requests.
	 */
	data?: LSPAny;
}

/**
 * Represents an incoming call, e.g. a caller of a method or constructor.
 *
 * @since 3.16.0
 */
export interface CallHierarchyIncomingCall {

	/**
	 * The item that makes the call.
	 */
	from: CallHierarchyItem;

	/**
	 * The ranges at which the calls appear. This is relative to the caller
	 * denoted by {@link CallHierarchyIncomingCall.from `this.from`}.
	 */
	fromRanges: Range[];
}

/**
 * Represents an outgoing call, e.g. calling a getter from a method or a method from a constructor etc.
 *
 * @since 3.16.0
 */
export interface CallHierarchyOutgoingCall {

	/**
	 * The item that is called.
	 */
	to: CallHierarchyItem;

	/**
	 * The range at which this item is called. This is the range relative to the caller, e.g the item
	 * passed to {@link CallHierarchyItemProvider.provideCallHierarchyOutgoingCalls `provideCallHierarchyOutgoingCalls`}
	 * and not {@link CallHierarchyOutgoingCall.to `this.to`}.
	 */
	fromRanges: Range[];
}

/**
 * A set of predefined token types. This set is not fixed
 * an clients can specify additional token types via the
 * corresponding client capabilities.
 *
 * @since 3.16.0
 */
export enum SemanticTokenTypes {
	namespace = 'namespace',
	/**
	 * Represents a generic type. Acts as a fallback for types which can't be mapped to
	 * a specific type like class or enum.
	 */
	type = 'type',
	class = 'class',
	enum = 'enum',
	interface = 'interface',
	struct = 'struct',
	typeParameter = 'typeParameter',
	parameter = 'parameter',
	variable = 'variable',
	property = 'property',
	enumMember = 'enumMember',
	event = 'event',
	function = 'function',
	method = 'method',
	macro = 'macro',
	keyword = 'keyword',
	modifier = 'modifier',
	comment = 'comment',
	string = 'string',
	number = 'number',
	regexp = 'regexp',
	operator = 'operator',
	/**
	 * @since 3.17.0
	 */
	decorator = 'decorator',
	/**
	 * @since 3.18.0
	 */
	label = 'label'
}

/**
 * A set of predefined token modifiers. This set is not fixed
 * an clients can specify additional token types via the
 * corresponding client capabilities.
 *
 * @since 3.16.0
 */
export enum SemanticTokenModifiers {
	declaration = 'declaration',
	definition = 'definition',
	readonly = 'readonly',
	static = 'static',
	deprecated = 'deprecated',
	abstract = 'abstract',
	async = 'async',
	modification = 'modification',
	documentation = 'documentation',
	defaultLibrary = 'defaultLibrary'
}

/**
 * @since 3.16.0
 */
export interface SemanticTokensLegend {
	/**
	 * The token types a server uses.
	 */
	tokenTypes: string[];

	/**
	 * The token modifiers a server uses.
	 */
	tokenModifiers: string[];
}

/**
 * @since 3.16.0
 */
export interface SemanticTokens {
	/**
	 * An optional result id. If provided and clients support delta updating
	 * the client will include the result id in the next semantic token request.
	 * A server can then instead of computing all semantic tokens again simply
	 * send a delta.
	 */
	resultId?: string;

	/**
	 * The actual tokens.
	 */
	data: uinteger[];
}

/**
 * @since 3.16.0
 */
export namespace SemanticTokens {
	export function is(value: any): value is SemanticTokens {
		const candidate = value as SemanticTokens;
		return Is.objectLiteral(candidate) && (candidate.resultId === undefined || typeof candidate.resultId === 'string') &&
			Array.isArray(candidate.data) && (candidate.data.length === 0 || typeof candidate.data[0] === 'number');
	}
}

/**
 * @since 3.16.0
 */
export interface SemanticTokensEdit {
	/**
	 * The start offset of the edit.
	 */
	start: uinteger;

	/**
	 * The count of elements to remove.
	 */
	deleteCount: uinteger;

	/**
	 * The elements to insert.
	 */
	data?: uinteger[];
}

/**
 * @since 3.16.0
 */
export interface SemanticTokensDelta {
	readonly resultId?: string;
	/**
	 * The semantic token edits to transform a previous result into a new result.
	 */
	edits: SemanticTokensEdit[];
}

/**
 * @since 3.17.0
 */
export type TypeHierarchyItem = {
	/**
	 * The name of this item.
	 */
	name: string;

	/**
	 * The kind of this item.
	 */
	kind: SymbolKind;

	/**
	 * Tags for this item.
	 */
	tags?: SymbolTag[];

	/**
	 * More detail for this item, e.g. the signature of a function.
	 */
	detail?: string;

	/**
	 * The resource identifier of this item.
	 */
	uri: DocumentUri;

	/**
	 * The range enclosing this symbol not including leading/trailing whitespace
	 * but everything else, e.g. comments and code.
	 */
	range: Range;

	/**
	 * The range that should be selected and revealed when this symbol is being
	 * picked, e.g. the name of a function. Must be contained by the
	 * {@link TypeHierarchyItem.range `range`}.
	 */
	selectionRange: Range;

	/**
	 * A data entry field that is preserved between a type hierarchy prepare and
	 * supertypes or subtypes requests. It could also be used to identify the
	 * type hierarchy in the server, helping improve the performance on
	 * resolving supertypes and subtypes.
	 */
	data?: LSPAny;
};

/**
 * Provide inline value as text.
 *
 * @since 3.17.0
 */
export type InlineValueText = {
	/**
	 * The document range for which the inline value applies.
	 */
	range: Range;

	/**
	 * The text of the inline value.
	 */
	text: string;
};

/**
 * The InlineValueText namespace provides functions to deal with InlineValueTexts.
 *
 * @since 3.17.0
 */
export namespace InlineValueText {
	/**
	 * Creates a new InlineValueText literal.
	 */
	export function create(range: Range, text: string): InlineValueText {
		return { range, text };
	}

	export function is(value: InlineValue | undefined | null): value is InlineValueText {
		const candidate = value as InlineValueText;
		return candidate !== undefined && candidate !== null && Range.is(candidate.range) && Is.string(candidate.text);
	}
}

/**
 * Provide inline value through a variable lookup.
 * If only a range is specified, the variable name will be extracted from the underlying document.
 * An optional variable name can be used to override the extracted name.
 *
 * @since 3.17.0
 */
export type InlineValueVariableLookup = {
	/**
	 * The document range for which the inline value applies.
	 * The range is used to extract the variable name from the underlying document.
	 */
	range: Range;

	/**
	 * If specified the name of the variable to look up.
	 */
	variableName?: string;

	/**
	 * How to perform the lookup.
	 */
	caseSensitiveLookup: boolean;
};

/**
 * The InlineValueVariableLookup namespace provides functions to deal with InlineValueVariableLookups.
 *
 * @since 3.17.0
 */
export namespace InlineValueVariableLookup {
	/**
	 * Creates a new InlineValueText literal.
	 */
	export function create(range: Range, variableName: string | undefined, caseSensitiveLookup: boolean): InlineValueVariableLookup {
		return { range, variableName, caseSensitiveLookup };
	}

	export function is(value: InlineValue | undefined | null): value is InlineValueVariableLookup {
		const candidate = value as InlineValueVariableLookup;
		return candidate !== undefined && candidate !== null && Range.is(candidate.range) && Is.boolean(candidate.caseSensitiveLookup)
			&& (Is.string(candidate.variableName) || candidate.variableName === undefined);
	}
}

/**
 * Provide an inline value through an expression evaluation.
 * If only a range is specified, the expression will be extracted from the underlying document.
 * An optional expression can be used to override the extracted expression.
 *
 * @since 3.17.0
 */
export type InlineValueEvaluatableExpression = {
	/**
	 * The document range for which the inline value applies.
	 * The range is used to extract the evaluatable expression from the underlying document.
	 */
	range: Range;

	/**
	 * If specified the expression overrides the extracted expression.
	 */
	expression?: string;
};

/**
 * The InlineValueEvaluatableExpression namespace provides functions to deal with InlineValueEvaluatableExpression.
 *
 * @since 3.17.0
 */
export namespace InlineValueEvaluatableExpression {
	/**
	 * Creates a new InlineValueEvaluatableExpression literal.
	 */
	export function create(range: Range, expression: string | undefined): InlineValueEvaluatableExpression {
		return { range, expression };
	}

	export function is(value: InlineValue | undefined | null): value is InlineValueEvaluatableExpression {
		const candidate = value as InlineValueEvaluatableExpression;
		return candidate !== undefined && candidate !== null && Range.is(candidate.range)
			&& (Is.string(candidate.expression) || candidate.expression === undefined);
	}
}

/**
 * Inline value information can be provided by different means:
 * - directly as a text value (class InlineValueText).
 * - as a name to use for a variable lookup (class InlineValueVariableLookup)
 * - as an evaluatable expression (class InlineValueEvaluatableExpression)
 * The InlineValue types combines all inline value types into one type.
 *
 * @since 3.17.0
 */
export type InlineValue = InlineValueText | InlineValueVariableLookup | InlineValueEvaluatableExpression;

/**
 * @since 3.17.0
 */
export type InlineValueContext = {

	/**
	 * The stack frame (as a DAP Id) where the execution has stopped.
	 */
	frameId: integer;

	/**
	 * The document range where execution has stopped.
	 * Typically the end position of the range denotes the line where the inline values are shown.
	 */
	stoppedLocation: Range;
};

/**
 * The InlineValueContext namespace provides helper functions to work with
 * {@link InlineValueContext} literals.
 *
 * @since 3.17.0
 */
export namespace InlineValueContext {
	/**
	 * Creates a new InlineValueContext literal.
	 */
	export function create(frameId: integer, stoppedLocation: Range): InlineValueContext {
		return { frameId, stoppedLocation };
	}

	/**
	 * Checks whether the given literal conforms to the {@link InlineValueContext} interface.
	 */
	export function is(value: any): value is InlineValueContext {
		const candidate = value as InlineValueContext;
		return Is.defined(candidate) && Range.is(value.stoppedLocation);
	}
}

/**
 * Inlay hint kinds.
 *
 * @since 3.17.0
 */
export namespace InlayHintKind {

	/**
	 * An inlay hint that for a type annotation.
	 */
	export const Type = 1;

	/**
	 * An inlay hint that is for a parameter.
	 */
	export const Parameter = 2;

	export function is(value: number): value is InlayHintKind {
		return value === 1 || value === 2;
	}
}

export type InlayHintKind = 1 | 2;

/**
 * An inlay hint label part allows for interactive and composite labels
 * of inlay hints.
 *
 * @since 3.17.0
 */
export type InlayHintLabelPart = {

	/**
	 * The value of this label part.
	 */
	value: string;

	/**
	 * The tooltip text when you hover over this label part. Depending on
	 * the client capability `inlayHint.resolveSupport` clients might resolve
	 * this property late using the resolve request.
	 */
	tooltip?: string | MarkupContent;

	/**
	 * An optional source code location that represents this
	 * label part.
	 *
	 * The editor will use this location for the hover and for code navigation
	 * features: This part will become a clickable link that resolves to the
	 * definition of the symbol at the given location (not necessarily the
	 * location itself), it shows the hover that shows at the given location,
	 * and it shows a context menu with further code navigation commands.
	 *
	 * Depending on the client capability `inlayHint.resolveSupport` clients
	 * might resolve this property late using the resolve request.
	 */
	location?: Location;

	/**
	 * An optional command for this label part.
	 *
	 * Depending on the client capability `inlayHint.resolveSupport` clients
	 * might resolve this property late using the resolve request.
	 */
	command?: Command;
};

export namespace InlayHintLabelPart {

	export function create(value: string): InlayHintLabelPart {
		return { value };
	}

	export function is(value: any): value is InlayHintLabelPart {
		const candidate: InlayHintLabelPart = value;
		return Is.objectLiteral(candidate)
			&& (candidate.tooltip === undefined || Is.string(candidate.tooltip) || MarkupContent.is(candidate.tooltip))
			&& (candidate.location === undefined || Location.is(candidate.location))
			&& (candidate.command === undefined || Command.is(candidate.command));
	}
}

/**
 * Inlay hint information.
 *
 * @since 3.17.0
 */
export type InlayHint = {

	/**
	 * The position of this hint.
	 *
	 * If multiple hints have the same position, they will be shown in the order
	 * they appear in the response.
	 */
	position: Position;

	/**
	 * The label of this hint. A human readable string or an array of
	 * InlayHintLabelPart label parts.
	 *
	 * *Note* that neither the string nor the label part can be empty.
	 */
	label: string | InlayHintLabelPart[];

	/**
	 * The kind of this hint. Can be omitted in which case the client
	 * should fall back to a reasonable default.
	 */
	kind?: InlayHintKind;

	/**
	 * Optional text edits that are performed when accepting this inlay hint.
	 *
	 * *Note* that edits are expected to change the document so that the inlay
	 * hint (or its nearest variant) is now part of the document and the inlay
	 * hint itself is now obsolete.
	 */
	textEdits?: TextEdit[];

	/**
	 * The tooltip text when you hover over this item.
	 */
	tooltip?: string | MarkupContent;

	/**
	 * Render padding before the hint.
	 *
	 * Note: Padding should use the editor's background color, not the
	 * background color of the hint itself. That means padding can be used
	 * to visually align/separate an inlay hint.
	 */
	paddingLeft?: boolean;

	/**
	 * Render padding after the hint.
	 *
	 * Note: Padding should use the editor's background color, not the
	 * background color of the hint itself. That means padding can be used
	 * to visually align/separate an inlay hint.
	 */
	paddingRight?: boolean;

	/**
	 * A data entry field that is preserved on an inlay hint between
	 * a `textDocument/inlayHint` and a `inlayHint/resolve` request.
	 */
	data?: LSPAny;
};

export namespace InlayHint {

	export function create(position: Position, label: string | InlayHintLabelPart[], kind?: InlayHintKind): InlayHint {
		const result: InlayHint = { position, label };
		if (kind !== undefined) {
			result.kind = kind;
		}
		return result;
	}

	export function is(value: any): value is InlayHint {
		const candidate: InlayHint = value;
		return Is.objectLiteral(candidate) && Position.is(candidate.position)
			&& (Is.string(candidate.label) || Is.typedArray(candidate.label, InlayHintLabelPart.is))
			&& (candidate.kind === undefined || InlayHintKind.is(candidate.kind))
			&& (candidate.textEdits === undefined) || Is.typedArray(candidate.textEdits, TextEdit.is)
			&& (candidate.tooltip === undefined || Is.string(candidate.tooltip) || MarkupContent.is(candidate.tooltip))
			&& (candidate.paddingLeft === undefined || Is.boolean(candidate.paddingLeft))
			&& (candidate.paddingRight === undefined || Is.boolean(candidate.paddingRight));
	}
}

/**
 * A string value used as a snippet is a template which allows to insert text
 * and to control the editor cursor when insertion happens.
 *
 * A snippet can define tab stops and placeholders with `$1`, `$2`
 * and `${3:foo}`. `$0` defines the final tab stop, it defaults to
 * the end of the snippet. Variables are defined with `$name` and
 * `${name:default value}`.
 *
 * @since 3.18.0
 * @proposed
 */
export type StringValue = {
	/**
	 * The kind of string value.
	 */
	kind: 'snippet';

	/**
	 * The snippet string.
	 */
	value: string;
};

export namespace StringValue {
	export function createSnippet(value: string): StringValue {
		return { kind: 'snippet', value };
	}

	export function isSnippet(value: any): value is StringValue {
		const candidate = value as StringValue;
		return Is.objectLiteral(candidate)
			&& candidate.kind === 'snippet'
			&& Is.string(candidate.value);
	}
}

/**
 * An inline completion item represents a text snippet that is proposed inline to complete text that is being typed.
 *
 * @since 3.18.0
 * @proposed
 */
export interface InlineCompletionItem {
	/**
	 * The text to replace the range with. Must be set.
	 */
	insertText: string | StringValue;

	/**
	 * A text that is used to decide if this inline completion should be shown. When `falsy` the {@link InlineCompletionItem.insertText} is used.
	 */
	filterText?: string;

	/**
	 * The range to replace. Must begin and end on the same line.
	 */
	range?: Range;

	/**
	 * An optional {@link Command} that is executed *after* inserting this completion.
	 */
	command?: Command;
}

export namespace InlineCompletionItem {
	export function create(insertText: string | StringValue, filterText?: string, range?: Range, command?: Command): InlineCompletionItem {
		return { insertText, filterText, range, command };
	}
}

/**
 * Represents a collection of {@link InlineCompletionItem inline completion items} to be presented in the editor.
 *
 * @since 3.18.0
 * @proposed
 */
export interface InlineCompletionList {
	/**
	 * The inline completion items
	 */
	items: InlineCompletionItem[];
}

export namespace InlineCompletionList {
	export function create(items: InlineCompletionItem[]): InlineCompletionList {
		return { items };
	}
}

/**
 * Describes how an {@link InlineCompletionItemProvider inline completion provider} was triggered.
 *
 * @since 3.18.0
 * @proposed
 */
export namespace InlineCompletionTriggerKind {
	/**
	 * Completion was triggered explicitly by a user gesture.
	 */
	export const Invoked: 1 = 1;

	/**
	 * Completion was triggered automatically while editing.
	 */
	export const Automatic: 2 = 2;
}

export type InlineCompletionTriggerKind = 1 | 2;

/**
 * Describes the currently selected completion item.
 *
 * @since 3.18.0
 * @proposed
 */
export type SelectedCompletionInfo = {
	/**
	 * The range that will be replaced if this completion item is accepted.
	 */
	range: Range;

	/**
	 * The text the range will be replaced with if this completion is accepted.
	 */
	text: string;
};

export namespace SelectedCompletionInfo {
	export function create(range: Range, text: string): SelectedCompletionInfo {
		return { range, text };
	}
}

/**
 * Provides information about the context in which an inline completion was requested.
 *
 * @since 3.18.0
 * @proposed
 */
export type InlineCompletionContext = {
	/**
	 * Describes how the inline completion was triggered.
	 */
	triggerKind: InlineCompletionTriggerKind;

	/**
	 * Provides information about the currently selected item in the autocomplete widget if it is visible.
	 */
	selectedCompletionInfo?: SelectedCompletionInfo;
};

export namespace InlineCompletionContext{
	export function create(triggerKind: InlineCompletionTriggerKind, selectedCompletionInfo?: SelectedCompletionInfo): InlineCompletionContext {
		return { triggerKind, selectedCompletionInfo };
	}
}

/**
 * A workspace folder inside a client.
 */
export interface WorkspaceFolder {
	/**
	 * The associated URI for this workspace folder.
	 */
	uri: URI;

	/**
	 * The name of the workspace folder. Used to refer to this
	 * workspace folder in the user interface.
	 */
	name: string;
}

export namespace WorkspaceFolder {
	export function is(value: any): value is WorkspaceFolder {
		const candidate: WorkspaceFolder = value;
		return Is.objectLiteral(candidate) && URI.is(candidate.uri) && Is.string(candidate.name);
	}
}

export const EOL: string[] = ['\n', '\r\n', '\r'];

/**
 * A simple text document. Not to be implemented. The document keeps the content
 * as string.
 *
 * @deprecated Use the text document from the new vscode-languageserver-textdocument package.
 */
export interface TextDocument {

	/**
	 * The associated URI for this document. Most documents have the __file__-scheme, indicating that they
	 * represent files on disk. However, some documents may have other schemes indicating that they are not
	 * available on disk.
	 *
	 * @readonly
	 */
	readonly uri: DocumentUri;

	/**
	 * The identifier of the language associated with this document.
	 *
	 * @readonly
	 */
	readonly languageId: LanguageKind;

	/**
	 * The version number of this document (it will increase after each
	 * change, including undo/redo).
	 *
	 * @readonly
	 */
	readonly version: integer;

	/**
	 * Get the text of this document. A substring can be retrieved by
	 * providing a range.
	 *
	 * @param range (optional) An range within the document to return.
	 * If no range is passed, the full content is returned.
	 * Invalid range positions are adjusted as described in {@link Position.line Position.line}
	 * and {@link Position.character Position.character}.
	 * If the start range position is greater than the end range position,
	 * then the effect of getText is as if the two positions were swapped.

	 * @return The text of this document or a substring of the text if a
	 *         range is provided.
	 */
	getText(range?: Range): string;

	/**
	 * Converts a zero-based offset to a position.
	 *
	 * @param offset A zero-based offset.
	 * @return A valid {@link Position position}.
	 */
	positionAt(offset: uinteger): Position;

	/**
	 * Converts the position to a zero-based offset.
	 * Invalid positions are adjusted as described in {@link Position.line Position.line}
	 * and {@link Position.character Position.character}.
	 *
	 * @param position A position.
	 * @return A valid zero-based offset.
	 */
	offsetAt(position: Position): uinteger;

	/**
	 * The number of lines in this document.
	 *
	 * @readonly
	 */
	readonly lineCount: uinteger;
}

/**
 * @deprecated Use the text document from the new vscode-languageserver-textdocument package.
 */
export namespace TextDocument {
	/**
	 * Creates a new ITextDocument literal from the given uri and content.
	 * @param uri The document's uri.
	 * @param languageId The document's language Id.
	 * @param version The document's version.
	 * @param content The document's content.
	 */
	export function create(uri: DocumentUri, languageId: LanguageKind, version: integer, content: string): TextDocument {
		return new FullTextDocument(uri, languageId, version, content);
	}
	/**
	 * Checks whether the given literal conforms to the {@link ITextDocument} interface.
	 */
	export function is(value: any): value is TextDocument {
		const candidate = value as TextDocument;
		return Is.defined(candidate) && Is.string(candidate.uri) && (Is.undefined(candidate.languageId) || Is.string(candidate.languageId)) && Is.uinteger(candidate.lineCount)
			&& Is.func(candidate.getText) && Is.func(candidate.positionAt) && Is.func(candidate.offsetAt) ? true : false;
	}

	export function applyEdits(document: TextDocument, edits: TextEdit[]): string {
		let text = document.getText();
		const sortedEdits = mergeSort(edits, (a, b) => {
			const diff = a.range.start.line - b.range.start.line;
			if (diff === 0) {
				return a.range.start.character - b.range.start.character;
			}
			return diff;
		});
		let lastModifiedOffset = text.length;
		for (let i = sortedEdits.length - 1; i >= 0; i--) {
			const e = sortedEdits[i];
			const startOffset = document.offsetAt(e.range.start);
			const endOffset = document.offsetAt(e.range.end);
			if (endOffset <= lastModifiedOffset) {
				text = text.substring(0, startOffset) + e.newText + text.substring(endOffset, text.length);
			} else {
				throw new Error('Overlapping edit');
			}
			lastModifiedOffset = startOffset;
		}
		return text;
	}

	function mergeSort<T>(data: T[], compare: (a: T, b: T) => number): T[] {
		if (data.length <= 1) {
			// sorted
			return data;
		}
		const p = (data.length / 2) | 0;
		const left = data.slice(0, p);
		const right = data.slice(p);

		mergeSort(left, compare);
		mergeSort(right, compare);

		let leftIdx = 0;
		let rightIdx = 0;
		let i = 0;
		while (leftIdx < left.length && rightIdx < right.length) {
			const ret = compare(left[leftIdx], right[rightIdx]);
			if (ret <= 0) {
				// smaller_equal -> take left to preserve order
				data[i++] = left[leftIdx++];
			} else {
				// greater -> take right
				data[i++] = right[rightIdx++];
			}
		}
		while (leftIdx < left.length) {
			data[i++] = left[leftIdx++];
		}
		while (rightIdx < right.length) {
			data[i++] = right[rightIdx++];
		}
		return data;
	}
}

/**
 * An event describing a change to a text document. If range and rangeLength are omitted
 * the new text is considered to be the full content of the document.
 *
 * @deprecated Use the text document from the new vscode-languageserver-textdocument package.
 */
type TextDocumentContentChangeEvent = {
	/**
	 * The range of the document that changed.
	 */
	range: Range;

	/**
	 * The optional length of the range that got replaced.
	 *
	 * @deprecated use range instead.
	 */
	rangeLength?: uinteger;

	/**
	 * The new text for the provided range.
	 */
	text: string;
} | {
	/**
	 * The new text of the whole document.
	 */
	text: string;
};

/**
 * @deprecated Use the text document from the new vscode-languageserver-textdocument package.
 */
class FullTextDocument implements TextDocument {

	private _uri: DocumentUri;
	private _languageId: LanguageKind;
	private _version: integer;
	private _content: string;
	private _lineOffsets: uinteger[] | undefined;

	public constructor(uri: DocumentUri, languageId: LanguageKind, version: integer, content: string) {
		this._uri = uri;
		this._languageId = languageId;
		this._version = version;
		this._content = content;
		this._lineOffsets = undefined;
	}

	public get uri(): string {
		return this._uri;
	}

	public get languageId(): string {
		return this._languageId;
	}

	public get version(): integer {
		return this._version;
	}

	public getText(range?: Range): string {
		if (range) {
			const start = this.offsetAt(range.start);
			const end = this.offsetAt(range.end);
			return this._content.substring(start, end);
		}
		return this._content;
	}

	public update(event: TextDocumentContentChangeEvent, version: integer): void {
		this._content = event.text;
		this._version = version;
		this._lineOffsets = undefined;
	}

	private getLineOffsets(): uinteger[] {
		if (this._lineOffsets === undefined) {
			const lineOffsets: uinteger[] = [];
			const text = this._content;
			let isLineStart = true;
			for (let i = 0; i < text.length; i++) {
				if (isLineStart) {
					lineOffsets.push(i);
					isLineStart = false;
				}
				const ch = text.charAt(i);
				isLineStart = (ch === '\r' || ch === '\n');
				if (ch === '\r' && i + 1 < text.length && text.charAt(i + 1) === '\n') {
					i++;
				}
			}
			if (isLineStart && text.length > 0) {
				lineOffsets.push(text.length);
			}
			this._lineOffsets = lineOffsets;
		}
		return this._lineOffsets;
	}

	public positionAt(offset: uinteger) {
		offset = Math.max(Math.min(offset, this._content.length), 0);

		const lineOffsets = this.getLineOffsets();
		let low = 0, high = lineOffsets.length;
		if (high === 0) {
			return Position.create(0, offset);
		}
		while (low < high) {
			const mid = Math.floor((low + high) / 2);
			if (lineOffsets[mid] > offset) {
				high = mid;
			} else {
				low = mid + 1;
			}
		}
		// low is the least x for which the line offset is larger than the current offset
		// or array.length if no line offset is larger than the current offset
		const line = low - 1;
		return Position.create(line, offset - lineOffsets[line]);
	}

	public offsetAt(position: Position) {
		const lineOffsets = this.getLineOffsets();
		if (position.line >= lineOffsets.length) {
			return this._content.length;
		} else if (position.line < 0) {
			return 0;
		}
		const lineOffset = lineOffsets[position.line];
		const nextLineOffset = (position.line + 1 < lineOffsets.length) ? lineOffsets[position.line + 1] : this._content.length;
		return Math.max(Math.min(lineOffset + position.character, nextLineOffset), lineOffset);
	}

	public get lineCount() {
		return this.getLineOffsets().length;
	}
}

namespace Is {

	const toString = Object.prototype.toString;

	export function defined(value: any): boolean {
		return typeof value !== 'undefined';
	}

	export function undefined(value: any): boolean {
		return typeof value === 'undefined';
	}

	export function boolean(value: any): value is boolean {
		return value === true || value === false;
	}

	export function string(value: any): value is string {
		return toString.call(value) === '[object String]';
	}

	export function number(value: any): value is number {
		return toString.call(value) === '[object Number]';
	}

	export function numberRange(value: any, min: number, max: number): value is number {
		return toString.call(value) === '[object Number]' && min <= value && value <= max;
	}

	export function integer(value: any): value is integer {
		return toString.call(value) === '[object Number]' && -2147483648 <= value && value <= 2147483647;
	}

	export function uinteger(value: any): value is uinteger {
		return toString.call(value) === '[object Number]' && 0 <= value && value <= 2147483647;
	}

	export function func(value: any): value is Function {
		return toString.call(value) === '[object Function]';
	}

	export function objectLiteral(value: any): value is object {
		// Strictly speaking class instances pass this check as well. Since the LSP
		// doesn't use classes we ignore this for now. If we do we need to add something
		// like this: `Object.getPrototypeOf(Object.getPrototypeOf(x)) === null`
		return value !== null && typeof value === 'object';
	}

	export function typedArray<T>(value: any, check: (value: any) => boolean): value is T[] {
		return Array.isArray(value) && (<any[]>value).every(check);
	}
}