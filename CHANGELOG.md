# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added
- 球员预览新增完整比赛记录，以及按不同对手拆分的胜负和胜率分析。
- 积分排行榜新增较上一个有比赛日的名次升降标识，总榜和每日快照都会显示上升、下降、不变或新上榜状态。
- 新增预约 tab，每天本地 0 点按启用球员名单生成公开透明的随机上场顺序，并在页面说明日期种子、FNV-1a 签号和排序规则。
- 预约排序新增防连续机制，启用球员至少 3 人时，今日前 2 名不会和前一天最终前 2 名完全相同。
- 预约排序新增轻量权重：前一天最终垫底 2 人第二天优先，近 7 天活跃天数较多的球员略微靠前，同一天多场只算 1 个活跃日。
- 预约排序移除近 7 天 0 活跃日球员默认垫底机制，改为同一候选池内的轻量排序惩罚。
- 为 `2026-05-08` 预约排序追加公开重置盐值 `reset-5`，并限定 `gjj` 不进入当天前 2 名，用于重新 roll 当天抽签结果。

### Changed
- 默认 K 值改为 `60`，同分比赛胜者加 `30` 分、败者扣 `30` 分；历史积分继续从比赛记录回放重算，线上 D1 `settings.kFactor` 同步为 `60` 后即可追溯更新现有排行榜。
- 球员展示图去掉轮播逻辑，改为最近一场胜利展示胜利图片、失败展示失败图片；胜利和失败图片各只保留 1 张，重新上传会替换旧图。
- 球员列表改为胜利/失败双图展示布局，上传入口直接贴合对应图片位。
- 球员预览页同步使用胜利/失败双图布局；排名页缩略图只展示胜利或失败图片，不再回退到普通照片。
- 球员预览移除顶部资产概览和单独最近战绩模块，页面直接进入球探面板、对阵分析和完整比赛记录。
- 将 AI 请求超时时间从 12 秒延长到 60 秒，兼容响应较慢的 OpenAI 协议模型网关。
- 按小米 MiMo 文档改用 `max_completion_tokens`、`response_format: { type: "json_object" }`，并传入 `thinking: { type: "disabled" }` 关闭默认深度思考，避免推理预算耗尽后返回空内容。
- 历史 AI 补生成接口改为同步处理单场比赛，避免 Cloudflare 取消较慢的 `waitUntil()` 后台任务。
- AI 返回结构不正确时会重新调用模型生成，最多重试 10 次，减少赛后评价因偶发格式漂移漏生成的情况。

### Fixed
- 优化排行榜手机端布局，修复榜首卡、球员照片和排名卡片在窄屏下挤出屏幕或占用过高的问题。
- 收紧排行榜首屏布局，减少顶部、导航、榜首卡和表格行距，避免桌面视口需要滚动过多才能看到核心排名信息。
- 球员列表和预览中的 AI 素材不再重复展示 AI 称号、身价和评价，避免和独立评价字段混在一起。

### Tested
- `npx vitest run worker/ai.test.ts`

## [0.2.2] - 2026-05-06

### Added
- 球员照片新增普通、胜利、失败用途，最近一场赢球自动展示胜利图，输球自动展示失败图。
- 新增 D1 迁移 `0007_player_photo_roles.sql`，为 `player_photos` 增加照片用途字段。

### Changed
- 积分算法升级为激进 Elo：默认 K 值改为 `100`，同分胜负变化 `50` 分，低分爆冷击败高分会额外放大，单场变化封顶 `160` 分。
- 历史积分继续从胜负记录回放重算，线上 D1 `settings.kFactor` 需要同步为 `100` 才会让现有数据使用新算法。
- 球员管理照片上传区域只保留“上传胜利图片”和“上传失败图片”两个按钮，并收紧列表左侧照片布局。
- 积分榜照片缩略图隐藏图片上的名字、首字母和照片数量文字。

### Fixed
- 修复 PNG 上传后可能因为 data URL 过大或透明背景导致显示异常的问题，上传处理统一输出 JPEG data URL。

### Tested
- `npm test`
- `npm run lint`
- `npm run build`
- `npx wrangler deploy --dry-run`

## [0.2.1] - 2026-04-29

### Added
- 新增 `AGENTS.md`，记录项目架构、开发命令、Cloudflare D1 部署注意事项、UI 风格和 git 安全约定，方便后续 agent 接手维护。

## [0.2.0] - 2026-04-29

### Added
- 新增 Cloudflare Worker API，用于读取和写入共享数据
- 新增 Cloudflare D1 数据库绑定
- 新增 D1 初始迁移，包含 `players`、`matches` 和 `settings` 表
- 新增远程和本地 D1 迁移命令
- 新增 `wrangler.jsonc` D1 配置，支持部署到 Cloudflare Workers

### Changed
- 前端状态从浏览器 `localStorage` 改为调用 `/api/*` 云端接口
- 球员、比赛、设置、导入和清空操作改为写入共享 D1 数据库
- README 更新为多人共享部署说明

### Tested
- `npm test`
- `npm run lint`
- `npm run build`
- `npx wrangler deploy --dry-run`
- `npx wrangler d1 migrations apply billiards-elo-db --local`
- `npx wrangler d1 migrations apply billiards-elo-db --remote`

## [0.1.0] - 2026-04-27

### Added
- 初始化基于 `Next.js + TypeScript` 的前端项目
- 新增首页排行榜，支持积分、胜负场、胜率和最近比赛时间展示
- 新增球员管理页面，支持创建球员和启用/停用状态切换
- 新增比赛录入页面，支持录入两位球员之间的胜负关系
- 新增比赛历史页面，支持查看历史记录并删除误录比赛
- 新增数据设置页面，支持修改标题、导出 JSON、导入 JSON、清空本地数据
- 新增本地状态容器与 `localStorage` 持久化逻辑
- 新增基于 `Elo` 的积分计算、历史回放和排行榜构建逻辑
- 新增输入校验逻辑，包括重名校验、停用球员限制和非法对阵限制
- 新增静态导出配置，支持部署到 Cloudflare Pages

### Changed
- 将默认脚手架首页替换为完整的台球积分系统界面
- 将默认 README 替换为项目说明文档

### Tested
- `npm test`
- `npm run lint`
- `npm run build`
