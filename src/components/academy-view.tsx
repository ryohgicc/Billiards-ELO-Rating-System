import { Brain, Crosshair, ShieldCheck, Sparkles } from "lucide-react";

const ruleCards = [
  {
    title: "开球",
    label: "Break",
    body: "先确认球型和开球规则。8 球常见玩法里，合法开球通常要求有球入袋，或至少多颗目标球碰库。",
  },
  {
    title: "自由球",
    label: "Ball in hand",
    body: "对手犯规后，先规划整局路线，再放母球。不要只看当前最容易进的球。",
  },
  {
    title: "8 球黑球",
    label: "Eight ball",
    body: "黑八不是越早处理越好。清完自己球组后，给黑八留一个稳定角度，比强行走位更重要。",
  },
  {
    title: "安全球",
    label: "Safety",
    body: "没有高把握进攻时，把母球藏到障碍后面，或让对手只剩远台薄球，是非常有效的得分方式。",
  },
];

const drills = [
  "直线球 10 连击：同一线路重复出杆，观察母球是否偏线。",
  "三颗球清台：只摆 3 颗目标球，要求每一杆都给下一颗留下自然角度。",
  "停球练习：中杆击打近距离直球，让母球尽量停在原点附近。",
  "两库走位：练习用一颗目标球把母球带到下一颗球的进攻区。",
];

const tips = [
  { icon: Crosshair, title: "瞄准", body: "先站在线后再趴下，不要趴下后再扭身体找线。" },
  { icon: Sparkles, title: "出杆", body: "节奏比力量重要。后摆稳定、前送完整，母球才会听话。" },
  { icon: ShieldCheck, title: "控局", body: "领先时少打高风险球，落后时优先制造对手失误。" },
  { icon: Brain, title: "思路", body: "每杆至少想两步：当前球怎么进，母球下一站去哪。" },
];

export function AcademyView() {
  return (
    <div className="stack">
      <section className="panel academy-hero">
        <div>
          <p className="eyebrow">Pool Academy</p>
          <h2>台球学堂</h2>
          <p>
            规则、技巧、训练和比赛心法放在一个快速扫读的面板里。上场前看一眼，少一点随手打，多一点主动控制。
          </p>
        </div>
        <div className="academy-hero__cue" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Rules</p>
            <h2>规则速查</h2>
          </div>
          <span className="section-note">常见争议点</span>
        </div>

        <div className="academy-grid">
          {ruleCards.map((card) => (
            <article key={card.title} className="academy-card">
              <span>{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel academy-split">
        <div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Drills</p>
              <h2>训练小课</h2>
            </div>
          </div>
          <ol className="academy-list">
            {drills.map((drill) => (
              <li key={drill}>{drill}</li>
            ))}
          </ol>
        </div>

        <div className="academy-daily">
          <p className="eyebrow">Today&apos;s Tip</p>
          <h3>低杆不是越低越好</h3>
          <p>
            稳定击点比刻意压低球杆更重要。先保证杆头穿过母球中心线，再逐步增加低杆量。
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Tactics</p>
            <h2>实战技巧</h2>
          </div>
          <span className="section-note">先控局，再进攻</span>
        </div>

        <div className="academy-tip-grid">
          {tips.map((tip) => {
            const Icon = tip.icon;

            return (
              <article key={tip.title} className="academy-tip">
                <Icon aria-hidden="true" size={19} />
                <div>
                  <h3>{tip.title}</h3>
                  <p>{tip.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
