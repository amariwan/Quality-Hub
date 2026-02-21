const fs = require('fs');
const path = require('path');

const directories = [
  'src/components',
  'src/components/forms',
  'src/components/layout',
  'src/components/themes',
  'src/components/ui',
  'src/features',
  'src/features/auth',
  'src/features/auth/components',
  'src/features/overview',
  'src/features/overview/components',
  'src/features/products',
  'src/features/products/components',
  'src/features/kanban',
  'src/features/kanban/components',
  'src/features/profile',
  'src/hooks',
  'src/lib',
  'src/constants',
  'src/types'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) return false;
  if (!fs.statSync(dir).isDirectory()) return false;
  return true;
}

function createIndex(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const exports = new Set();

  entries.forEach((entry) => {
    if (entry.name === 'index.ts') return;

    if (entry.isDirectory()) {
      const subIndex = path.join(dir, entry.name, 'index.ts');
      if (fs.existsSync(subIndex)) {
        exports.add(entry.name);
      }
    }

    if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (ext !== '.ts' && ext !== '.tsx') return;
      const base = path.basename(entry.name, ext);
      if (base === 'index') return;
      exports.add(base);
    }
  });

  const lines = Array.from(exports)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `export * from './${name}';`);

  const content = lines.join('\n') + (lines.length ? '\n' : '');
  const targetPath = path.join(dir, 'index.ts');

  if (
    fs.existsSync(targetPath) &&
    fs.readFileSync(targetPath, 'utf8') === content
  ) {
    return false;
  }

  fs.writeFileSync(targetPath, content);
  return true;
}

let created = 0;

directories.forEach((relDir) => {
  const absDir = path.resolve(__dirname, '..', relDir);
  if (!ensureDir(absDir)) return;
  if (createIndex(absDir)) {
    created += 1;
    console.log(`Created index in ${relDir}`);
  }
});

if (!created) {
  console.log('No index files were created or updated.');
}
