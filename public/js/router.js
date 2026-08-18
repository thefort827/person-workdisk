/**
 * Hash 路由器：页面切换、导航高亮、骨架屏、清理钩子
 */

import { routes } from './pages/index.js';
import { skeletonCards, esc } from './ui.js';

let container = null;
let currentPage = null;

export function currentRoute() {
  const hash = (location.hash || '#dashboard').replace(/^#\/?/, '');
  return hash.split('?')[0] || 'dashboard';
}

export function navigate(page) {
  location.hash = '#' + page;
}

export function closeDrawer() {
  const sb = document.getElementById('sideBar');
  const mask = document.getElementById('drawerMask');
  if (sb) sb.classList.remove('open');
  if (mask) mask.classList.remove('show');
}

export async function startRouter(containerEl) {
  container = containerEl;
  window.addEventListener('hashchange', render);
  await render();
}

async function render() {
  const id = currentRoute();
  const page = routes[id] || routes.dashboard;

  // 页面标题
  const titleEl = document.getElementById('pageTitle');
  const subEl = document.getElementById('pageSub');
  if (titleEl) titleEl.textContent = page.title;
  if (subEl) subEl.textContent = page.subtitle;

  // 导航高亮
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === id));

  // 清理上一页的定时器等资源
  if (currentPage && currentPage._cleanup) {
    try { currentPage._cleanup(); } catch { /* ignore */ }
  }
  currentPage = page;

  // 骨架屏
  container.innerHTML = skeletonCards(4, true);
  window.scrollTo({ top: 0 });
  closeDrawer();

  try {
    await page.render(container);
  } catch (err) {
    console.error('[router] 页面渲染失败：', err);
    container.innerHTML = `
      <div class="glass-card fade-in">
        <div class="empty-state">
          <div class="empty-ic">⚠️</div>
          <div>页面加载失败：${esc(err.message || '未知错误')}</div>
          <div class="action-bar center mt-12"><button class="btn btn-outline btn-sm" onclick="location.hash='#dashboard'">返回首页</button></div>
        </div>
      </div>`;
  }
}
