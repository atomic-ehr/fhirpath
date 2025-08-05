import { FHIRModelProvider } from '../src/index';

let _instance: FHIRModelProvider | undefined;
let _initPromise: Promise<void> | undefined;

export async function getInitializedModelProvider(): Promise<FHIRModelProvider> {
  if (!_instance) {
    _instance = new FHIRModelProvider();
    _initPromise = _instance.initialize();
  }
  
  if (_initPromise) {
    await _initPromise;
  }
  
  return _instance;
}

// For synchronous access (will return uninitialized provider if not ready)
export function getModelProviderSync(): FHIRModelProvider {
  if (!_instance) {
    _instance = new FHIRModelProvider();
    // Start initialization but don't wait
    _initPromise = _instance.initialize();
    _initPromise.catch(console.error);
  }
  return _instance;
}

// Pre-initialize on module load
getInitializedModelProvider().catch(console.error);