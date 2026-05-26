const evenExampleRows = [
  { label: "赛前积分", playerA: "A：1500", playerB: "B：1500" },
  { label: "胜方加分（A）", playerA: "+30", playerB: "—" },
  { label: "败方扣分（B）", playerA: "—", playerB: "−30" },
  { label: "赛后积分", playerA: "1530", playerB: "1470" },
];

const heavyFavoriteExampleRows = [
  { label: "赛前积分", playerA: "A：1900", playerB: "B：1500" },
  { label: "胜方加分（A）", playerA: "+12", playerB: "—" },
  { label: "败方扣分（B）", playerA: "—", playerB: "−5" },
  { label: "本场净拉开分差", playerA: "+7", playerB: "" },
  { label: "赛后积分", playerA: "1912", playerB: "1495" },
];

const heavyUpsetExampleRows = [
  { label: "赛前积分", playerA: "A：1100", playerB: "B：1500" },
  { label: "胜方加分（A）", playerA: "+95", playerB: "—" },
  { label: "败方扣分（B）", playerA: "—", playerB: "−109" },
  { label: "本场净压缩分差", playerA: "−14", playerB: "" },
  { label: "赛后积分", playerA: "1195", playerB: "1391" },
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
          <span className="section-note">初始分 1000 / K 值 60 / 单场封顶 ±160</span>
        </div>

        <div className="algorithm-copy">
          <p>
            这个系统使用非对称 Elo 评分来计算台球排名。每位新球员从 1000 分开始，每场比赛只记录胜者和负者。
            胜方加分公式与败方扣分公式分别独立计算，<code>winnerDelta + loserDelta</code> 不再恒为零。
          </p>
          <p>
            高分球员稳定击败低分球员时，胜方仍能拿到至少 12 分增长，但败方只扣 0 到 10 分，
            本场的净分差贡献为正，长期累积会持续拉开榜首与榜尾的差距；反之，低分球员爆冷击败高分球员时，
            胜方至少加 50 分（分差 ≥ 400 时至少加 80 分），败方则会被加重惩罚，本场净分差贡献为负，
            用以快速压缩榜单上的虚高积分。
          </p>
          <p>
            系统不会只保存最终积分，而是保存完整比赛历史。新增、修改或删除比赛后，会按时间顺序重新回放所有比赛，
            所以误删或修正记录后排行榜仍然能保持一致。
          </p>
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
            <code>winnerDelta = max(12, 30 − 差距 × 0.045)</code>
          </div>
          <div className="formula-card">
            <span>败方扣分（强者赢，差距 ≥ 0）</span>
            <code>loserDelta = clamp(−K × (1 − E_winner), −40, −3)</code>
          </div>
          <div className="formula-card">
            <span>胜方加分（爆冷，差距 &lt; 0）</span>
            <code>
              winnerDelta = K × (1 − E_winner) × (1 + min(1.2, 0.75 × (分差 / 400) ^ 1.15))
              ；分差 ≥ 200 时下限 50；分差 ≥ 400 时下限 80
            </code>
          </div>
          <div className="formula-card">
            <span>败方扣分（爆冷，差距 &lt; 0）</span>
            <code>
              loserDelta = −K × (1 − E_winner) × (1 + min(1.5, (分差 / 400) ^ 1.15))
              ；分差 ≥ 200 时上限 −25；分差 ≥ 400 时上限 −40
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
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Example 2</p>
            <h2>强者赢弱者：A 1900 vs B 1500</h2>
          </div>
          <span className="section-note">A 胜 B，分差 +400</span>
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
          胜方仍获得 +12 的兜底增长，败方只扣 5 分，单场净 +7 分。10 场这样的统治级胜利累积会让榜首额外
          抬升约 70 分，让分差能持续被拉开。
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Example 3</p>
            <h2>低分爆冷：A 1100 vs B 1500</h2>
          </div>
          <span className="section-note">A 胜 B，分差 −400</span>
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
          爆冷胜方拿满 +95 分，败方扣 −109 分，单场净 −14 分对榜单整体起到压缩作用。
          单场最大变化封顶 ±160，避免极端比赛把榜单完全打散。
        </p>
      </section>
    </div>
  );
}
