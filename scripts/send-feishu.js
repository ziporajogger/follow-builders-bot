#!/usr/bin/env node
// Follow Builders — 飞书投递（自建应用）
// 读 digest markdown（--file 或 stdin），转成飞书 post 富文本，发给指定用户。
//
// 用法：
//   node send-feishu.js --file digest.md
//   cat digest.md | node send-feishu.js
//
// 环境变量：
//   FEISHU_APP_ID          自建应用 app_id（必填）
//   FEISHU_APP_SECRET      自建应用 app_secret（必填）
//   FEISHU_RECEIVE_ID      接收者 open_id（必填）
//   FEISHU_RECEIVE_ID_TYPE 默认 open_id
//   FEISHU_MSG_TYPE        默认 post（可选 text）

import { readFileSync } from 'fs';

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const RECEIVE_ID = process.env.FEISHU_RECEIVE_ID;
const RECEIVE_ID_TYPE = process.env.FEISHU_RECEIVE_ID_TYPE || 'open_id';
const MSG_TYPE = process.env.FEISHU_MSG_TYPE || 'post';

function getText() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    return readFileSync(args[fileIdx + 1], 'utf8');
  }
  return readFileSync(0, 'utf8');
}

async function getToken() {
  const res = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    }
  );
  const j = await res.json();
  if (j.code !== 0) throw new Error('获取 tenant_access_token 失败: ' + JSON.stringify(j));
  return j.tenant_access_token;
}

async function send(token, content) {
  const res = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${RECEIVE_ID_TYPE}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: RECEIVE_ID,
        msg_type: MSG_TYPE,
        content,
      }),
    }
  );
  const j = await res.json();
  if (j.code !== 0) throw new Error('发送失败: ' + JSON.stringify(j));
  return j;
}

function buildContent(md) {
  if (MSG_TYPE === 'text') {
    return JSON.stringify({ text: md });
  }
  return JSON.stringify({ zh_cn: { title: 'AI Builders Digest', content: markdownToPost(md) } });
}

// markdown → 飞书 post 富文本（标题、列表、链接、加粗）
function markdownToPost(md) {
  const content = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^-{3,}$/.test(line) || /^\*{3,}$/.test(line)) continue; // 分隔线，跳过

    if (/^#{1,6}\s/.test(line)) {
      const text = line.replace(/^#{1,6}\s+/, '');
      content.push([{ tag: 'text', text: '【' + text + '】' }]);
      continue;
    }

    const isBullet = /^[-*]\s/.test(line);
    const text = (isBullet ? '• ' : '') + line.replace(/^[-*]\s+/, '');
    content.push(inlineToPost(text));
  }
  return content;
}

// 处理行内的 markdown：**加粗**、[文字](链接)、裸链接
function inlineToPost(text) {
  const nodes = [];
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push({ tag: 'text', text: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push({ tag: 'text', text: tok.slice(2, -2) });
    } else if (tok.startsWith('[')) {
      const mm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      nodes.push({ tag: 'a', text: mm[1], href: mm[2] });
    } else {
      nodes.push({ tag: 'a', text: tok, href: tok });
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push({ tag: 'text', text: text.slice(last) });
  return nodes;
}

async function main() {
  for (const [k, v] of Object.entries({ APP_ID, APP_SECRET, RECEIVE_ID })) {
    if (!v) throw new Error('缺少环境变量 ' + k);
  }
  const md = getText();
  if (!md || !md.trim()) throw new Error('digest 文本为空');

  const token = await getToken();
  const content = buildContent(md);
  const result = await send(token, content);
  console.log('已发送，message_id:', result.data && result.data.message_id);
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
