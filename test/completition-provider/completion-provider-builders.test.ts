import { describe, it, expect } from 'bun:test';
import { provideCompletions } from '../../src/completion-provider';
import type { TypeInfo } from '../../src/types';

describe('CompletionProvider - builder consistency', () => {
  it('Index context should offer $this, $index, and %user variables consistently', async () => {
    const expr = 'x['; // trigger index context
    const completions = await provideCompletions(expr, expr.length, {
      variables: { '$this': {}, '$index': 0, x: 1 },
    });

    const vars = completions.filter(c => c.kind === 'variable').map(c => c.label);
    expect(vars).toContain('$index');
    // Refactor 2: ensure $this is present in index context the same as in argument context
    expect(vars).toContain('$this');
    // user variable should be prefixed with %
    expect(vars).toContain('%x');
  });

  it('Identifier context functions: correct insertText for no-arg vs arg functions and deduped entries', async () => {
    const expr = 'x.'; // after dot → identifier context
    const completions = await provideCompletions(expr, expr.length, {});

    // must include common functions like count and where
    const byLabel = new Map<string, { count: number; items: any[] }>();
    for (const c of completions.filter(c => c.kind === 'function')) {
      const entry = byLabel.get(c.label) || { count: 0, items: [] };
      entry.count++;
      entry.items.push(c);
      byLabel.set(c.label, entry);
    }

    // Refactor 2 expectation: dedup ensures one item per function label
    expect(byLabel.get('count')?.count ?? 0).toBe(1);
    expect(byLabel.get('where')?.count ?? 0).toBe(1);

    // All functions should include parentheses in insertText
    const countItem = byLabel.get('count')!.items[0];
    expect(countItem.insertText).toBe('count()');

    const whereItem = byLabel.get('where')!.items[0];
    expect(whereItem.insertText).toBe('where()');
  });

  it('Operator applicability respects collections: does not suggest "in" for collection left-hand side', async () => {
    // children() returns a collection (singleton: false), so left side is a collection
    const expr = 'children() ';
    const completions = await provideCompletions(expr, expr.length, {});
    const ops = completions.filter(c => c.kind === 'operator').map(c => c.label);
    // Refactor 2 expectation: 'in' should not be suggested when left is a collection
    expect(ops).not.toContain('in');
  });
});
