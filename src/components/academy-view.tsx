import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  Crosshair,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

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
    body: "打黑八前先确认袋口、先碰目标球、母球不能落袋。黑八提前进、进错袋、打黑八犯规，通常都按严重犯规或直接负局处理。",
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

const disputeCards = [
  {
    title: "开球进黑八",
    ruling: "赛前要约定重开、胜局或摆回黑八继续。民间局最建议重开，减少吵架。",
    note: "如果同时母球落袋，通常不能算胜局。",
  },
  {
    title: "开球有球进袋",
    ruling: "不要急着定组。常见处理是继续击球，等非开球杆合法进球后再确认全色或花色。",
    note: "也有场地按开球进什么就选什么，必须赛前说清。",
  },
  {
    title: "球组还没确认",
    ruling: "未定组时先碰任意非黑八目标球都可，合法进球后确定球组；直接碰黑八一般不算合法选择。",
    note: "如果一杆同时进全色和花色，通常由击球方选择球组。",
  },
  {
    title: "黑八提前进",
    ruling: "自己的目标球还没清完就打进黑八，多数规则直接判负。",
    note: "无论是故意、误进还是连带进，都应按同一口径处理。",
  },
  {
    title: "黑八进错袋",
    ruling: "采用指定袋规则时，黑八进了非指定袋通常判负；不指定袋玩法则按赛前约定。",
    note: "打黑八前最好口头报袋，尤其是组合、翻袋、传球。",
  },
  {
    title: "黑八和母球同落",
    ruling: "即使黑八进了指定袋，母球同时落袋也通常判负。",
    note: "黑八局最常见争议之一，建议默认从严。",
  },
  {
    title: "犯规后能否打黑八",
    ruling: "如果自己目标球已清完，获得自由球后可以摆母球打黑八；仍要先合法碰黑八并按约定入袋。",
    note: "如果目标球没清完，不能借自由球直接打黑八赢局。",
  },
  {
    title: "没有球碰库",
    ruling: "母球先合法碰到目标球后，若没有任何球进袋，也没有任何球碰库，通常判犯规。",
    note: "轻贴、轻推、防守球都要注意这一条。",
  },
  {
    title: "先碰错球",
    ruling: "母球第一碰不是自己的目标球，通常犯规；打黑八阶段第一碰必须是黑八。",
    note: "传球、借球、组合球也看母球第一碰。",
  },
  {
    title: "贴库球争议",
    ruling: "目标球贴库时，击打后通常需要有球进袋，或母球/目标球/其他球再次碰库才算合法。",
    note: "开打前先声明“这颗贴库”，双方确认会省很多事。",
  },
  {
    title: "推杆、连击、二次触球",
    ruling: "杆头长时间推着母球、近距离连续碰母球，通常判犯规。",
    note: "母球和目标球距离很近时，抬高杆尾或薄切更安全。",
  },
  {
    title: "身体或衣物碰球",
    ruling: "手、衣服、球杆非杆头部分碰到台面上的球，通常犯规；是否复位由双方按赛前规则处理。",
    note: "移动球后先停下来确认，别继续出杆扩大争议。",
  },
];

const disputePrinciples = [
  "先看赛前约定，再看场地规则；没有约定时，按更常见、更容易执行的口径处理。",
  "争议发生时先暂停，不要补杆；双方确认球位和事实后再继续。",
  "只争事实，不争情绪：第一碰哪颗、有没有进袋、有没有碰库、母球是否落袋。",
  "无法确认就重摆或重打该局，比带着不服继续打更公平。",
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
            <span>18 条规则</span>
            <span>12 个争议场景</span>
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

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">China 8-Ball</p>
            <h2>中 8 争议球处理</h2>
          </div>
          <span className="section-note">先停杆，再判定</span>
        </div>

        <div className="academy-dispute-grid">
          {disputeCards.map((card) => (
            <article key={card.title} className="academy-dispute-card">
              <AlertTriangle aria-hidden="true" size={18} />
              <div>
                <h3>{card.title}</h3>
                <p>{card.ruling}</p>
                <span>{card.note}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="academy-principles">
          <div>
            <CheckCircle2 aria-hidden="true" size={20} />
            <h3>判定原则</h3>
          </div>
          <ol>
            {disputePrinciples.map((principle) => (
              <li key={principle}>{principle}</li>
            ))}
          </ol>
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
