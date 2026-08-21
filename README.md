# Follow Builders — 每日 AI 摘要推送到飞书

每天定时拉取 [follow-builders](https://github.com/zarazhangrui/follow-builders) 的 feed，
用大模型润色成中文摘要，私发到你的飞书。

数据来自 follow-builders 项目，润色和飞书投递是本仓库自己加的。

润色这一步**不绑定任何一家大模型**——只要服务商提供 OpenAI 兼容的
`/chat/completions` 接口就能用（DeepSeek、OpenAI、Kimi、GLM、通义千问、SiliconFlow 等）。

## 你需要准备的 3 样东西

### 1. 一个 GitHub 仓库

把本仓库的这些文件传到一个**私有** GitHub 仓库里（推荐私有，因为要放密钥）。

### 2. 一个大模型 API key（任意 OpenAI 兼容服务商）

去你常用的服务商注册并创建 API key，形如 `sk-...`，需要先充值。

常用服务商配置（填到 Secrets 或 workflow 的 `LLM_BASE_URL` / `LLM_MODEL`）：

| 服务商 | LLM_BASE_URL | LLM_MODEL（示例） |
|--------|--------------|------------------|
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| Kimi (Moonshot) | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| SiliconFlow | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3` |

> 模型名以各家文档为准（会更新）。用哪家，就把 `LLM_BASE_URL` 和 `LLM_MODEL` 换成哪家的值。

### 3. 一个飞书自建应用 + 你的 open_id

在 https://open.feishu.cn 创建「企业自建应用」，拿到 **App ID** 和 **App Secret**。

然后：

1. **开通权限**（权限管理里搜索并添加）：
   - `im:message`（获取与发送单聊消息）
   - `contact:user.id:readonly`（通过邮箱/手机号获取用户 ID，用来查自己的 open_id）
2. **启用机器人能力**：应用页面「添加应用能力」→ 添加「机器人」。
3. **创建版本并发布**，把你自己加进「可用范围」。
4. **拿到你的 open_id**：用手机号/邮箱调接口查，或直接把 App ID/Secret 交给 AI 助手帮你查。

## 部署步骤

1. 把本仓库文件传到你的 GitHub 仓库（可以用 git，也可以网页直接上传）。
2. 进仓库 Settings → Secrets and variables → Actions → New repository secret，添加这几个：
   - `LLM_API_KEY` — 你所用服务商的 API key（`sk-...`）
   - `FEISHU_APP_ID` — 飞书 App ID
   - `FEISHU_APP_SECRET` — 飞书 App Secret
   - `FEISHU_RECEIVE_ID` — 你的 open_id
3. 进 Actions 标签，如果提示「enable workflows」就点启用。
4. 手动触发一次测试：Actions → "Daily AI Builders Digest" → Run workflow → Run。
5. 等它跑完（约 1 分钟），检查你的飞书是否收到消息。

## 改配置

- **换大模型**：编辑 `.github/workflows/digest.yml` 第 2 步里的 `LLM_BASE_URL` 和 `LLM_MODEL`。
- **改发送时间**：编辑 `.github/workflows/digest.yml` 里的 `cron`。cron 是 UTC 时间，
  北京时间 = UTC + 8。比如北京 9 点 = `0 1 * * *`。
- **改语言**：把 workflow 里 `DIGEST_LANGUAGE: 'zh'` 改成 `en` 或 `bilingual`。

## 本地调试（可选）

```bash
# 拉 feed
node scripts/prepare-digest.js > digest.json

# 润色（需要 LLM_API_KEY，按需加 LLM_BASE_URL / LLM_MODEL）
LLM_API_KEY=sk-... DIGEST_LANGUAGE=zh node scripts/remix.js < digest.json > digest.md

# 发飞书（需要飞书三个环境变量）
FEISHU_APP_ID=... FEISHU_APP_SECRET=... FEISHU_RECEIVE_ID=... \
  node scripts/send-feishu.js --file digest.md
```
