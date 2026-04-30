import { Brain, Clock, Crosshair, Route, ShieldCheck, Sparkles, Target } from "lucide-react";

const ruleCards = [
  {
    title: "8 球基础流程",
    label: "Eight ball",
    body: "开球后确认球组，先清完自己的全色或花色，最后合法打进黑八。黑八提前入袋通常判负。",
  },
  {
    title: "常见犯规",
    label: "Foul",
    body: "母球落袋、先碰错球、没有球碰库、双击推杆、身体碰球，都可能给对手自由球。",
  },
  {
    title: "自由球怎么用",
    label: "Ball in hand",
    body: "别只找最容易进的一颗。先看整局线路，把母球放到能连续处理 2 到 3 颗球的位置。",
  },
  {
    title: "黑八争议",
    label: "Final ball",
    body: "打黑八前先确认袋口。多数规则里，黑八进错袋、母球同时落袋、先碰错球都可能判负。",
  },
  {
    title: "9 球简明规则",
    label: "Nine ball",
    body: "每杆必须先碰台面最小号码球，但任意球入袋都算。合法打进 9 号球即可赢下该局。",
  },
  {
    title: "安全球",
    label: "Safety",
    body: "没有高把握进攻时，把母球藏住或让对手只剩远台薄球，往往比硬拼更能赢局。",
  },
];

const drills = [
  {
    title: "新手 15 分钟",
    items: ["直线球 10 连击", "中杆停球 10 次", "近台薄球左右各 5 次"],
  },
  {
    title: "进阶 30 分钟",
    items: ["三颗球清台 5 组", "高杆跟进到指定区域", "低杆拉回一颗球距离"],
  },
  {
    title: "比赛前热身",
    items: ["5 分钟空杆节奏", "3 颗简单球找手感", "练 3 次开球控制母球"],
  },
  {
    title: "失误复盘",
    items: ["是瞄错还是出杆歪", "是力度错还是路线错", "下一次是否该打安全球"],
  },
];

const tips = [
  { icon: Crosshair, title: "瞄准线", body: "先站到进球线后再趴下。趴下后大幅扭身体，通常说明站位已经错了。" },
  { icon: Sparkles, title: "出杆节奏", body: "后摆慢、停顿短、前送完整。节奏稳定，比突然发力更容易打准。" },
  { icon: Target, title: "高杆 / 中杆 / 低杆", body: "先练中杆稳定，再加高低杆。杆法是走位工具，不是炫技动作。" },
  { icon: Route, title: "薄球处理", body: "薄球更怕发力过猛。降低速度，优先保证目标球路线和母球安全位置。" },
  { icon: ShieldCheck, title: "安全球", body: "把母球放到障碍后，或让对手只剩长台低成功率进攻，就是主动得分。" },
  { icon: Brain, title: "比赛心法", body: "领先时减少风险，落后时制造复杂局面。不确定时先别送简单机会。" },
];

const positionCards = [
  "顺势走位：能自然滚到下一颗，就别强行拉杆或大力变线。",
  "留厚不留薄：下一颗球留厚一点，容错率通常比极限角度更高。",
  "控制母球区域：不要只追一个点，给自己留一片可接受进攻区。",
  "清障碍球：早处理贴库、被挡、角度怪的球，别拖到最后。",
];

export function AcademyView() {
  return (
    <div className="stack">
      <section className="panel academy-hero">
        <div>
          <p className="eyebrow">Pool Academy</p>
          <h2>台球学堂</h2>
          <p>
            规则、技巧、走位、训练和比赛心法都放在一个快速扫读的内容库里。上场前看一眼，少一点随手打，多一点主动控制。
          </p>
          <div className="academy-hero__stats">
            <span>6 条规则</span>
            <span>6 个技巧</span>
            <span>4 套训练</span>
          </div>
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
              <li key={drill.title}>
                <strong>{drill.title}</strong>
                <span>{drill.items.join(" / ")}</span>
              </li>
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
            <p className="eyebrow">Position Play</p>
            <h2>走位思路</h2>
          </div>
          <span className="section-note">让下一杆变简单</span>
        </div>

        <div className="academy-position-grid">
          {positionCards.map((card) => (
            <article key={card} className="academy-position-card">
              <Clock aria-hidden="true" size={18} />
              <p>{card}</p>
            </article>
          ))}
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
