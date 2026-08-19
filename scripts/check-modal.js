const fs = require('fs');
const path = require('path');
const PUBLIC = path.join(__dirname, '..', 'public');
const ui = fs.readFileSync(path.join(PUBLIC, 'js/ui.js'), 'utf8');
const css = fs.readFileSync(path.join(PUBLIC, 'css/app.css'), 'utf8');

const ok1 = ui.includes("mask.classList.remove('hidden')");
const ok2 = ui.includes("mask.classList.add('hidden')");
const ok3 = /\.hidden\s*\{[^}]*display:\s*none\s*!important/.test(css);
const ok4 = /\.modal-mask\.show\s*\{[^}]*display:\s*flex\s*!important/.test(css);

console.log('ui.js 打开时移除 hidden:', ok1);
console.log('ui.js 关闭时加回 hidden:', ok2);
console.log('CSS .hidden 隐藏规则:', ok3);
console.log('CSS .show 兜底显示规则:', ok4);
console.log(ok1 && ok2 && ok3 && ok4 ? '✅ 修复完整' : '❌ 仍有缺失');
