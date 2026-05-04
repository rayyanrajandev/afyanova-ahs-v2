const { execSync } = require('child_process');
const fs = require('fs');

try {
  const output = execSync('node node_modules/.bin/vue-tsc --noEmit', {
    cwd: 'C:\\Portfolio\\afyanova-ahs-v2',
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).toString();
  
  console.log('No errors found');
  process.exit(0);
} catch (error) {
  const output = error.stdout ? error.stdout.toString() : '';
  const stderr = error.stderr ? error.stderr.toString() : '';
  const fullOutput = output + stderr;
  
  const lines = fullOutput.split('\n');
  const filteredLines = lines.filter(line => line.includes('walk-in-service'));
  
  if (filteredLines.length > 0) {
    console.log('Errors found in walk-in-service file:');
    console.log(filteredLines.join('\n'));
  } else {
    console.log('No errors in walk-in-service file');
  }
  
  process.exit(0);
}
