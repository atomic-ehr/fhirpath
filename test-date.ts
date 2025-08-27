import { evaluate } from './src/index';

async function test() {
  // Try without model provider first
  const input = [{
    resourceType: "Patient",
    birthDate: "1974-12-25"
  }];
  
  const result1 = await evaluate("Patient.birthDate", { input });
  console.log("Patient.birthDate (no model):", result1);
  
  const result2 = await evaluate("Patient.birthDate - 1 day", { input });
  console.log("Patient.birthDate - 1 day (no model):", result2);
  
  // Try with direct date literal
  const result3 = await evaluate("@1974-12-25 - 1 day", { input: [] });
  console.log("@1974-12-25 - 1 day:", result3);
}

test().catch(console.error);
