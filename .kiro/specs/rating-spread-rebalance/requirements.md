# Requirements Document

## Introduction

当前积分算法（`src/lib/rating.ts` 的 `calculateMatchDelta`）使用对称 Elo：胜方加多少分，负方就扣多少分（`loserDelta = -winnerDelta`），并对单场变化做 `[5, 160]` 区间夹紧。在长期运营中暴露出两个问题：

1. **非对称表达力缺失**：每场比赛 `winnerDelta + loserDelta = 0`，导致系统无法用积分表达「领先者持续兑现优势」与「领先者爆冷输球」的不同惩罚力度。
2. **分差无法拉开**：高分球员（领先 ≥ 400 分）即便每场都战胜低分对手，每次只加最低 5 分，扣 5 分，长期下来榜首和榜尾的分差停滞，无法反映真实统治力差距。

本特性重新设计胜负积分变化机制，允许 `winnerDelta + loserDelta ≠ 0`，并提高强者击败弱者时的下限，使榜首在多场比赛后能逐步拉开与榜尾的分差。由于排名一直是从 `matches` 表按时间顺序回放生成，算法升级后不需要单独迁移历史排名 —— 部署新代码、同步 D1 `settings.kFactor` 后，下一次拉取 `/api/state` 即按新算法重算所有历史记录的 `winnerDelta`、`loserDelta` 与最终积分。

## Glossary

- **Rating_Engine**：`src/lib/rating.ts` 中负责计算单场比赛积分变化的模块，对外暴露 `calculateMatchDelta`、`replayMatches`、`buildRankings`、`buildMatchTimeline` 等函数。
- **Match_Delta**：一场比赛产出的 `(winnerDelta, loserDelta)` 整数对，分别表示胜者加分和负者扣分（负值）。
- **Asymmetric_Delta**：`winnerDelta + loserDelta ≠ 0` 的 Match_Delta。
- **Heavy_Favorite_Win**：胜者赛前积分比败者高 400 分及以上的比赛。
- **Moderate_Favorite_Win**：胜者赛前积分比败者高 200 分至 400 分（不含 400）的比赛。
- **Even_Match**：胜负双方赛前积分相同（差值为 0）的比赛。
- **Upset_Win**：胜者赛前积分比败者低 200 分及以上的比赛。
- **Heavy_Upset_Win**：胜者赛前积分比败者低 400 分及以上的比赛。
- **Rating_Spread**：当前活跃球员中最高分与最低分的差值。
- **Algorithm_Page**：`/algorithm` 路由对应的算法说明页（`src/components/algorithm-view.tsx`）。
- **K_Factor_Setting**：D1 `settings` 表中 `key='kFactor'` 的配置值，由 Worker 通过 `/api/state` 暴露给客户端。
- **Match_History**：D1 `matches` 表中所有胜负记录的有序集合。
- **Replay_Pipeline**：`replayMatches`、`buildRankings`、`buildRankingsThroughLocalDay`、`buildMatchTimeline` 共同构成的从历史回放生成排名与时间线的链路。

## Requirements

### Requirement 1: 非对称积分变化

**User Story:** 作为系统维护者，我希望一场比赛的胜方加分和负方扣分可以不再绑定为相反数，以便系统能用积分表达「兑现优势」与「爆冷崩盘」两种不同情境。

#### Acceptance Criteria

1. THE Rating_Engine SHALL 为每场比赛分别计算 `winnerDelta` 与 `loserDelta`，不强制 `loserDelta = -winnerDelta` 的恒等关系。
2. WHEN 任意一场比赛被 Rating_Engine 处理, THE Rating_Engine SHALL 返回 `winnerDelta` 与 `loserDelta` 均为整数，且满足 `winnerDelta > 0` 与 `loserDelta ≤ 0`（即 `winnerDelta` 严格为正，`loserDelta` 允许等于 0）。
3. THE Rating_Engine SHALL 至少在一组 (winnerRating, loserRating) 输入下产出 `winnerDelta + loserDelta > 0` 的 Asymmetric_Delta，用以表达领先者兑现优势的情境。
4. THE Rating_Engine SHALL 至少在一组 (winnerRating, loserRating) 输入下产出 `winnerDelta + loserDelta < 0` 的 Asymmetric_Delta，用以表达爆冷压缩分差的情境。

