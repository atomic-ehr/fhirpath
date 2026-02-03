export * from './model-provider.common'
import { FHIRModelProviderBase, type Resource } from './model-provider.common';

export type Resolver = (typeName: string) => Promise<Resource | null>;
export type Searcher = (kind: 'primitive-type' | 'complex-type' | 'resource') => Promise<Resource[]>

export type Options = {
  resolve: Resolver,
  search: Searcher
}

export class FHIRModelProvider extends FHIRModelProviderBase {
  private _resolve: Resolver;
  private _search: Searcher;


  override async resolve(typeName: string): Promise<Resource | null> {
    return await this._resolve(typeName);
  }

  override async search(params: { kind: 'primitive-type' | 'complex-type' | 'resource' }): Promise<Resource[]> {
    return await this._search(params.kind);
  }

  reconfigure(options: Options) {
    this._resolve = options.resolve;
    this._search = options.search;
  }

  constructor(options: Options) {
    super();
    this._resolve = options.resolve;
    this._search = options.search;
  }
}
