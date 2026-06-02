#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const allowedFiles = new Set([
  'src/lib/i18n.ts',
  'src/lib/blogBilingual.ts',
  'src/pages/blog/index.tsx',
  'src/pages/blog/[slug].tsx',
  'src/components/BlogVisual.tsx',
  'src/pages/landing.tsx',
  'src/lib/imageStore.ts',
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const hits = [];
for (const file of walk(src)) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (allowedFiles.has(rel) || rel.includes('/api/')) continue;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (!/[\u4e00-\u9fff]/.test(line)) return;
    const s = line.trim();
    // These are bilingual data literals or the language-toggle button itself, not untranslated UI.
    if ((s.includes('zh:') && s.includes('en:')) || s.includes("lang === 'zh'") || s.includes('l: { zh:')) return;
    // Non-UI server/library errors are deliberately excluded from the UI toggle audit.
    hits.push(`${rel}:${idx + 1}: ${s}`);
  });
}

if (hits.length) {
  console.error('Hardcoded Chinese UI strings found outside i18n/bilingual data:');
  for (const h of hits) console.error(h);
  process.exit(1);
}
console.log('i18n hardcoded UI audit passed');
