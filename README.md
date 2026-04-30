# Billiards ELO Rating System

一个免费、轻量的台球积分系统网站，适合球房、小群体或朋友局自己维护排行榜。

项目特点：
- 创建球员并维护启用/停用状态
- 录入两人胜负关系，自动按 `Elo` 计算积分
- 查看排行榜前三标识、比赛历史日期切换，并支持删除误录后自动重算
- 查看台球规则速查、训练小课和实战技巧
- 所有用户共享同一个 Cloudflare D1 数据库
- 支持导出/导入 JSON 备份
- 可部署到 Cloudflare Workers 静态资源站点

## 功能概览

### 1. 排行榜
- 按积分降序展示球员排名
- 显示积分、胜负场、胜率、最近比赛时间
- 前三名显示冠军、亚军、季军标识
- 支持总榜和按比赛日期查看历史排名快照
- 手机端卡片布局，桌面端表格布局

### 2. 球员管理
- 新建球员
- 防止重名
- 支持停用球员，避免误删导致历史数据失效

### 3. 比赛录入
- 选择胜者和负者
- 禁止同一球员对阵自己
- 录入后立即刷新积分榜
- 显示本场积分变化

### 4. 比赛历史
- 支持按比赛日期切换查看历史
- 显示当天积分上升第一和下降第一
- 按时间倒序展示已录入比赛
- 支持删除单场比赛
- 删除后自动从历史回放并重算积分

### 5. 数据设置
- 修改站点标题
- 导出 JSON 备份
- 导入 JSON 恢复
- 清空当前浏览器中的本地数据

### 6. 台球学堂
- 规则速查
- 训练小课
- 实战技巧
- 今日台球小知识

## 积分规则

- 默认初始分：`1000`
- 默认 `K` 值：`32`
- 仅记录胜负，不记录比分
- 每场比赛结束后按 `Elo` 更新双方积分
- 排名排序规则：
  - 先按积分降序
  - 同分时按胜率降序
  - 再按胜场降序
  - 最后按创建时间升序

## 技术栈

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)

## 本地开发

先安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看网站。

## 可用命令

```bash
npm run dev
npm run build
npm run lint
npm test
```

含义：
- `npm run dev`：启动本地开发服务
- `npm run build`：生成生产构建和静态导出
- `npm run lint`：运行 ESLint
- `npm test`：运行单元测试

## 部署

本项目已经配置：

```ts
output: "export"
```

同时包含 `wrangler.jsonc`，用于把静态文件和 Worker API 一起部署到 Cloudflare。

### Cloudflare Workers

推荐设置：
- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

首次部署前需要创建 D1 数据库，并把 `wrangler.jsonc` 里的 `database_id` 改成自己的数据库 ID。

然后执行远程数据库迁移：

```bash
npm run db:migrate:remote
```

迁移成功后，Cloudflare 会发布 `out` 目录中的静态页面，并用 Worker 处理 `/api/*` 数据请求。

## 数据说明

当前版本使用 Cloudflare D1 作为共享数据库。

这意味着：
- 多个用户打开同一个网站会看到同一份排行榜
- 任意用户录入比赛后，刷新页面即可看到最新数据
- 推荐定期通过“数据设置”页面导出 JSON 做备份
- 当前版本还没有登录和权限控制，知道网址的人都可以编辑数据

## 测试覆盖

当前包含以下核心测试：
- Elo 积分变化
- 比赛历史回放与删除后重算
- 排行榜排序规则
- 球员名称校验
- 比赛录入校验
- 本地存储导入导出

## 更新日志

### 2026-04-30
- 新增台球学堂页面，并在首页加入台球桌、球路和球号装饰。
- 榜首区域升级为情报卡，新增领先差距、净增积分、胜率、最近比赛和统治力条。
- UI 升级为更科技感的深色数据面板风格。
- 积分排行榜支持总榜和按日期查看历史排名快照。
- 比赛历史支持按日期切换查看。
- 比赛历史新增每日积分上升第一和下降第一。
- 排行榜前三名新增冠军、亚军、季军标识和对应视觉强调。

## 适用场景

适合：
- 球房内部积分榜
- 朋友局长期排名
- 小规模比赛练习积分系统

不适合：
- 复杂权限管理
- 大型赛事管理

## 后续可扩展方向

- 用户登录
- 管理员密码或录入权限
- 比分/局数录入
- 多赛季支持
- 图表统计
- 数据库后台管理页
