(async () => {
  const base = 'https://person-workdisk-xe14.vercel.app';
  try {
    const css = await (await fetch(base + '/css/app.css')).text();
    const light = css.includes('#f3f8f6') && css.includes('#4dd6a8') && !css.includes('rgba(14,19,41');
    console.log('线上浅色小清新 CSS 已上线:', light ? '✅' : '❌ 仍是旧版');
    const html = await (await fetch(base + '/')).text();
    console.log('新 Logo 已上线:', html.includes('viewBox="0 0 48 48"') ? '✅' : '❌');
    const H = { 'X-App-Token': 'fan' };
    const d = await (await fetch(base + '/api/dashboard', { headers: H })).json();
    console.log('dashboard 接口:', d.ok ? '✅ 正常' : '❌ ' + d.error);
  } catch (e) {
    console.log('网络暂不可达，稍后重试:', e.message);
  }
})();
