/**
 * 前端模块 import/export 一致性静态校验（开发辅助，非部署文件）
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'public', 'js');

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(root);
const mods = {};

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const imports = {};
  const exports = new Set();
  const reImport = /import\s+(?:([^'"\s{][^'"\s]*?)\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = reImport.exec(src))) {
    const brace = m[0].match(/{(.*?)}/);
    const list = brace
      ? brace[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[1] || s.trim()).filter(Boolean)
      : m[1] ? [m[1]] : [];
    (imports[m[2]] = imports[m[2]] || []).push(...list);
  }
  const reExport = /export\s+(?:const|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = reExport.exec(src))) exports.add(m[1]);
  const reExportObj = /export\s+\{\s*([^}]*?)\s*\}/g;
  while ((m = reExportObj.exec(src))) {
    m[1].split(',').forEach((n) => {
      n = n.trim().split(/\s+as\s+/)[1] || n.trim();
      if (n) exports.add(n);
    });
  }
  mods[f] = { imports, exports };
}

function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  const cands = [base, base + '.js', path.join(base, 'index.js')];
  return cands.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}

let problems = 0;
for (const f of Object.keys(mods)) {
  for (const [spec, names] of Object.entries(mods[f].imports)) {
    if (!spec.startsWith('.')) continue;
    const target = resolve(f, spec);
    if (!target) {
      problems++;
      console.log('MISSING MODULE:', path.relative(root, f), '->', spec);
      continue;
    }
    for (const n of names) {
      if (n === 'default') continue;
      if (!mods[target].exports.has(n)) {
        problems++;
        console.log('MISSING EXPORT:', n, '| imported by', path.relative(root, f), 'from', spec);
      }
    }
  }
}
console.log('import/export check problems:', problems);
