/**
 * 导入CPA学习资料到财务知识库
 * 使用方法：node scripts/import-cpa-to-knowledge.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// 配置
const CONFIG = {
  // 本地服务器地址（用于开发环境）
  baseUrl: 'http://localhost:3000',
  // API端点
  importEndpoint: '/api/import',
  // 知识库实体
  entity: 'knowledge',
  // CPA学习资料目录
  cpaResourcesDir: path.join(__dirname, '..', 'cpa-resources'),
  // 标签映射
  tagMap: {
    '会计': 'entry',
    '审计': 'entry',
    '税法': 'tax',
    '经济法': 'entry',
    '财务成本管理': 'entry',
    '公司战略与风险管理': 'entry',
  },
  // 默认标签
  defaultTag: 'cpa',
};

/**
 * 读取目录中的所有Markdown文件
 */
function readMarkdownFiles(dirPath, relativePath = '') {
  const files = [];
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const itemRelativePath = relativePath ? `${relativePath}/${item}` : item;
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 递归读取子目录
      files.push(...readMarkdownFiles(fullPath, itemRelativePath));
    } else if (item.endsWith('.md')) {
      // 读取Markdown文件
      const content = fs.readFileSync(fullPath, 'utf-8');
      files.push({
        path: itemRelativePath,
        name: path.basename(item, '.md'),
        content: content,
        dir: relativePath,
      });
    }
  }
  
  return files;
}

/**
 * 从文件路径提取科目信息
 */
function extractSubjectFromPath(filePath) {
  const parts = filePath.split('/');
  if (parts.length > 0) {
    const subject = parts[0];
    return subject;
  }
  return '其他';
}

/**
 * 从文件内容提取标题
 */
function extractTitle(content, fileName) {
  // 尝试从Markdown标题提取
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  
  // 使用文件名作为标题
  return fileName.replace(/-/g, ' ');
}

/**
 * 确定标签
 */
function getTag(subject) {
  return CONFIG.tagMap[subject] || CONFIG.defaultTag;
}

/**
 * 导入数据到知识库
 */
async function importToKnowledge(rows) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      rows: rows,
    });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/import?entity=${CONFIG.entity}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error(`解析响应失败: ${data}`));
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('开始导入CPA学习资料到财务知识库...');
  console.log(`资料目录: ${CONFIG.cpaResourcesDir}`);
  
  // 检查目录是否存在
  if (!fs.existsSync(CONFIG.cpaResourcesDir)) {
    console.error('错误: cpa-resources目录不存在');
    process.exit(1);
  }
  
  // 读取所有Markdown文件
  const files = readMarkdownFiles(CONFIG.cpaResourcesDir);
  console.log(`找到 ${files.length} 个Markdown文件`);
  
  // 转换为知识库条目
  const rows = files.map(file => {
    const subject = extractSubjectFromPath(file.path);
    const title = extractTitle(file.content, file.name);
    const tag = getTag(subject);
    
    // 构建完整内容，包含文件路径信息
    const body = `【${subject}】${file.path}\n\n${file.content}`;
    
    return {
      title: title,
      body: body,
      tag: tag,
    };
  });
  
  console.log(`准备导入 ${rows.length} 条知识库条目`);
  
  // 分批导入（每批100条）
  const batchSize = 100;
  let imported = 0;
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    console.log(`导入第 ${i + 1} - ${Math.min(i + batchSize, rows.length)} 条...`);
    
    try {
      const result = await importToKnowledge(batch);
      if (result.ok) {
        imported += result.inserted || batch.length;
        console.log(`成功导入 ${result.inserted || batch.length} 条`);
      } else {
        console.error(`导入失败: ${result.error}`);
      }
    } catch (error) {
      console.error(`导入出错: ${error.message}`);
    }
    
    // 等待一下，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n导入完成！共导入 ${imported} 条CPA学习资料到财务知识库`);
  console.log('您可以在财务知识库页面查看这些资料');
}

// 运行主函数
main().catch(console.error);