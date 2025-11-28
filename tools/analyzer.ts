#!/usr/bin/env bun

import { analyze } from '../src/index.node';
import { readFileSync } from 'fs';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: bun tools/analyzer.ts "<fhirpath-expression>" [options]');
    console.log('');
    console.log('Examples:');
    console.log('  bun tools/analyzer.ts "5 + 3"');
    console.log('  bun tools/analyzer.ts "Patient.name.given"');
    console.log('  bun tools/analyzer.ts "name.given" --type Patient');
    console.log('  bun tools/analyzer.ts "%x + %y" --vars \'{"x": 10, "y": 20}\'');
    console.log('  bun tools/analyzer.ts "property.defineVariable(\'x\', $this.value).select(%x)"');
    console.log('');
    console.log('Options:');
    console.log('  --vars, -v    JSON object with variables');
    console.log('  --type, -t    Input type (e.g., "Patient", "String", etc.)');
    console.log('  --singleton   Input is a singleton (single value)');
    console.log('  --ast         Show AST structure');
    process.exit(0);
  }
  
  const expression = args[0]!;
  let inputType: any = { type: 'Any', singleton: false };
  let variables: Record<string, any> = {};
  let showAst = false;
  
  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--vars' || arg === '-v') {
      i++;
      if (i < args.length) {
        try {
          variables = JSON.parse(args[i]!);
        } catch (e) {
          console.error('Error parsing variables JSON:', e);
          process.exit(1);
        }
      }
    } else if (arg === '--type' || arg === '-t') {
      i++;
      if (i < args.length) {
        inputType.type = args[i]!;
      }
    } else if (arg === '--singleton') {
      inputType.singleton = true;
    } else if (arg === '--ast') {
      showAst = true;
    }
  }
  
  try {
    console.log(`\n🔍 Analyzing: ${expression}`);
    console.log(`📥 Input Type: ${JSON.stringify(inputType)}`);
    if (Object.keys(variables).length > 0) {
      console.log(`📦 Variables: ${JSON.stringify(variables)}`);
    }
    console.log('');
    
    const result = await analyze(expression, {
      variables,
      inputType
    });
    
    console.log('✅ Analysis Result:');
    console.log('  Result Type:', JSON.stringify(result.type || 'Unknown'));
    
    if (result.diagnostics && result.diagnostics.length > 0) {
      console.log('\n⚠️  Diagnostics:');
      for (const diag of result.diagnostics) {
        const severity = diag.severity === 1 ? '❌ ERROR' : 
                         diag.severity === 2 ? '⚠️  WARNING' : 
                         diag.severity === 3 ? 'ℹ️  INFO' : 
                         '💡 HINT';
        console.log(`  ${severity}: ${diag.message}`);
        if (diag.code) {
          console.log(`    Code: ${diag.code}`);
        }
      }
    } else {
      console.log('\n✅ No diagnostics - expression is valid');
    }
    
    if (result.userVariables && result.userVariables.size > 0) {
      console.log('\n📝 User Variables Defined:');
      for (const [name, type] of result.userVariables.entries()) {
        console.log(`  %${name}: ${JSON.stringify(type)}`);
      }
    }
    
    if (showAst) {
      console.log('\n🌳 AST Structure:');
      console.log(JSON.stringify(result.ast, (key, value) => {
        // Filter out location info for readability
        if (key === 'range' || key === 'location') return undefined;
        return value;
      }, 2).split('\n').slice(0, 50).join('\n'));
      if (JSON.stringify(result.ast).length > 2000) {
        console.log('... (truncated)');
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ Analysis Error:', error.message);
    if (error.code) {
      console.error('   Code:', error.code);
    }
    if (error.stack && process.env.DEBUG) {
      console.error('\n   Stack trace:');
      console.error(error.stack.split('\n').slice(1, 5).join('\n'));
    }
    process.exit(1);
  }
}

main();