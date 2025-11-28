export * from './model-provider.common'
import { CanonicalManager as createCanonicalManager, type Config,  } from '@atomic-ehr/fhir-canonical-manager';
import { FHIRModelProviderBase, type Resource } from './model-provider.common';

export interface FHIRModelProviderConfig {
  packages: Array<{ name: string; version: string }>;
  cacheDir?: string;
  registryUrl?: string;
}

export class FHIRModelProvider extends FHIRModelProviderBase {
  private canonicalManager: ReturnType<typeof createCanonicalManager>;

  override async prepare(): Promise<void> {
    await this.canonicalManager.init();
  }

  override async resolve(canonicalUrl: string): Promise<Resource> {
    return await this.canonicalManager.resolve(canonicalUrl);
  }

  override async search(params: { kind: 'primitive-type' | 'complex-type' | 'resource' }): Promise<Resource[]> {
    return await this.canonicalManager.search(params);
  }

  constructor(private config: FHIRModelProviderConfig = {
    packages: [{ name: 'hl7.fhir.r4.core', version: '4.0.1' }]
  }) {
    super();
    const canonicalConfig: Config = {
      packages: config.packages.map(p => `${p.name}@${p.version}`),
      workingDir: config.cacheDir || './tmp/.fhir-cache'
    };

    if (config.registryUrl) {
      canonicalConfig.registry = config.registryUrl;
    }

    this.canonicalManager = createCanonicalManager(canonicalConfig);
  }
}
