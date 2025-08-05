import { FHIRModelProvider } from '../../src/index';

let _instance: FHIRModelProvider | undefined;
let _initPromise: Promise<void> | undefined;

export async function getModelProvider(): Promise<FHIRModelProvider> {
  if (!_instance) {
    _instance = new FHIRModelProvider();
    _initPromise = _instance.initialize();
  }
  
  if (_initPromise) {
    await _initPromise;
  }
  
  return _instance;
}

// Pre-initialize on module load
getModelProvider().catch(console.error);