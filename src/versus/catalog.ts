export const ARTS = {
  tide: { name: "引潮", mark: "潮", color: "#72d8e4", beats: "gate", phrase: "把水路变成自己的路", mechanic: "蓄起水势，冲开封闸留下的临时闸墙。", caution: "锁定水流可能被隐沫的假身截走。" },
  gate: { name: "封闸", mark: "闸", color: "#a6cca3", beats: "echo", phrase: "让该停下的水停下", mechanic: "截断水线，让沿水传播的回响失去传导。", caution: "临时闸墙挡不住已经蓄足的引潮冲刷。" },
  echo: { name: "回响", mark: "响", color: "#e8bb71", beats: "foam", phrase: "听见水面藏起的答案", mechanic: "回响碰到假身，会留下通向真身的声纹。", caution: "封闸能切断回响赖以传播的水线。" },
  foam: { name: "隐沫", mark: "沫", color: "#c8b0ed", beats: "tide", phrase: "让追来的水认错人", mechanic: "用可识破的假身，诱走引潮的锁定水流。", caution: "回响能识破假身，照出残留的水痕。" },
} as const;
export type ArtId = keyof typeof ARTS;
export const ART_IDS = Object.keys(ARTS) as ArtId[];
export type Skill = { key: string; name: string; tag: string; text: string };
export const HEROES = [
  { id: "alan", name: "阿澜", title: "借浪者", art: "tide", image: "/assets/versus/heroes/alan.png", quote: "水总有路。没有，就开一条。", story: "他曾替两岸修过同一条水渠。归水礼之后，阿澜带着旧阀环回到峡谷，要把被截断的水重新接起来。", skills: [
    { key: "P", name: "水痕", tag: "借势", text: "经过自己留下的水痕时，阿澜能再次借到短促的顺流。" },
    { key: "Q", name: "借浪", tag: "换位", text: "沿一条短水线滑行，推开贴近的目标。拐弯的时机比直冲更重要。" },
    { key: "E", name: "回流环", tag: "破闸", text: "蓄势后弯折面前的水流，冲刷临时闸印。蓄势可以被打断。" },
    { key: "R", name: "开潮", tag: "改路", text: "把一段河道变成顺流带，为整队创造一次推进或撤离的路线。" },
  ] },
  { id: "zhenzhen", name: "砧砧", title: "青闸守", art: "gate", image: "/assets/versus/heroes/zhenzhen.png", quote: "先站稳，再开闸。", story: "旧闸庭最年轻的守门奶娃。砧砧不相信谁的旗更漂亮，只相信每一枚闸印都该留一条回家的路。", skills: [
    { key: "P", name: "落印", tag: "稳场", text: "短暂停步后，下一枚闸印更稳；不断乱走就借不到这股稳势。" },
    { key: "Q", name: "立闸", tag: "截流", text: "落下一道短暂闸墙，分开水线，也截住沿水传播的回响。" },
    { key: "E", name: "回扣", tag: "护送", text: "收回已放的闸印，为回程水线上的队友挡住一次冲刷。" },
    { key: "R", name: "静水庭", tag: "分场", text: "合拢一圈闸印，暂时切断庭内外的水线传导。它并不封住所有招式。" },
  ] },
  { id: "dingdang", name: "叮当", title: "传声客", art: "echo", image: "/assets/versus/heroes/dingdang.png", quote: "嘘。假身也会踩出水声。", story: "他靠敲碗找回过迷路的幼奶娃。如今峡谷里到处都是倒影，叮当仍相信：真正走过的路，总会留下余音。", skills: [
    { key: "P", name: "余音", tag: "寻迹", text: "刚被扰动的近处水面会留下余音。痕迹会消失，也不能代替视野。" },
    { key: "Q", name: "叩水", tag: "识假", text: "发出一道可躲开的短回响；碰到假身时，声纹指向真身留下的水痕。" },
    { key: "E", name: "绕梁", tag: "转角", text: "把下一道回响寄在地物上，从另一个角度再次传出。" },
    { key: "R", name: "百响归一", tag: "照迹", text: "让目标水面接连响起声纹，短暂照出泡膜踪迹；离开水面可以避开一部分追踪。" },
  ] },
  { id: "paoying", name: "泡影", title: "逐影客", art: "foam", image: "/assets/versus/heroes/paoying.png", quote: "你刚才追的是哪一个我？", story: "泡影从不说自己站在哪一岸。她只在意河面还有没有笑声，以及那道追来的浪会不会认错人。", skills: [
    { key: "P", name: "薄沫", tag: "藏迹", text: "短暂脱离视线后，下一次假身能留下更完整的误导水痕。" },
    { key: "Q", name: "借影", tag: "诱流", text: "留下一只沿短路前行的泡沫假身。它能截走锁定水流，也能被声纹识破。" },
    { key: "E", name: "破泡", tag: "脱身", text: "点破自己的泡膜，向侧方挪开一小段距离；墙和闸印仍然挡路。" },
    { key: "R", name: "满河浮光", tag: "乱阵", text: "在一片水域布下数个有迹可辨的诱饵，为整队争取调整位置的时机。" },
  ] },
] as const satisfies readonly { id: string; name: string; title: string; art: ArtId; image: string; quote: string; story: string; skills: readonly Skill[] }[];
export type HeroId = typeof HEROES[number]["id"];
export const heroById = (id: HeroId) => HEROES.find(h => h.id === id)!;
export const isHeroId = (id: unknown): id is HeroId => HEROES.some(h => h.id === id);
export const FACTIONS = { clear: { name: "清泉盟", short: "清泉", color: "#78d4df", motto: "水应流回每一户门前。" }, warm: { name: "暖炉会", short: "暖炉", color: "#e6ad6b", motto: "守住炉火，才能熬过长夜。" } } as const;
export type FactionId = keyof typeof FACTIONS;
export const POSITIONS = ["上渠", "下渠", "巡河"] as const;
export const BOSSES = [
  { id: "dakou", name: "大口", title: "吞潮奶娃", place: "河心 · 吞潮池", image: "/assets/versus/bosses/dakou.png", mark: "潮", x: 50, y: 49, story: "归水礼断掉的水，都被大口吞进了肚子。它不认旗帜；它吐出下一口潮水时，两岸都会听见。", reward: "改流权", effect: "选择一条水渠，让下一股中立潮流转向。影响路线，不给全队永久加伤。", warning: "水开始回卷时，先离开池口。" },
  { id: "shigong", name: "石公公", title: "守闸奶娃", place: "上岸 · 旧闸庭", image: "/assets/versus/bosses/shigong.png", mark: "闸", x: 72, y: 27, story: "矿灰盖住了它的黄皮，旧闸却一次也没倒过。石公公记得每一道开闸声，也记得谁把水留给过别人。", reward: "护闸印", effect: "为己方一座闸塔抵挡一次冲刷。它是一枚要择机使用的印，不会替全队作战。", warning: "印面亮起时，别站在闸门正前方。" },
  { id: "daoying", name: "倒影", title: "影泡奶娃", place: "下岸 · 雾泊", image: "/assets/versus/bosses/daoying.png", mark: "影", x: 27, y: 72, story: "岸上笑着一只，水里还笑着一只。没人知道哪只是倒影；但它们总会在同一处水面留下脚印。", reward: "照河权", effect: "查看一段河道最近留下的水痕。得到的是线索，不是永久看穿所有奶娃。", warning: "先辨认水痕，再追那张笑脸。" },
] as const;
export type BossId = typeof BOSSES[number]["id"];
export function relation(a: ArtId, b: ArtId): "strong" | "weak" | "neutral" {
  return ARTS[a].beats === b ? "strong" : ARTS[b].beats === a ? "weak" : "neutral";
}
export function weakTo(art: ArtId): ArtId { return ART_IDS.find(id => ARTS[id].beats === art)!; }
