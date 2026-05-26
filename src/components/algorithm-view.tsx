const evenExampleRows = [
  { label: "赛前积分 / K 因子", playerA: "A：1500 / 60", playerB: "B：1500 / 60" },
  { label: "胜方加分（A）", playerA: "+25", playerB: "—" },
  { label: "败方扣分（B）", playerA: "—", playerB: "−15" },
  { label: "本场净拉开分差", playerA: "+10", playerB: "" },
  { label: "赛后积分", playerA: "1525", playerB: "1485" },
];

const heavyFavoriteExampleRows = [
  { label: "赛前积分 / K 因子", playerA: "A：1900 / 60", playerB: "B：1500 / 60" },
  { label: "胜方加分（A）", playerA: "+12", playerB: "—" },
  { label: "败方扣分（B）", playerA: "—", playerB: "−3" },
  { label: "本场净拉开分差", playerA: "+9", playerB: "" },
  { label: "赛后积分", playerA: "1912", playerB: "1497" },
];

const heavyUpsetExampleRows = [
  { label: "赛前积分 / K 因子", playerA: "A：1100 / 60", playerB: "B：1500 / 60" },
  { label: "胜方加分（A）", playerA: "+82", playerB: "—" },
  { label: "败方扣分（B）", playerA: "—", playerB: "−82" },
  { label: "本场净分差变化", playerA: "0", playerB: "" },
  { label: "赛后积分", playerA: "1182", playerB: "1418" },
];

const tierRows = [
  { tier: "新人段（< 10 场）", k: 80, note: "前 10 场用更大步长，让水平快速被准确捕捉" },
  { tier: "中段（10 至 30 场）", k: 60, note: "默认 K 值，适合大多数对局" },
  { tier: "稳定段（≥ 30 场）", k: 40, note: "成熟选手的积分变化更细腻，避免被偶发结果带飞" },
];

export function AlgorithmView() {
  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Rating Model</p>
            <h2>Elo 积分算法</h2>
          </div>
          <span className="section-note">初始分 1000 / 默认 K 值 60 / 单场封顶 ±160</span>
        </div>

        <div className="algorithm-copy">
          <p>
            这个系统使用非对称 Elo 评分配合分段 K 因子来计算台球排名。每位新球员从 1000 分开始，
            每场比赛只记录胜者和负者，胜方加分公式与败方扣分公式分别独立计算，
            <code>winnerDelta + loserDelta</code> 不再恒为零。
          </p>
          <p>
            算法借鉴 FIDE 国际象棋分级 K 因子的思路：每位球员根据已完成的比赛总场数分别使用
            不同的 K 值，新人变化大、稳定老手变化小。胜负双方各自查自己的 K 值，互不干扰。
          </p>
          <p>
            高分球员稳定击败低分球员时，胜方仍能拿到至少 12 分增长，败方只扣 3 到 10 分，
            本场净拉开分差；反之，低分球员爆冷击败高分球员时，胜方至少加 50 分（分差 ≥ 400 时至少加 80 分），
            败方扣分被约束在「不超过胜方加分」之内，避免高分球员被一次失利过度惩罚。
          </p>
          <p>
            系统不会只保存最终积分，而是保存完整比赛历史。新增、修改或删除比赛后，会按时间顺序
            重新回放所有比赛，每场重新计算双方当时的赛前 K 值，所以排行榜永远和算法保持同步。
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Tier K Factor</p>
            <h2>分段 K 因子</h2>
          </div>
          <span className="section-note">按比赛总场数自动选择</span>
        </div>

        <div className="example-table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>段位</th>
                <th>K 值</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {tierRows.map((row) => (
                <tr key={row.tier}>
                  <td>{row.tier}</td>
                  <td>{row.k}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Formula</p>
            <h2>计算公式</h2>
          </div>
          <span className="section-note">胜方与败方独立计算</span>
        </div>

        <div className="formula-grid">
          <div className="formula-card">
            <span>预期胜率</span>
            <code>E_winner = 1 / (1 + 10 ^ ((败方分 − 胜方分) / 400))</code>
          </div>
          <div className="formula-card">
            <span>胜方加分（强者赢，差距 ≥ 0）</span>
            <code>winnerDelta = max(12, max(12.5, 25 − 差距 × 0.0325) × 胜方K / 60)</code>
          </div>
          <div className="formula-card">
            <span>败方扣分（强者赢，差距 ≥ 0）</span>
            <code>loserDelta = clamp(−败方K × (1 − E_winner) × 0.5, −18, −3)</code>
          </div>
          <div className="formula-card">
            <span>胜方加分（爆冷，差距 &lt; 0）</span>
            <code>
              winnerDelta = 胜方K × (1 − E_winner) × (1 + min(0.6, 0.5 × (分差 / 400) ^ 1.15))
              ；分差 ≥ 200 时下限 50，分差 ≥ 400 时下限 80
            </code>
          </div>
          <div className="formula-card">
            <span>败方扣分（爆冷，差距 &lt; 0）</span>
            <code>
              loserDelta = max(−winnerDelta, −败方K × (1 − E_winner) × (1 + min(0.6, 0.5 × (分差 / 400) ^ 1.15)))
              ；分差 ≥ 200 时上限 −25，分差 ≥ 400 时上限 −40
            </code>
          </div>
          <div className="formula-card">
            <span>单场封顶</span>
            <code>winnerDelta ∈ [1, 160]，loserDelta ∈ [−160, 0]，输出取整</code>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Example 1</p>
            <h2>同分对局：A 1500 vs B 1500</h2>
          </div>
          <span className="section-note">A 胜 B（双方均为中段 K=60）</span>
        </div>

        <div className="example-table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>步骤</th>
                <th>球员 A</th>
                <th>球员 B</th>
              </tr>
            </thead>
            <tbody>
              {evenExampleRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.playerA}</td>
                  <td>{row.playerB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="algorithm-note">
          胜方加 25、败方仅扣 15，本场净 +10 分。同分对局赢得的奖励比输掉的代价更大，
          形成「赢得开心、输得体面」的正反馈。新人 K=80 时同样情景胜方拿到 +33；
          稳定 K=40 时胜方仅 +17 分，避免老手被偶发结果带飞。
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Example 2</p>
            <h2>强者赢弱者：A 1900 vs B 1500</h2>
          </div>
          <span className="section-note">A 胜 B，分差 +400（双方均为中段 K=60）</span>
        </div>

        <div className="example-table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>步骤</th>
                <th>球员 A</th>
                <th>球员 B</th>
              </tr>
            </thead>
            <tbody>
              {heavyFavoriteExampleRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.playerA}</td>
                  <td>{row.playerB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="algorithm-note">
          胜方仍获得 +12 的兜底增长，败方只扣 3 分（几乎免罚），本场净 +9 分。
          这种统治级胜利累积起来会缓慢拉开分差，但不会让弱方被反复轰炸。
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Example 3</p>
            <h2>低分爆冷：A 1100 vs B 1500</h2>
          </div>
          <span className="section-note">A 胜 B，分差 −400（双方均为中段 K=60）</span>
        </div>

        <div className="example-table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>步骤</th>
                <th>球员 A</th>
                <th>球员 B</th>
              </tr>
            </thead>
            <tbody>
              {heavyUpsetExampleRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.playerA}</td>
                  <td>{row.playerB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="algorithm-note">
          爆冷胜方拿满 +82 分，败方扣 −82 分（受「不超过胜方加分」约束）。
          单场最大变化封顶 ±160，避免极端比赛把榜单完全打散。
        </p>
      </section>
    </div>
  );
}
