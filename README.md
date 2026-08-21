# Follow Builders — 每日 AI 摘要推送到飞书

每天定时拉取 [follow-builders](https://github.com/zarazhangrui/follow-builders) 的 feed，
用大模型（DeepSeek）润色成中文摘要，私发到你的飞书。

数据来自 follow-builders 项目，润色和飞书投递是本仓库自己加的。

## 你需要准备的 3 样东西

### 1. 一个 GitHub 仓库

把本仓库的这些文件传到一个**私有** GitHub 仓库里（推荐私有，因为要放密钥）。

### 2. 一个 DeepSeek API key

- 去 https://platform.deepseek.com 注册 / 登录
- 点 **API keys** → **创建 API key**，复制形如 `sk-...` 的 key
- 需要先充值（DeepSeek 很便宜，充 10 块钱能用很久，一天一份摘要才几分钱）

### 3. 一个飞书自建应用 + 你的 open_id

在 https://open.feishu.cn 创建「企业自建应用」，拿到 **App ID** 和 **App Secret**。

然后：

1. **开通权限**（权限管理里搜索并添加）：
   - `im:message`（获取与发送单聊消息）
   - `contact:user.id:readonly`（通过邮箱/手机号获取用户 ID，用来查自己的 open_id）
2. **启用机器人能力**：应用页面「添加应用能力」→ 添加「机器人」。
3. **创建版本并发布**，把你自己加进「可用范围」。
4. **拿到你的 open_id**：用手机号/邮箱调接口查（见下），或直接把 App ID/Secret 交给 AI 助手帮你查。

## 部署步骤

1. 把本仓库文件传到你的 GitHub 仓库（可以用 git，也可以网页直接上传）。
2. 进仓库 Settings → Secrets and variables → Actions → New repository secret，添加这几个：
   - `DEEPSEEK_API_KEY` — 你的 DeepSeek `sk-...`
   - `FEISHU_APP_ID` — 飞书 App ID
   - `FEISHU_APP_SECRET` — 飞书 App Secret
   - `FEISHU_RECEIVE_ID` — 你的 open_id
3. 进 Actions 标签，如果提示「enable workflows」就点启用。
4. 手动触发一次测试：Actions → "Daily AI Builders Digest" → Run workflow → Run。
5. 等它跑完（约 1 分钟），检查你的飞书是否收到消息。

## 改配置

- **改发送时间**：编辑 `.github/workflows/digest.yml` 里的 `cron`。cron 是 UTC 时间，
  北京时间 = UTC + 8。比如北京 9 点 = `0 1 * * *`。
- **改语言**：把 workflow 里 `DIGEST_LANGUAGE: 'zh'` 改成 `en` 或 `bilingual`。
- **改模型**：改 `DEEPSEEK_MODEL`（默认 `deepseek-chat`；想用推理模型可改 `deepseek-reasoner`）。

## 本地调试（可选）

```bash
# 拉 feed
node scripts/prepare-digest.js > digest.json

# 润色（需要 DEEPSEEK_API_KEY）
DEEPSEEK_API_KEY=sk-... DIGEST_LANGUAGE=zh node scripts/remix.js < digest.json > digest.md

# 发飞书（需要飞书三个环境变量）
FEISHU_APP_ID=... FEISHU_APP_SECRET=... FEISHU_RECEIVE_ID=... \
  node scripts/send-feishu.js --file digest.md
```
