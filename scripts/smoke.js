/**
 * 前端冒烟测试：jsdom 模拟浏览器环境 + 真实本地后端（http://127.0.0.1:3000）
 * 依次渲染全部页面，捕获运行时错误。
 *
 * 用法：先启动 node server.js，再运行 node scripts/smoke.js
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PUBLIC = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');

/* 前端为 ESM，但项目根 package.json 是 commonjs：复制到临时 ESM 目录再加载 */
const tmpDir = path.join(__dirname, '.smoke-tmp');
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ type: 'module' }));
function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else fs.writeFileSync(d, fs.readFileSync(s));
  }
}
copyTree(path.join(PUBLIC, 'js'), path.join(tmpDir, 'js'));
const appEntry = pathToFileURL(path.join(tmpDir, 'js/app.js')).href;

const dom = new JSDOM(html, {
  url: 'http://127.0.0.1:3000/#dashboard',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});

/* ---------- 全局注入 ---------- */
const w = dom.window;
global.window = w;
global.document = w.document;
global.location = w.location;
global.localStorage = w.localStorage;
global.navigator = w.navigator;
global.CustomEvent = w.CustomEvent;
global.HashChangeEvent = w.HashChangeEvent;
global.getComputedStyle = w.getComputedStyle;
global.requestAnimationFrame = w.requestAnimationFrame.bind(w);
w.scrollTo = () => {}; // jsdom 未实现 scrollTo

/* Chart.js 桩（jsdom 无 canvas 2d） */
class ChartStub {
  static instances = [];
  static defaults = {
    color: '',
    borderColor: '',
    font: {},
    plugins: { legend: { labels: {} }, tooltip: {} },
  };
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    ChartStub.instances.push(this);
  }
  destroy() {
    ChartStub.instances = ChartStub.instances.filter((i) => i !== this);
  }
  static getChart(canvas) {
    return ChartStub.instances.find((i) => i.canvas === canvas) || null;
  }
}
global.Chart = ChartStub;

/* fetch 走真实后端（Node fetch 不支持相对 URL，包装解析） */
const realFetch = global.fetch;
global.fetch = (url, opts) => realFetch(new URL(String(url), 'http://127.0.0.1:3000/').href, opts);

/* ---------- 工具 ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const unhandled = [];
process.on('unhandledRejection', (e) => unhandled.push('unhandledRejection: ' + (e && e.message ? e.message : e)));
w.addEventListener('error', (e) => errors.push('window.onerror: ' + (e && e.message ? e.message : e)));

/* ---------- 启动 ---------- */
(async () => {
  try {
    // 等待健康检查 + 引导（代理首次请求较慢，给足时间）
    await import(appEntry);
    await sleep(9000);

    const app = w.document.getElementById('app');
    if (!app) throw new Error('#app 不存在');

    const bootHtml = app.innerHTML;
    console.log('[probe] clockTime =', w.document.getElementById('clockTime').textContent);
    console.log('[probe] connText =', w.document.getElementById('connText').textContent);
    console.log('[probe] #app 长度 =', bootHtml.length);
    const checks = [
      ['看板渲染', bootHtml.includes('dash-kpis') && bootHtml.includes('dash-events')],
      ['KPI 卡片', bootHtml.includes('kpi-card')],
      ['图表 canvas', bootHtml.includes('<canvas')],
    ];
    for (const [name, ok] of checks) {
      console.log(`[boot] ${name}: ${ok ? 'OK' : 'FAIL'}`);
      if (!ok) throw new Error('boot check failed: ' + name);
    }

    // 依次访问所有页面（jsdom 原生 hashchange 事件驱动，不手动派发避免双重渲染）
    const routes = ['dashboard', 'report', 'spreadsheet', 'fintodo', 'invoice', 'fund', 'close', 'tax', 'knowledge', 'study', 'checkin', 'todo', 'weekreview', 'monthreview', 'settings'];
    for (const r of routes) {
      try {
        w.location.hash = '#' + r;
        await sleep(r === 'dashboard' || r === 'report' ? 3500 : 2200);
        const html2 = app.innerHTML;
        const okText = html2.length > 400 && !html2.includes('页面加载失败');
        console.log(`[page] #${r}: render ${okText ? 'OK' : 'FAIL'} (len=${html2.length})`);
        if (!okText) {
          console.log('   --- 页面内容片段 ---');
          console.log('   ' + html2.replace(/\s+/g, ' ').slice(0, 300));
          errors.push('page render failed: ' + r);
        }
      } catch (e) {
        errors.push(`page ${r} error: ${e.message}`);
        console.log(`[page] #${r}: EXCEPTION ${e.message}`);
      }
    }

    // 交互冒烟：在 fintodo 页面提交新增表单
    w.location.hash = '#fintodo';
    await sleep(2500);
    try {
      const form = w.document.getElementById('crud-form');
      const nameInput = w.document.getElementById('f-name');
      if (form && nameInput) {
        nameInput.value = '冒烟测试任务';
        form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
        await sleep(2500);
        const list = w.document.getElementById('crud-list');
        const ok = list && list.innerHTML.includes('冒烟测试任务');
        console.log('[interact] 新增任务表单: ' + (ok ? 'OK' : 'FAIL'));
        if (ok) {
          // 清理：确认删除该任务
          const item = [...list.querySelectorAll('.list-item')].find((x) => x.innerHTML.includes('冒烟测试任务'));
          if (item) {
            item.querySelector('.btn-danger').click();
            await sleep(600);
            const okBtn = w.document.getElementById('cf-ok');
            if (okBtn) {
              okBtn.click();
              await sleep(2000);
              console.log('[interact] 删除任务: OK');
            }
          }
        }
      } else {
        console.log('[interact] 表单未找到: FAIL');
        errors.push('fintodo form not found');
      }
    } catch (e) {
      errors.push('interact error: ' + e.message);
      console.log('[interact] EXCEPTION ' + e.message);
    }

    console.log('\n===== 冒烟测试结果 =====');
    if (errors.length || unhandled.length) {
      errors.forEach((e) => console.log('  ✗ ' + e));
      unhandled.forEach((e) => console.log('  ✗ ' + e));
      console.log('发现问题 ' + (errors.length + unhandled.length) + ' 个');
      process.exit(1);
    } else {
      console.log('✅ 全部通过');
      process.exit(0);
    }
  } catch (err) {
    console.error('FATAL:', err);
    process.exit(1);
  }
})();
