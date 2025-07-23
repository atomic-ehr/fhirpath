#!/usr/bin/env bun

import { spawn } from 'child_process';
import { join } from 'path';

// Run the tests
const testProcess = spawn('bun', ['test', 'test/unified-test-runner.test.ts'], {
  stdio: 'inherit',
  shell: true
});

testProcess.on('close', (code) => {
  console.log(`\nTests finished with code ${code}`);
  console.log('Report should be available at test-output/test-results.html');
  
  // Exit with the same code as the test process
  process.exit(code || 0);
});