# Changelog

All notable changes to this project will be documented in this file.

## [0.2.2] - 2026-05-06

### Added
- 球员照片新增普通、胜利、失败用途，最近一场赢球自动展示胜利图，输球自动展示失败图。
- 新增 D1 迁移 `0007_player_photo_roles.sql`，为 `player_photos` 增加照片用途字段。

### Changed
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
