#!/usr/bin/env node
// Follow Builders — 润色（调任意 OpenAI 兼容的大模型 API）
// 从 stdin 读 prepare-digest.js 输出的 JSON，交给大模型润色成摘要，
// 把 markdown 写到 stdout。
//
// 环境变量：
//   LLM_API_KEY     （必填）你所用服务商的 API key
//   LLM_BASE_URL    （可选）服务商 base URL，默认 https://api.deepseek.com
//   LLM_MODEL       （可选）模型名，默认 deepseek-chat
//   DIGEST_LANGUAGE  zh / en / bilingual（默认 zh）
//
// 只要服务商提供 OpenAI 兼容的 POST /chat/completions 接口就能用：
//   DeepSeek、OpenAI、Kimi(Moonshot)、智谱 GLM、通义千问、SiliconFlow 等。

import { readFileSync } from 'fs';

const MODEL = process.env.LLM_MODEL || 'deepseek-chat';
const LANGUAGE = process.env.DIGEST_LANGUAGE || 'zh';
const BASE_URL = (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');

const NO_CONTENT = {
  zh: '今天没有新的动态，明天再来看看。',
  en: 'No new updates today. Check back tomorrow.',
  bilingual: 'No new updates today. / 今天没有新的动态。',
};

async function main() {
  const raw = readFileSync(0, 'utf8');
  const data = JSON.parse(raw);

  if (data.status !== 'ok') {
    console.error('prepare-digest 失败:', JSON.stringify(data));
    process.exit(1);
  }

  const stats = data.stats || {};
  const hasContent =
    (stats.podcastEpisodes || 0) > 0 ||
    (stats.xBuilders || 0) > 0 ||
    (stats.blogPosts || 0) > 0;

  if (!hasContent) {
    console.log(NO_CONTENT[LANGUAGE] || NO_CONTENT.en);
    process.exit(0);
  }

  const system = buildSystem(data.prompts || {}, LANGUAGE);
  const userMsg = buildUser(data);

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('LLM API 错误', res.status, err.slice(0, 2000));
    process.exit(1);
  }

  const out = await res.json();
  const text = out.choices?.[0]?.message?.content || '';
  process.stdout.write(text);
}

const ZH_INSTRUCTIONS = `# 中文输出规范（必须遵守）

- 最终输出必须是纯简体中文：小节标题（"X / TWITTER" 写成 "推特"、"OFFICIAL BLOGS" 写成 "官方博客"、"PODCASTS" 写成 "播客"）、每条推文摘要、播客摘要全部翻译成中文。
- 禁止出现英文段落，禁止中英双语混排（不要"一段英文、下面跟一段中文"）。
- 技术术语保留英文：AI、LLM、agent、evals、API、fine-tuning、RAG、prompt、ARR、SaaS 等。
- 人名、公司名、产品名、工具名保留英文原文，不音译、不翻译。
- 所有 URL 原样保留。
- 语气专业但有对话感，像一位懂行的朋友在跟你聊天；禁止使用破折号（em dash）。

# 抓重点 + 清晰分隔（必须遵守）

- 只写最有价值的内容：原创观点、产品发布、技术洞察、行业判断、金句。每个 builder 用 2-4 句中文概括。
- 跳过：日常闲聊、无评论的转发、纯推广、"活动很棒"这类、空洞的预告。没有实质内容的 builder 直接省略，不要硬凑字数。
- 每个 builder 之间用单独一行 "---" 分隔，让内容视觉上明显分开，不要挤在一起。
- 每个 builder 的标题用 "### 全名 + 头衔"（头衔从 bio 提取，例如 "Box CEO Aaron Levie"），标题下直接写中文摘要，最后放该条内容的原文链接。`;

function buildSystem(p, lang) {
  const parts = [];
  if (p.digest_intro) parts.push(p.digest_intro);
  if (p.summarize_tweets) parts.push(p.summarize_tweets);
  if (p.summarize_podcast) parts.push(p.summarize_podcast);
  if (p.summarize_blogs) parts.push(p.summarize_blogs);

  if (lang === 'zh') {
    parts.push(ZH_INSTRUCTIONS);
  } else if (lang === 'bilingual') {
    if (p.translate) parts.push(p.translate);
    parts.push(
      'FINAL OUTPUT LANGUAGE: Bilingual — interleave English and Chinese paragraph by paragraph, per the translation instructions above.'
    );
  }
  return parts.join('\n\n---\n\n');
}

function buildUser(data) {
  return JSON.stringify(
    {
      config: data.config,
      podcasts: data.podcasts,
      x: data.x,
      blogs: data.blogs,
      stats: data.stats,
    },
    null,
    2
  );
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
