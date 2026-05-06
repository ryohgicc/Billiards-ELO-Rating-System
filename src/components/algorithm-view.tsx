const exampleRows = [
  { label: "赛前积分", playerA: "A：1000", playerB: "B：1000" },
  { label: "预期胜率", playerA: "50%", playerB: "50%" },
  { label: "A 获胜后变化", playerA: "+50", playerB: "-50" },
  { label: "赛后积分", playerA: "1050", playerB: "950" },
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
          <span className="section-note">初始分 1000 / K 值 100</span>
        </div>

        <div className="algorithm-copy">
          <p>
            这个系统使用 Elo 评分来计算台球排名。每位新球员从 1000 分开始，每场比赛只记录胜者和负者。
            胜者加分，负者扣分；如果低分球员击败高分球员，会触发爆冷倍率，获得更多积分。
          </p>
          <p>
            系统不会只保存最终积分，而是保存完整比赛历史。新增或删除比赛后，会按时间顺序重新回放所有比赛，
            所以误删或修正记录后，排行榜仍然能保持一致。
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Formula</p>
            <h2>计算公式</h2>
          </div>
        </div>

        <div className="formula-grid">
          <div className="formula-card">
            <span>预期胜率</span>
            <code>E = 1 / (1 + 10 ^ ((对手分 - 自己分) / 400))</code>
          </div>
          <div className="formula-card">
            <span>积分变化</span>
            <code>基础变化值 = K × (实际结果 - 预期胜率)</code>
          </div>
          <div className="formula-card">
            <span>爆冷倍率</span>
            <code>1 + min(1.2, 0.75 × (分差 / 400) ^ 1.15)</code>
          </div>
          <div className="formula-card">
            <span>最终变化</span>
            <code>round(min(160, max(5, 基础变化值 × 爆冷倍率)))</code>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Example</p>
            <h2>例子：两位同分球员比赛</h2>
          </div>
          <span className="section-note">A 胜 B</span>
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
              {exampleRows.map((row) => (
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
          因为双方赛前都是 1000 分，系统认为两人胜率相同。A 获胜后得到 50 分，B 扣 50 分。
          如果 A 原本明显更高分，A 获胜会加得更少；如果 B 是低分反胜高分，会按爆冷倍率加得更多，单场最多变化 160 分。
        </p>
      </section>
    </div>
  );
}
