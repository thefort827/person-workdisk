(async () => {
  const base = 'https://person-workdisk-xe14.vercel.app';
  try {
    const js = await (await fetch(base + '/js/ui.js')).text();
    const fixed = js.includes("mask.classList.remove('hidden')");
    console.log('线上弹窗修复已上线:', fixed ? '✅ 新版本已部署' : '❌ 仍是旧版');
    if (!fixed) {
      const css = await (await fetch(base + '/css/app.css')).text();
      console.log('CSS 兜底规则:', css.includes('display: flex !important') ? '有' : '无');
    }
  } catch (e) {
    console.log('ERR', e.message);
  }
})();
