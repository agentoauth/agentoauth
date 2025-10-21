// Simple script to create ESM wrapper
const { writeFileSync, readFileSync, readdirSync, existsSync } = require('fs');
const { join } = require('path');

const distDir = './dist';

if (!existsSync(distDir)) {
  console.error('❌ dist/ directory not found. Run tsc first.');
  process.exit(1);
}

// Create .mjs files that re-export from .js files
const files = readdirSync(distDir).filter(f => f.endsWith('.js') && !f.endsWith('.mjs'));

files.forEach(file => {
  const mjsFile = file.replace('.js', '.mjs');
  const moduleName = './' + file;
  
  const content = `export * from '${moduleName}';\n`;
  writeFileSync(join(distDir, mjsFile), content);
  console.log(`Created ${mjsFile}`);
});

// Create index.d.mts from index.d.ts
const dtsPath = join(distDir, 'index.d.ts');
if (existsSync(dtsPath)) {
  writeFileSync(join(distDir, 'index.d.mts'), 
    `export * from './index.js';\n`);
  console.log('Created index.d.mts');
}

console.log('✅ ESM build complete');

