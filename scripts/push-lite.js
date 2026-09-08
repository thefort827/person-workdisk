/**
 * 精简版 GitHub API 推送脚本
 * 排除大目录（cpa-downloads、cpa-resources、node_modules）避免速率限制
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.argv[2];
const REPO = 'thefort827/person-workdisk';
const BRANCH = 'main';

const SKIP_DIRS = new Set(['node_modules', '.git', 'cpa-downloads', 'cpa-resources', 'scripts/node_modules', '.npm-cache', '.smoke-tmp']);

function api(method, apiPath, body) {
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com', path: apiPath, method,
      headers: {
        Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'person-workdisk',
        Accept: 'application/vnd.github.v3+json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let result = '';
      res.on('data', (c) => result += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(result) }); }
        catch { resolve({ status: res.statusCode, data: result }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function walk(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (SKIP_DIRS.has(entry.name) || SKIP_DIRS.has(rel)) continue;
    if (entry.name === '.env') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full, rel));
    else {
      try {
        const content = fs.readFileSync(full);
        if (content.length < 500000) results.push({ path: rel, content }); // skip files >500KB
      } catch {}
    }
  }
  return results;
}

async function main() {
  console.log(`🚀 推送到 ${REPO} (排除大目录)...`);
  
  const ref = await api('GET', `/repos/${REPO}/git/refs/heads/${BRANCH}`);
  if (ref.status !== 200) { console.error('❌ 获取分支失败:', ref.data); process.exit(1); }
  const baseSha = ref.data.object.sha;

  const commit = await api('GET', `/repos/${REPO}/git/commits/${baseSha}`);
  const treeSha = commit.data.tree.sha;

  const files = walk(path.join(__dirname, '..'));
  console.log(`  文件数: ${files.length}`);

  // 上传 blobs（并行，分批避免速率限制）
  const CONCURRENCY = 5;
  const DELAY = 200;
  const uploaded = [];
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (f) => {
      const res = await api('POST', `/repos/${REPO}/git/blobs`, {
        content: Buffer.from(f.content).toString('base64'), encoding: 'base64',
      });
      if (res.status !== 201) { console.error(`  ❌ ${f.path}`); return null; }
      return { path: f.path, sha: res.data.sha };
    }));
    uploaded.push(...results.filter(Boolean));
    if (i + CONCURRENCY < files.length) await new Promise(r => setTimeout(r, DELAY));
  }
  console.log(`  上传: ${uploaded.length}/${files.length}`);

  // 创建 tree
  const tree = await api('POST', `/repos/${REPO}/git/trees`, {
    base_tree: treeSha,
    tree: uploaded.map((f) => ({ path: f.path, mode: '100644', type: 'blob', sha: f.sha })),
  });
  if (tree.status !== 201) { console.error('❌ Tree 失败:', tree.data); process.exit(1); }

  // 创建 commit
  const newCommit = await api('POST', `/repos/${REPO}/git/commits`, {
    message: `feat: 在线答题系统（出题/选择题/判断题/自动评分/成绩记录/即时反馈）

- 新增题库表：aiba_questions、aiba_quizzes、aiba_quiz_answers
- 后端API：创建题目、查询题库、开始答题、提交评分、历史记录
- 前端：独立答题页面、逐题卡片作答、即时反馈、成绩报告
- CSS：小清新风格答题卡、选项高亮、进度条
- 修复 getSheetIds→getSheetName 适配 HyperFormula v2`,
    tree: tree.data.sha,
    parents: [baseSha],
  });
  if (newCommit.status !== 201) { console.error('❌ Commit 失败:', newCommit.data); process.exit(1); }

  // 更新分支
  const update = await api('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, {
    sha: newCommit.data.sha, force: false,
  });
  if (update.status === 200) {
    console.log('✅ 推送成功！');
    console.log('   https://github.com/' + REPO + '/commit/' + newCommit.data.sha);
  } else {
    console.error('❌ 更新分支失败:', update.data);
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