### Requirement 2: 强者持续累积

**User Story:** 作为长期参赛者，我希望每场战胜分差较大的弱势对手时仍能拿到可见的积分增长，让排行榜能反映长期统治力，而不是停留在历史峰值。

#### Acceptance Criteria

1. WHEN Even_Match 发生, THE Rating_Engine SHALL 给胜者 `25 ≤ winnerDelta ≤ 40`。
2. WHEN Moderate_Favorite_Win 发生, THE Rating_Engine SHALL 给胜者 `15 ≤ winnerDelta ≤ 40`。
3. WHEN Heavy_Favorite_Win 发生, THE Rating_Engine SHALL 给胜者 `12 ≤ winnerDelta ≤ 40`。
4. THE Rating_Engine SHALL 在 K_Factor_Setting 不变的前提下保证 `winnerDelta` 关于「胜方赛前积分 - 负方赛前积分」单调不增（赛前差距越大，胜方加分不超过差距更小时的加分）。
5. WHEN Heavy_Favorite_Win 发生, THE Rating_Engine SHALL 产出满足 `winnerDelta + loserDelta > 0` 的 Asymmetric_Delta，使本场对 Rating_Spread 的贡献严格大于零（纯对称算法此贡献恒为零）。

### Requirement 3: 爆冷奖励保留

**User Story:** 作为弱势球员，我希望击败明显高于自己的对手时仍能获得显著的积分奖励，保持反败为胜的戏剧感。

#### Acceptance Criteria

1. WHEN Upset_Win 发生, THE Rating_Engine SHALL 给胜者 `50 ≤ winnerDelta ≤ 160`。
2. WHEN Heavy_Upset_Win 发生, THE Rating_Engine SHALL 给胜者 `80 ≤ winnerDelta ≤ 160`。
3. THE Rating_Engine SHALL 保证对任意一场 Upset_Win 比赛 A 与任意一场 Even_Match 比赛 B，A 中胜者的 `winnerDelta` 严格大于 B 中胜者的 `winnerDelta`。
4. THE Rating_Engine SHALL 把单场 `winnerDelta` 限制为 `winnerDelta ≤ 160`。

### Requirement 4: 非对称扣分上限

**User Story:** 作为不同段位的球员，我希望被「该输」的对手击败时只小幅掉分，被「该赢」的对手击败时显著掉分，让积分扣减反映期望落差。

#### Acceptance Criteria

1. THE Rating_Engine SHALL 把单场 `loserDelta` 限制为 `-160 ≤ loserDelta ≤ 0`。
2. WHEN Even_Match 中败方完成比赛, THE Rating_Engine SHALL 给败者 `-40 ≤ loserDelta ≤ -25`。
3. WHEN Heavy_Upset_Win 发生（败方赛前积分比胜方赛前积分高 400 分及以上）, THE Rating_Engine SHALL 给败者 `-160 ≤ loserDelta ≤ -40`。
4. WHEN Heavy_Favorite_Win 发生（败方赛前积分比胜方赛前积分低 400 分及以上）, THE Rating_Engine SHALL 给败者 `-10 ≤ loserDelta ≤ 0`。
5. THE Rating_Engine SHALL 保证 `loserDelta` 关于「败方赛前积分 - 胜方赛前积分」单调不增：对任意两场比赛 A 与 B，若 A 的「败方赛前积分 - 胜方赛前积分」严格小于 B 的对应差值，则 A 的 `loserDelta` 大于或等于 B 的 `loserDelta`。
6. WHEN Upset_Win 发生, THE Rating_Engine SHALL 给败者 `loserDelta ≤ -25`。

### Requirement 5: 历史回放确定性

**User Story:** 作为运维者，我希望同一份 Match_History 在新算法下回放任意次都能得到完全一致的排名和时间线，以便在新增、删除或修正比赛后排行榜稳定可信。

#### Acceptance Criteria

