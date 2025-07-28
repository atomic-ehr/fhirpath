// Generated from /Users/niquola/atomic-ehr-org/fhirpath/spec/fhirpath.g4 by ANTLR 4.13.1
import org.antlr.v4.runtime.tree.ParseTreeListener;

/**
 * This interface defines a complete listener for a parse tree produced by
 * {@link fhirpathParser}.
 */
public interface fhirpathListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by the {@code indexerExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterIndexerExpression(fhirpathParser.IndexerExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code indexerExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitIndexerExpression(fhirpathParser.IndexerExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code polarityExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterPolarityExpression(fhirpathParser.PolarityExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code polarityExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitPolarityExpression(fhirpathParser.PolarityExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code additiveExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterAdditiveExpression(fhirpathParser.AdditiveExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code additiveExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitAdditiveExpression(fhirpathParser.AdditiveExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code multiplicativeExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterMultiplicativeExpression(fhirpathParser.MultiplicativeExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code multiplicativeExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitMultiplicativeExpression(fhirpathParser.MultiplicativeExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code unionExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterUnionExpression(fhirpathParser.UnionExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code unionExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitUnionExpression(fhirpathParser.UnionExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code orExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterOrExpression(fhirpathParser.OrExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code orExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitOrExpression(fhirpathParser.OrExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code andExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterAndExpression(fhirpathParser.AndExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code andExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitAndExpression(fhirpathParser.AndExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code membershipExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterMembershipExpression(fhirpathParser.MembershipExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code membershipExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitMembershipExpression(fhirpathParser.MembershipExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code inequalityExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterInequalityExpression(fhirpathParser.InequalityExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code inequalityExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitInequalityExpression(fhirpathParser.InequalityExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code invocationExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterInvocationExpression(fhirpathParser.InvocationExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code invocationExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitInvocationExpression(fhirpathParser.InvocationExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code equalityExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterEqualityExpression(fhirpathParser.EqualityExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code equalityExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitEqualityExpression(fhirpathParser.EqualityExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code impliesExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterImpliesExpression(fhirpathParser.ImpliesExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code impliesExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitImpliesExpression(fhirpathParser.ImpliesExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code termExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterTermExpression(fhirpathParser.TermExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code termExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitTermExpression(fhirpathParser.TermExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code typeExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void enterTypeExpression(fhirpathParser.TypeExpressionContext ctx);
	/**
	 * Exit a parse tree produced by the {@code typeExpression}
	 * labeled alternative in {@link fhirpathParser#expression}.
	 * @param ctx the parse tree
	 */
	void exitTypeExpression(fhirpathParser.TypeExpressionContext ctx);
	/**
	 * Enter a parse tree produced by the {@code invocationTerm}
	 * labeled alternative in {@link fhirpathParser#term}.
	 * @param ctx the parse tree
	 */
	void enterInvocationTerm(fhirpathParser.InvocationTermContext ctx);
	/**
	 * Exit a parse tree produced by the {@code invocationTerm}
	 * labeled alternative in {@link fhirpathParser#term}.
	 * @param ctx the parse tree
	 */
	void exitInvocationTerm(fhirpathParser.InvocationTermContext ctx);
	/**
	 * Enter a parse tree produced by the {@code literalTerm}
	 * labeled alternative in {@link fhirpathParser#term}.
	 * @param ctx the parse tree
	 */
	void enterLiteralTerm(fhirpathParser.LiteralTermContext ctx);
	/**
	 * Exit a parse tree produced by the {@code literalTerm}
	 * labeled alternative in {@link fhirpathParser#term}.
	 * @param ctx the parse tree
	 */
	void exitLiteralTerm(fhirpathParser.LiteralTermContext ctx);
	/**
	 * Enter a parse tree produced by the {@code externalConstantTerm}
	 * labeled alternative in {@link fhirpathParser#term}.
	 * @param ctx the parse tree
	 */
	void enterExternalConstantTerm(fhirpathParser.ExternalConstantTermContext ctx);
	/**
	 * Exit a parse tree produced by the {@code externalConstantTerm}
	 * labeled alternative in {@link fhirpathParser#term}.
	 * @param ctx the parse tree
	 */
	void exitExternalConstantTerm(fhirpathParser.ExternalConstantTermContext ctx);
	/**
	 * Enter a parse tree produced by the {@code parenthesizedTerm}
	 * labeled alternative in {@link fhirpathParser#term}.
	 * @param ctx the parse tree
	 */
	void enterParenthesizedTerm(fhirpathParser.ParenthesizedTermContext ctx);
	/**
	 * Exit a parse tree produced by the {@code parenthesizedTerm}
	 * labeled alternative in {@link fhirpathParser#term}.
	 * @param ctx the parse tree
	 */
	void exitParenthesizedTerm(fhirpathParser.ParenthesizedTermContext ctx);
	/**
	 * Enter a parse tree produced by the {@code nullLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void enterNullLiteral(fhirpathParser.NullLiteralContext ctx);
	/**
	 * Exit a parse tree produced by the {@code nullLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void exitNullLiteral(fhirpathParser.NullLiteralContext ctx);
	/**
	 * Enter a parse tree produced by the {@code booleanLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void enterBooleanLiteral(fhirpathParser.BooleanLiteralContext ctx);
	/**
	 * Exit a parse tree produced by the {@code booleanLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void exitBooleanLiteral(fhirpathParser.BooleanLiteralContext ctx);
	/**
	 * Enter a parse tree produced by the {@code stringLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void enterStringLiteral(fhirpathParser.StringLiteralContext ctx);
	/**
	 * Exit a parse tree produced by the {@code stringLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void exitStringLiteral(fhirpathParser.StringLiteralContext ctx);
	/**
	 * Enter a parse tree produced by the {@code numberLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void enterNumberLiteral(fhirpathParser.NumberLiteralContext ctx);
	/**
	 * Exit a parse tree produced by the {@code numberLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void exitNumberLiteral(fhirpathParser.NumberLiteralContext ctx);
	/**
	 * Enter a parse tree produced by the {@code dateTimeLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void enterDateTimeLiteral(fhirpathParser.DateTimeLiteralContext ctx);
	/**
	 * Exit a parse tree produced by the {@code dateTimeLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void exitDateTimeLiteral(fhirpathParser.DateTimeLiteralContext ctx);
	/**
	 * Enter a parse tree produced by the {@code timeLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void enterTimeLiteral(fhirpathParser.TimeLiteralContext ctx);
	/**
	 * Exit a parse tree produced by the {@code timeLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void exitTimeLiteral(fhirpathParser.TimeLiteralContext ctx);
	/**
	 * Enter a parse tree produced by the {@code quantityLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void enterQuantityLiteral(fhirpathParser.QuantityLiteralContext ctx);
	/**
	 * Exit a parse tree produced by the {@code quantityLiteral}
	 * labeled alternative in {@link fhirpathParser#literal}.
	 * @param ctx the parse tree
	 */
	void exitQuantityLiteral(fhirpathParser.QuantityLiteralContext ctx);
	/**
	 * Enter a parse tree produced by {@link fhirpathParser#externalConstant}.
	 * @param ctx the parse tree
	 */
	void enterExternalConstant(fhirpathParser.ExternalConstantContext ctx);
	/**
	 * Exit a parse tree produced by {@link fhirpathParser#externalConstant}.
	 * @param ctx the parse tree
	 */
	void exitExternalConstant(fhirpathParser.ExternalConstantContext ctx);
	/**
	 * Enter a parse tree produced by the {@code memberInvocation}
	 * labeled alternative in {@link fhirpathParser#invocation}.
	 * @param ctx the parse tree
	 */
	void enterMemberInvocation(fhirpathParser.MemberInvocationContext ctx);
	/**
	 * Exit a parse tree produced by the {@code memberInvocation}
	 * labeled alternative in {@link fhirpathParser#invocation}.
	 * @param ctx the parse tree
	 */
	void exitMemberInvocation(fhirpathParser.MemberInvocationContext ctx);
	/**
	 * Enter a parse tree produced by the {@code functionInvocation}
	 * labeled alternative in {@link fhirpathParser#invocation}.
	 * @param ctx the parse tree
	 */
	void enterFunctionInvocation(fhirpathParser.FunctionInvocationContext ctx);
	/**
	 * Exit a parse tree produced by the {@code functionInvocation}
	 * labeled alternative in {@link fhirpathParser#invocation}.
	 * @param ctx the parse tree
	 */
	void exitFunctionInvocation(fhirpathParser.FunctionInvocationContext ctx);
	/**
	 * Enter a parse tree produced by the {@code thisInvocation}
	 * labeled alternative in {@link fhirpathParser#invocation}.
	 * @param ctx the parse tree
	 */
	void enterThisInvocation(fhirpathParser.ThisInvocationContext ctx);
	/**
	 * Exit a parse tree produced by the {@code thisInvocation}
	 * labeled alternative in {@link fhirpathParser#invocation}.
	 * @param ctx the parse tree
	 */
	void exitThisInvocation(fhirpathParser.ThisInvocationContext ctx);
	/**
	 * Enter a parse tree produced by the {@code indexInvocation}
	 * labeled alternative in {@link fhirpathParser#invocation}.
	 * @param ctx the parse tree
	 */
	void enterIndexInvocation(fhirpathParser.IndexInvocationContext ctx);
	/**
	 * Exit a parse tree produced by the {@code indexInvocation}
	 * labeled alternative in {@link fhirpathParser#invocation}.
	 * @param ctx the parse tree
	 */
	void exitIndexInvocation(fhirpathParser.IndexInvocationContext ctx);
	/**
	 * Enter a parse tree produced by the {@code totalInvocation}
	 * labeled alternative in {@link fhirpathParser#invocation}.
	 * @param ctx the parse tree
	 */
	void enterTotalInvocation(fhirpathParser.TotalInvocationContext ctx);
	/**
	 * Exit a parse tree produced by the {@code totalInvocation}
	 * labeled alternative in {@link fhirpathParser#invocation}.
	 * @param ctx the parse tree
	 */
	void exitTotalInvocation(fhirpathParser.TotalInvocationContext ctx);
	/**
	 * Enter a parse tree produced by {@link fhirpathParser#function}.
	 * @param ctx the parse tree
	 */
	void enterFunction(fhirpathParser.FunctionContext ctx);
	/**
	 * Exit a parse tree produced by {@link fhirpathParser#function}.
	 * @param ctx the parse tree
	 */
	void exitFunction(fhirpathParser.FunctionContext ctx);
	/**
	 * Enter a parse tree produced by {@link fhirpathParser#paramList}.
	 * @param ctx the parse tree
	 */
	void enterParamList(fhirpathParser.ParamListContext ctx);
	/**
	 * Exit a parse tree produced by {@link fhirpathParser#paramList}.
	 * @param ctx the parse tree
	 */
	void exitParamList(fhirpathParser.ParamListContext ctx);
	/**
	 * Enter a parse tree produced by {@link fhirpathParser#quantity}.
	 * @param ctx the parse tree
	 */
	void enterQuantity(fhirpathParser.QuantityContext ctx);
	/**
	 * Exit a parse tree produced by {@link fhirpathParser#quantity}.
	 * @param ctx the parse tree
	 */
	void exitQuantity(fhirpathParser.QuantityContext ctx);
	/**
	 * Enter a parse tree produced by {@link fhirpathParser#unit}.
	 * @param ctx the parse tree
	 */
	void enterUnit(fhirpathParser.UnitContext ctx);
	/**
	 * Exit a parse tree produced by {@link fhirpathParser#unit}.
	 * @param ctx the parse tree
	 */
	void exitUnit(fhirpathParser.UnitContext ctx);
	/**
	 * Enter a parse tree produced by {@link fhirpathParser#dateTimePrecision}.
	 * @param ctx the parse tree
	 */
	void enterDateTimePrecision(fhirpathParser.DateTimePrecisionContext ctx);
	/**
	 * Exit a parse tree produced by {@link fhirpathParser#dateTimePrecision}.
	 * @param ctx the parse tree
	 */
	void exitDateTimePrecision(fhirpathParser.DateTimePrecisionContext ctx);
	/**
	 * Enter a parse tree produced by {@link fhirpathParser#pluralDateTimePrecision}.
	 * @param ctx the parse tree
	 */
	void enterPluralDateTimePrecision(fhirpathParser.PluralDateTimePrecisionContext ctx);
	/**
	 * Exit a parse tree produced by {@link fhirpathParser#pluralDateTimePrecision}.
	 * @param ctx the parse tree
	 */
	void exitPluralDateTimePrecision(fhirpathParser.PluralDateTimePrecisionContext ctx);
	/**
	 * Enter a parse tree produced by {@link fhirpathParser#typeSpecifier}.
	 * @param ctx the parse tree
	 */
	void enterTypeSpecifier(fhirpathParser.TypeSpecifierContext ctx);
	/**
	 * Exit a parse tree produced by {@link fhirpathParser#typeSpecifier}.
	 * @param ctx the parse tree
	 */
	void exitTypeSpecifier(fhirpathParser.TypeSpecifierContext ctx);
	/**
	 * Enter a parse tree produced by {@link fhirpathParser#qualifiedIdentifier}.
	 * @param ctx the parse tree
	 */
	void enterQualifiedIdentifier(fhirpathParser.QualifiedIdentifierContext ctx);
	/**
	 * Exit a parse tree produced by {@link fhirpathParser#qualifiedIdentifier}.
	 * @param ctx the parse tree
	 */
	void exitQualifiedIdentifier(fhirpathParser.QualifiedIdentifierContext ctx);
	/**
	 * Enter a parse tree produced by {@link fhirpathParser#identifier}.
	 * @param ctx the parse tree
	 */
	void enterIdentifier(fhirpathParser.IdentifierContext ctx);
	/**
	 * Exit a parse tree produced by {@link fhirpathParser#identifier}.
	 * @param ctx the parse tree
	 */
	void exitIdentifier(fhirpathParser.IdentifierContext ctx);
}