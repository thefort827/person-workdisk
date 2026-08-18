/**
 * Supabase 数据库迁移/初始化脚本
 *
 * 用法：
 *   node migrate.js                          # 连接测试（仅打印连通状态）
 *   node migrate.js schema.sql               # 执行建表脚本
 *
 * 连接参数通过环境变量传入（也可在脚本顶部直接修改默认值）：
 *   PG_HOST      数据库主机（默认 db.<项目ref>.supabase.co）
 *   PG_PORT      端口（直连 5432 / 事务池 6543）
 *   PG_USER      用户名（直连 postgres / 池化 postgres.<项目ref>）
 *   PG_PASSWORD  数据库密码
 *   PG_DATABASE  数据库名（默认 postgres）
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const REF = process.env.PG_REF || 'cnurfjamlzxbnctkfezv';
const HOST = process.env.PG_HOST || `db.${REF}.supabase.co`;
const PORT = Number(process.env.PG_PORT || 5432);
const USER = process.env.PG_USER || 'postgres';
const PASSWORD = process.env.PG_PASSWORD || '';
const DATABASE = process.env.PG_DATABASE || 'postgres';

async function main() {
  const file = process.argv[2];
  const client = new Client({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
    statement_timeout: 120000,
  });

  console.log(`连接 ${HOST}:${PORT}  ${USER}@${DATABASE} ...`);
  await client.connect();
  const ver = await client.query('select version()');
  console.log('✅ 连接成功：', ver.rows[0].version.slice(0, 60));

  if (!file) {
    const tables = await client.query(
      "select table_name from information_schema.tables where table_schema='public' order by table_name"
    );
    console.log('public 现有表：', tables.rows.map((r) => r.table_name).join(', ') || '（空）');
    await client.end();
    return;
  }

  const sqlPath = path.resolve(process.cwd(), file);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`执行建表脚本：${sqlPath}（${sql.length} 字符）...`);
  await client.query(sql);
  const tables = await client.query(
    "select table_name from information_schema.tables where table_schema='public' order by table_name"
  );
  console.log('✅ 脚本执行成功。public 现有表：');
  tables.rows.forEach((r) => console.log('   -', r.table_name));
  await client.end();
}

main().catch((err) => {
  console.error('❌ 失败：', err.message);
  if (err.code === 'ECONNREFUSED') console.error('   连接被拒绝：请检查主机/端口（沙箱环境可能禁止直连数据库 TCP）');
  if (err.code === '28P01') console.error('   密码错误');
  if (err.code === '3D000') console.error('   数据库不存在');
  process.exit(1);
});