1. WHEN 给定相同的 `players` 列表、相同的 Match_History 与相同的 K_Factor_Setting, THE Rating_Engine SHALL 在每次调用中按相同顺序对每场比赛产出整数值完全相同的 `winnerDelta` 与 `loserDelta`。
2. THE Replay_Pipeline SHALL 按 `createdAt` 字符串升序逐场处理 Match_History，并在两场比赛 `createdAt` 相同时以 `MatchRecord.id` 字符串升序作为次级排序键。
3. IF Match_History 中某场比赛的 `winnerId` 或 `loserId` 不存在于 `players` 列表中, THEN THE Replay_Pipeline SHALL 跳过该场比赛但保留其余比赛原有的 `createdAt` 升序处理顺序，且不修改任何球员的赛前积分。
4. WHEN 一场历史比赛被新增、删除或修改, THE Replay_Pipeline SHALL 在下一次调用 `replayMatches`、`buildRankings`、`buildRankingsThroughLocalDay` 或 `buildMatchTimeline` 时使用当前 K_Factor_Setting 重新计算该比赛及其之后所有比赛的赛前积分、`winnerDelta` 与 `loserDelta`。
5. THE Rating_Engine SHALL 仅依赖「胜方赛前积分」「败方赛前积分」「K_Factor_Setting」三项输入计算 Match_Delta，不读取后续比赛、当前排名、系统时间或任何外部可变状态。

### Requirement 6: K 值与设置迁移

**User Story:** 作为部署者，我希望算法升级后线上 D1 的全局参数能与代码同步，避免线上排行榜继续按旧 K 值或旧公式计算。

#### Acceptance Criteria

1. WHERE 新算法引入或调整全局可调参数, THE `migrations` 目录 SHALL 包含一份新的迁移文件，把对应键值写入 `settings` 表或更新该表中已存在的同名键，使该迁移重复执行时不报错，且最终 `settings` 表中该键的值等于该迁移声明的值。
2. THE `DEFAULT_K_FACTOR` 常量 SHALL 与 `migrations` 目录中最新一份涉及 `kFactor` 的迁移写入的整数值严格相等。
3. WHEN Rating_Engine 被调用且 `kFactor` 参数为 `undefined` 或未提供, THE Rating_Engine SHALL 使用 `DEFAULT_K_FACTOR` 作为缺省值进行计算。
4. WHEN Rating_Engine 收到 K_Factor_Setting 作为显式 `kFactor` 参数, THE Rating_Engine SHALL 使用该参数值（而非 `DEFAULT_K_FACTOR`）执行本次计算。

### Requirement 7: 算法说明页同步

**User Story:** 作为查看 `/algorithm` 页面的用户，我希望该页面显示的公式、示例和说明文字与实际生效的算法保持一致，便于理解每场比赛的积分变化。

#### Acceptance Criteria

1. THE Algorithm_Page SHALL 分别独立展示胜方 `winnerDelta` 计算公式块与败方 `loserDelta` 计算公式块，且两公式中所引用的 K_Factor_Setting 与单场上下限常量与 Rating_Engine 当前实现完全一致。
2. THE Algorithm_Page SHALL 展示三个示例（一个 Even_Match、一个 Heavy_Favorite_Win、一个 Heavy_Upset_Win），每个示例均同时列出胜方赛前积分、败方赛前积分、`winnerDelta`、`loserDelta` 四项整数值，且这四项数值与 Rating_Engine 在相同赛前积分对作为输入时的计算结果整数级完全相等。
3. THE Algorithm_Page SHALL 在说明文案中包含「`winnerDelta + loserDelta` 不再恒为零」的非对称设计声明，并解释 Heavy_Favorite_Win 累计会拉大 Rating_Spread、Heavy_Upset_Win 累计会压缩 Rating_Spread。
4. THE Algorithm_Page SHALL 同屏显示当前生效的 K_Factor_Setting 数值（与 Rating_Engine 计算时实际使用的 K 值相同），以及 Even_Match 胜方加分区间（25 至 40）、Even_Match 败方扣分区间（−40 至 −25）、Heavy_Favorite_Win 胜方下限（≥ 12）、Heavy_Upset_Win 胜方下限（≥ 80）、单场 `winnerDelta` 上限（160）、单场 `loserDelta` 取值范围（−160 至 0）。

### Requirement 8: 测试覆盖

**User Story:** 作为开发者，我希望算法变更后已有测试集仍能覆盖新公式，并对关键边界提供回归保障。

#### Acceptance Criteria

