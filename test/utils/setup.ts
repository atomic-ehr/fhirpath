import { getInitializedModelProvider } from './model-provider-singleton';

// Initialize the model provider before tests run
export async function setup() {
  console.log('Initializing FHIRModelProvider...');
  await getInitializedModelProvider();
  console.log('FHIRModelProvider initialized.');
}