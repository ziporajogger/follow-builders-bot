#!/usr/bin/env node
// Follow Builders — 润色（调 DeepSeek 大模型 API）
// 从 stdin 读 prepare-digest.js 输出的 JSON，交给大模型润色成摘要，
// 把 markdown 写到 stdout。
//
// 环境变量：
//   DEEPSEEK_API_KEY   （必填）
//   DEEPSEEK_MODEL     （默认 deepseek-chat；要推理可改 deepseek-reasoner）
//   DEEPSEEK_BASE_URL  （默认 https://api.deepseek.com）
//   DIGEST_LANGUAGE     zh / en / bilingual（默认 zh）

import { readFileSync } from 'fs';

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const LANGUAGE = process.env.DIGEST_LANGUAGE || 'zh';
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

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
      authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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
    console.error('DeepSeek API 错误', res.status, err.slice(0, 2000));
    process.exit(1);
  }

  const out = await res.json();
  const text = out.choices?.[0]?.message?.content || '';
  process.stdout.write(text);
}

function buildSystem(p, lang) {
  const parts = [];
  if (p.digest_intro) parts.push(p.digest_intro);
  if (p.summarize_tweets) parts.push(p.summarize_tweets);
  if (p.summarize_podcast) parts.push(p.summarize_podcast);
  if (p.summarize_blogs) parts.push(p.summarize_blogs);

  if (lang === 'zh' || lang === 'bilingual') {
    if (p.translate) parts.push(p.translate);
  }
  if (lang === 'zh') {
    parts.push(
      'FINAL OUTPUT LANGUAGE: Translate the entire digest into simplified Chinese (keep technical terms and proper nouns in English, per the translation instructions above).'
    );
  } else if (lang === 'bilingual') {
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
