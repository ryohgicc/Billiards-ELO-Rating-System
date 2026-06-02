const evenExampleRows = [
  { label: "赛前积分 / K 因子", playerA: "A：1500 / 100", playerB: "B：1500 / 100" },
  { label: "胜方加分（A）", playerA: "+50", playerB: "—" },
  { label: "败方扣分（B）", playerA: "—", playerB: "−25" },
  { label: "本场净变化", playerA: "+25", playerB: "" },
  { label: "赛后积分", playerA: "1550", playerB: "1475" },
];

const heavyFavoriteExampleRows = [
  { label: "赛前积分 / K 因子", playerA: "A：1900 / 100", playerB: "B：1500 / 100" },
  { label: "胜方加分（A）", playerA: "+9", playerB: "—" },
  { label: "败方扣分（B）", playerA: "—", playerB: "−5" },
  { label: "本场净变化", playerA: "+4", playerB: "" },
  { label: "赛后积分", playerA: "1909", playerB: "1495" },
];

const heavyUpsetExampleRows = [
  { label: "赛前积分 / K 因子", playerA: "A：1100 / 100", playerB: "B：1500 / 100" },
  { label: "胜方加分（A）", playerA: "+91", playerB: "—" },
  { label: "败方扣分（B）", playerA: "—", playerB: "−45" },
  { label: "本场净变化", playerA: "+46", playerB: "" },
  { label: "赛后积分", playerA: "1191", playerB: "1455" },
];

const tierRows = [
  { tier: "新人段（< 10 场）", k: 150, note: "每月前 10 场用更大步长，让赛季初快速归位" },
  { tier: "中段（10 至 30 场）", k: 100, note: "本月默认 K 值，适合大多数对局" },
  { tier: "稳定段（≥ 30 场）", k: 50, note: "当月成熟样本后降低波动，减少偶发结果扰动" },
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
          <span className="section-note">每月初始分 1000 / 默认 K 值 100 / 败方扣分 50%</span>
        </div>

        <div className="algorithm-copy">
          <p>
            这个系统按自然月拆分赛季，每个赛季都从 1000 分重新开始。每场比赛只记录胜者和负者，
            胜方与败方都按自己的赛前积分、对手赛前积分和自己的 K 值计算，败方扣分会再乘 50% 缓冲系数，
            所以本场变化不强制守恒。
          </p>
          <p>
            算法借鉴 FIDE 国际象棋分级 K 因子的思路：每位球员根据本月已完成的比赛总场数分别使用
            不同的 K 值，新人变化大、稳定老手变化小。胜负双方各自查自己的 K 值，互不干扰。
          </p>
          <p>
            高分球员稳定击败低分球员时，只拿较小收益，低分败方也只小幅扣分；低分球员爆冷击败高分球员时，
            胜方按 Elo 期望差拿到更大奖励，高分败方也会按自己的 K 值承受更高扣分。单场不再封顶，实际变化完全由双方分差和各自 K 值决定。
          </p>
          <p>
            系统不会只保存最终积分，而是保存完整比赛历史。新增、修改或删除比赛后，会在对应自然月内
            按时间顺序重新回放比赛，并保留每个月最后一个比赛日的月末归档榜。
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
          <span className="section-note">胜方标准 Elo 奖励 / 败方半额扣分</span>
        </div>

        <div className="formula-grid">
          <div className="formula-card">
            <span>单人预期胜率</span>
            <code>E_player = 1 / (1 + 10 ^ ((对手分 − 自己分) / 400))</code>
          </div>
          <div className="formula-card">
            <span>单人积分变化</span>
            <code>胜方：round(自己的K × (1 − E_player))；败方：round(自己的K × (0 − E_player) × 0.5)</code>
          </div>
          <div className="formula-card">
            <span>胜方加分</span>
            <code>winnerDelta = round(胜方K × (1 − E_winner))</code>
          </div>
          <div className="formula-card">
            <span>败方扣分</span>
            <code>loserDelta = round(败方K × (0 − E_loser) × 0.5)，弱输强少扣，强输弱多扣</code>
          </div>
          <div className="formula-card">
            <span>K 值分段</span>
            <code>本月已赛 &lt; 10：K=150；10-29：K=100；≥30：K=50</code>
          </div>
          <div className="formula-card">
            <span>月赛季</span>
            <code>每个自然月独立回放，赛季初积分、战绩、成就、规则称号都从零开始</code>
          </div>
          <div className="formula-card">
            <span>单场限制</span>
            <code>不设 ±160 封顶；极端强弱局可能四舍五入为 0 分变化</code>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Example 1</p>
            <h2>同分对局：A 1500 vs B 1500</h2>
          </div>
          <span className="section-note">A 胜 B（双方均为中段 K=100）</span>
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
          双方 K 值相同且预期胜率都是 50%，胜方按标准 Elo +50，败方半额扣 −25。新人 K=150 时同样情景为 +75/−38；
          稳定 K=50 时为 +25/−13。
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Example 2</p>
            <h2>强者赢弱者：A 1900 vs B 1500</h2>
          </div>
          <span className="section-note">A 胜 B，分差 +400（双方均为中段 K=100）</span>
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
          强者本来就该赢，预期胜率约 91%，因此只拿 +9；弱方从自己的视角预期胜率约 9%，输球半额后只扣 −5。
          这种对局不会因为没有封顶而额外放大。
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Example 3</p>
            <h2>低分爆冷：A 1100 vs B 1500</h2>
          </div>
          <span className="section-note">A 胜 B，分差 −400（双方均为中段 K=100）</span>
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
          低分方预期胜率约 9%，赢下高分方后获得 +91；高分方从自己的视角预期胜率约 91%，输给弱方半额后扣 −45。
          如果双方 K 值不同，加扣分会按各自 K 值比例自然拉开。
        </p>
      </section>
    </div>
  );
}