1. THE `src/lib/rating.test.ts` SHALL 包含一个 Even_Match 用例（胜方赛前积分 1500、败方赛前积分 1500），验证 `25 ≤ winnerDelta ≤ 40` 且 `-40 ≤ loserDelta ≤ -25`。
2. THE `src/lib/rating.test.ts` SHALL 包含一个 Heavy_Favorite_Win 用例（胜方赛前积分 1900、败方赛前积分 1500），验证 `winnerDelta ≥ 12`、`loserDelta ≥ -10` 且 `winnerDelta + loserDelta > 0`。
3. THE `src/lib/rating.test.ts` SHALL 包含一个 Upset_Win 用例（胜方赛前积分 1300、败方赛前积分 1500），验证 `winnerDelta ≥ 50` 且 `winnerDelta ≤ 160`。
4. THE `src/lib/rating.test.ts` SHALL 包含一个 Heavy_Upset_Win 用例（胜方赛前积分 1100、败方赛前积分 1500），验证 `-160 ≤ loserDelta ≤ -40`。
5. THE `src/lib/rating.test.ts` SHALL 包含一个回放确定性用例，使用至少 3 场比赛的 Match_History 连续两次调用 `buildRankings`，验证两次调用结果在以下三项上完全相等：排名顺序、每位球员的最终积分、每场比赛的 `winnerDelta` 与 `loserDelta`。
6. THE `src/lib/rating.test.ts` SHALL 包含一个单调性用例，固定败方赛前积分并使用至少 5 个严格递增的胜方赛前积分对同一败方进行计算，验证对任意下标 `i < j` 满足 `winnerDelta[i] ≥ winnerDelta[j]`。

### Requirement 9: 比赛记录向后兼容

**User Story:** 作为现有数据持有者，我希望旧比赛记录无需修改即可被新算法重新回放，不需要补录任何额外字段。

#### Acceptance Criteria

1. THE Rating_Engine SHALL 仅依赖 `MatchRecord` 已有字段（`id`、`winnerId`、`loserId`、`createdAt`、`winnerMoments`、`loserMoments`、`winnerNote`、`loserNote`）执行计算。
2. THE `migrations` 目录 SHALL 不包含针对 `matches` 表结构的列新增、列删除或列类型/约束修改变更。
3. WHEN 现有 D1 数据库被升级后的 Worker 读取, THE `/api/state` 端点 SHALL 返回同时包含 `players`、`matches`、`photos`、`aiProfiles`、`aiReviews`、`aiModels`、`settings` 七个字段的完整 `AppState`，且不返回 HTTP 500 或其他 5xx 状态码。
4. IF 历史 `matches` 行中 `winnerMoments`、`loserMoments` 为 NULL 或空数组、或 `winnerNote`、`loserNote` 为 NULL 或空字符串, THEN THE Rating_Engine SHALL 将上述字段分别归一化为空数组或空字符串后再交给 Replay_Pipeline，使同一份 Match_History 在多次回放中产出完全一致的 `winnerDelta` 与 `loserDelta` 序列。

### Requirement 10: 文档同步

**User Story:** 作为协作开发者，我希望算法变更被记录在 `CHANGELOG.md` 与 `README.md` 中，方便追溯历次调参。

#### Acceptance Criteria

1. THE `CHANGELOG.md` SHALL 在 `Unreleased` 段新增一条条目，明确列出以下内容：非对称积分设计声明（`winnerDelta + loserDelta` 可不为 0）、Even_Match 胜方加分区间 25 至 40、Even_Match 败方扣分区间 -40 至 -25、Heavy_Favorite_Win 胜方加分下限 12、Heavy_Favorite_Win 败方扣分区间 -10 至 0、Upset_Win 胜方加分下限 50、Heavy_Upset_Win 胜方加分下限 80、Heavy_Upset_Win 败方扣分上限 -40、单场 `winnerDelta` 上限 160 与单场 `loserDelta` 下限 -160。
2. WHERE `README.md` 包含算法说明段落, THE `README.md` SHALL 在该段落中分别列出胜方公式描述与败方公式描述，并写入与 Rating_Engine 当前实现一致的上述全部数值阈值。
3. THE `CHANGELOG.md` SHALL 在同一 `Unreleased` 条目中注明：历史比赛由 Replay_Pipeline 按 `createdAt` 升序自动按新算法回放，部署新代码并同步 `kFactor` 设置后下一次 `/api/state` 调用即按新公式重算所有 `matches` 记录，不需要手动迁移历史排名或修改 `matches` 表数据。
