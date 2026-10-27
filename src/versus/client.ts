import "./client.css";
import { ARTS, ART_IDS, HEROES, heroById, isHeroId, FACTIONS, POSITIONS, BOSSES, weakTo, type ArtId, type BossId, type FactionId, type HeroId } from "./catalog.ts";
import { DRAFT_KEY, complete, readDraft, reduceDraft, type ClientTab, type DraftEvent } from "./state.ts";

type Options = { version: string; updateAvailable: boolean; onExit: () => void; onUpdate: () => void; onSafe: () => void };
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const crest = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 4 16 10v20L24 44 8 34V14Z"/><path d="M15 28c5-2 5-14 9-14s4 12 9 14M15 33h18M18 24h12"/></svg>';
const teams: FactionId[] = ["clear", "warm"];
export class VersusClient {
  private state = readDraft(this.readStorage());
  private tab: ClientTab = "lobby";
  private artFilter: ArtId | "all" = "all";
  private skill = "Q";
  private book: "map" | "arts" | "bosses" = "map";
  private art: ArtId = "tide";
  private boss: BossId = "dakou";
  private notice = "";
  private disposed = false;
  constructor(private root: HTMLElement, private options: Options) {
    root.addEventListener("click", this.click);
    root.addEventListener("submit", this.submit);
    root.addEventListener("close", this.dialogClose, true);
    this.render();
  }
  private readStorage() { try { return localStorage.getItem(DRAFT_KEY); } catch { return null; } }
  private send(event: DraftEvent) {
    this.state = reduceDraft(this.state, event);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(this.state)); }
    catch { this.notice = "此浏览器无法保存编队"; }
  }
  private portrait(id: HeroId, action: string, selected = false) {
    const h = heroById(id), a = ARTS[h.art];
    return `<button class="vc-portrait ${selected ? "selected" : ""}" data-${action}="${id}" aria-pressed="${selected}" aria-label="${h.name} · ${a.name}" data-art-tone="${h.art}"><span><img src="${h.image}" alt=""/></span><strong>${h.name}</strong><small>${a.name}</small></button>`;
  }
  private render() {
    if (this.disposed) return;
    this.root.innerHTML = `<main class="versus-client" data-versus-tab="${this.tab}"><header class="vc-header"><button class="vc-back" data-action="exit" aria-label="返回模式选择">‹</button><button class="vc-brand" data-tab="lobby">${crest}<span>奶娃峡谷<small>三人一队 · 两岸争流</small></span></button><nav class="vc-nav" aria-label="峡谷导航">${([["lobby","大厅"],["heroes","奶娃"],["draft","阵容"],["codex","峡谷图鉴"]] as const).map(([id,name])=>`<button data-tab="${id}" aria-current="${this.tab===id?"page":"false"}">${name}</button>`).join("")}</nav><button class="vc-profile" data-action="profile"><span class="vc-profile-mark">蛙</span><span>${esc(this.state.nickname)}<small>本机档案</small></span><span aria-hidden="true">⌄</span></button></header><section class="vc-body" aria-label="${{lobby:"峡谷大厅",heroes:"奶娃图鉴",draft:"阵容预演",codex:"峡谷图鉴"}[this.tab]}">${this.tab==="lobby"?this.lobby():this.tab==="heroes"?this.heroes():this.tab==="draft"?this.draft():this.codex()}</section><footer class="vc-footer"><span><i></i>界面预览 · 对局尚未开放</span><span class="vc-notice" role="status">${this.notice}</span><button id="update" data-action="update" ${this.options.updateAvailable?"":"hidden"}>有新版本</button><span>v${esc(this.options.version)}</span></footer></main><dialog class="vc-dialog" aria-labelledby="vc-profile-title"><form><span class="vc-kicker">峡谷档案</span><h2 id="vc-profile-title">你的名字</h2><label for="vc-nickname">本机昵称</label><input id="vc-nickname" name="nickname" maxlength="24" value="${esc(this.state.nickname)}" autocomplete="off"/><p>编队和昵称保存在当前浏览器。</p><div><button type="button" data-action="close-profile">取消</button><button class="vc-gold" type="submit">保存</button></div></form></dialog>`;
    // Set validated style properties through DOM APIs; the site CSP disallows inline style attributes.
    for(const e of this.root.querySelectorAll<HTMLElement>('[data-art-tone]')){const id=e.dataset.artTone as ArtId;if(ART_IDS.includes(id))e.style.setProperty('--art',ARTS[id].color);}
    for(const e of this.root.querySelectorAll<HTMLElement>('[data-team-tone]')){const id=e.dataset.teamTone as FactionId;if(teams.includes(id))e.style.setProperty('--team',FACTIONS[id].color);}
    for(const e of this.root.querySelectorAll<HTMLElement>('[data-seat-tone]')){const id=e.dataset.seatTone!;e.style.setProperty('--seat',ART_IDS.includes(id as ArtId)?ARTS[id as ArtId].color:FACTIONS[id as FactionId].color);}
    for(const e of this.root.querySelectorAll<HTMLElement>('[data-map-boss]')){const b=BOSSES.find(x=>x.id===e.dataset.mapBoss);if(b){e.style.left=b.x+'%';e.style.top=b.y+'%';}}
  }
  private lobby() {
    const h=heroById(this.state.featured),a=ARTS[h.art];
    return `<div class="vc-lobby" data-art-tone="${h.art}"><img class="vc-lobby-backdrop" src="/assets/versus/canyon-map-v1.png" alt=""/><div class="vc-lobby-copy"><span class="vc-kicker">归水礼 · 序章</span><h1>两岸争流<br/><em>各有归处</em></h1><p>清泉与暖炉之间，水又一次走到了岔口。</p><div class="vc-lobby-actions"><button class="vc-gold" data-tab="draft">阵容预演 <span>→</span></button><button class="vc-outline" data-tab="codex">走进峡谷</button></div><div class="vc-hero-line"><span class="vc-art-mark">${a.mark}</span><div><small>${a.name} · ${h.title}</small><strong>${h.name}</strong><p>“${h.quote}”</p></div><button data-action="inspect" aria-label="查看${h.name}">↗</button></div></div><img class="vc-featured" src="${h.image}" alt="${h.name}全身立绘"/><div class="vc-lobby-roster"><span class="vc-kicker">初至峡谷</span><div>${HEROES.map(x=>this.portrait(x.id,"focus",x.id===h.id)).join("")}</div><button class="vc-text" data-tab="heroes">查看奶娃图鉴 →</button></div><div class="vc-edition">MILKFROG VALLEY<span>01 / 归水礼</span></div></div>`;
  }
  private heroes() {
    const h=heroById(this.state.featured),a=ARTS[h.art],s=h.skills.find(x=>x.key===this.skill)??h.skills[1];
    return `<div class="vc-heroes" data-art-tone="${h.art}"><aside class="vc-roster"><span class="vc-kicker">峡谷来客</span><h1>奶娃图鉴</h1><div class="vc-filters" aria-label="四术筛选">${(["all",...ART_IDS] as const).map(id=>`<button data-filter="${id}" aria-pressed="${id===this.artFilter}">${id==="all"?"全部":ARTS[id].name}</button>`).join("")}</div><div class="vc-roster-list">${HEROES.filter(x=>this.artFilter==="all"||x.art===this.artFilter).map(x=>this.portrait(x.id,"focus",x.id===h.id)).join("")}</div></aside><div class="vc-hero-stage"><div class="vc-stage-ring" aria-hidden="true">${a.mark}</div><img src="${h.image}" alt="${h.name}全身立绘"/></div><article class="vc-hero-detail"><span class="vc-kicker">${a.name} · ${h.title}</span><h2>${h.name}</h2><blockquote>“${h.quote}”</blockquote><p class="vc-lore">${h.story}</p><div class="vc-skill-tabs" aria-label="技能设定">${h.skills.map(x=>`<button data-skill="${x.key}" aria-pressed="${x.key===s.key}" aria-label="${x.key} ${x.name}"><b>${x.key}</b><span>${x.name}</span></button>`).join("")}</div><div class="vc-skill"><small>${s.tag}</small><h3>${s.name}</h3><p>${s.text}</p></div><div class="vc-matchups"><span>制 ${ARTS[a.beats].name}</span><span>慎 ${ARTS[weakTo(h.art)].name}</span><button data-action="four-arts">四术关系 ↗</button></div><button class="vc-gold" data-action="take-hero">带入阵容 →</button><small class="vc-design-label">技能设定 · 尚未实装战斗</small></article></div>`;
  }
  private draft() {
    const team=this.state.activeTeam,f=FACTIONS[team],slots=this.state.teams[team],locked=this.state.locked[team],other=team==="clear"?"warm":"clear",ready=teams.every(t=>this.state.locked[t]);
    return `<div class="vc-draft" data-team-tone="${team}"><header class="vc-draft-heading"><div><span class="vc-kicker">本机阵容预演</span><h1>${ready?"两岸，已就位。":"这一席，留给谁？"}</h1></div><div class="vc-team-switch" aria-label="编辑队伍">${teams.map(t=>`<button data-team="${t}" aria-pressed="${t===team}" data-team-tone="${t}">${FACTIONS[t].name}<small>${this.state.locked[t]?"已锁定":"编排中"}</small></button>`).join("")}</div></header><div class="vc-draft-main"><section class="vc-seats" aria-label="${f.name}三席">${slots.map((id,i)=>`<button class="vc-seat ${i===this.state.activeSlot?"selected":""} ${id?"filled":""}" data-seat="${i}" aria-pressed="${i===this.state.activeSlot}" data-seat-tone="${id?heroById(id).art:team}"><span class="vc-seat-head"><small>0${i+1}</small>${POSITIONS[i]}<span>${locked?"已锁定":i===this.state.activeSlot?"选择中":""}</span></span>${id?`<img src="${heroById(id).image}" alt="${heroById(id).name}全身立绘"/><span class="vc-seat-name"><small>${ARTS[heroById(id).art].name} · ${heroById(id).title}</small><strong>${heroById(id).name}</strong></span>`:`<span class="vc-empty-seat"><b>＋</b><span>选择奶娃</span></span>`}</button>`).join("")}</section><aside class="vc-pick-panel"><span class="vc-kicker">${locked?"阵容已锁定":`为${POSITIONS[this.state.activeSlot]}选择奶娃`}</span><div class="vc-pick-roster">${HEROES.map(h=>this.portrait(h.id,"pick",slots[this.state.activeSlot]===h.id)).join("")}</div><p class="vc-draft-hint">${locked?"想再试一种搭配？重新编排即可。":"同队选重复奶娃会交换席位。四术不限制位置。"}</p><button class="vc-gold" data-action="${locked?"edit":"lock"}" ${!locked&&!complete(slots)?"disabled":""}>${locked?"重新编排":"锁定阵容"}</button><button class="vc-text" data-action="example">填入示例阵容</button><div class="vc-opposition"><span>${FACTIONS[other].name}</span><div>${this.state.teams[other].map(id=>id?`<img src="${heroById(id).image}" alt="${heroById(id).name}"/>`:'<span class="vc-empty-portrait">?</span>').join("")}</div><button class="vc-text" data-team="${other}">编排另一队 →</button></div></aside></div><footer class="vc-draft-footer"><p>${ready?"两队阵容已保存。峡谷对局尚未开放。":"两队均由你编排，阵容会自动保存在本机。"}</p><button disabled>对局筹备中</button></footer></div>`;
  }
  private codex() {
    return `<div class="vc-codex"><header class="vc-book-header"><div><span class="vc-kicker">归水礼之后</span><h1>奶娃峡谷</h1></div><nav class="vc-book-tabs" aria-label="图鉴分类">${([["map","峡谷"],["arts","四术"],["bosses","中立奶娃"]] as const).map(([id,label])=>`<button data-book="${id}" aria-pressed="${this.book===id}">${label}</button>`).join("")}</nav></header>${this.book==="arts"?this.arts():this.book==="bosses"?this.bestiary():this.map()}</div>`;
  }
  private map() {
    return `<div class="vc-map-layout"><div class="vc-map"><img src="/assets/versus/canyon-map-v1.png" alt="奶娃峡谷概念地图：清泉在左，暖炉在右；上渠、下渠环绕中央吞潮池"/><span class="vc-map-place vc-clear">清泉盟</span><span class="vc-map-place vc-warm">暖炉会</span><span class="vc-map-label vc-upper">上渠</span><span class="vc-map-label vc-lower">下渠</span>${BOSSES.map(b=>`<button class="vc-map-boss" data-map-boss="${b.id}"  aria-label="查看${b.name}"><b>${b.mark}</b><span>${b.place.split(" · ")[1]}</span></button>`).join("")}</div><article class="vc-world-copy"><span class="vc-kicker">两条水渠，一处河心</span><h2>争的是水，<br/>守的是归处。</h2><p>归水礼那夜，老泉枢忽然停转。清泉盟要让水重新流回两岸，暖炉会要保住长夜里最后的温泉。</p><p>三只奶娃从上渠、下渠与河心出发。闸塔挡住去路，河里的老奶娃却从不听哪一岸的号令。</p><div class="vc-world-route"><span>上渠</span><span>下渠</span><span>巡河</span></div><small>峡谷与规则设定 · 对局尚未开放</small></article></div>`;
  }
  private arts() {
    const a=ARTS[this.art];
    return `<div class="vc-arts-layout" data-art-tone="${this.art}"><div class="vc-arts-wheel" aria-label="引潮克封闸，封闸克回响，回响克隐沫，隐沫克引潮">${ART_IDS.map((id,i)=>`<button class="vc-art-node node-${i}" data-art="${id}" aria-pressed="${id===this.art}" data-art-tone="${id}"><b>${ARTS[id].mark}</b><span>${ARTS[id].name}</span></button>`).join("")}<svg viewBox="0 0 400 400" aria-hidden="true"><defs><marker id="vc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10Z"/></marker></defs><path d="M250 65Q330 80 340 150M335 250Q320 330 250 340M150 335Q70 320 60 250M65 150Q80 70 150 60"/></svg><span class="vc-wheel-center">四术<small>环环有解</small></span></div><article class="vc-art-copy"><span class="vc-kicker">四术之一</span><h2>${a.name}</h2><blockquote>${a.phrase}</blockquote><h3>如何破局</h3><p>${a.mechanic}</p><h3>留心另一手</h3><p>${a.caution}</p><div class="vc-matchups"><span>制 ${ARTS[a.beats].name}</span><span>慎 ${ARTS[weakTo(this.art)].name}</span></div><small>相邻机制克制，对角中性。时机和位置可以改变胜负。</small></article></div>`;
  }
  private bestiary() {
    const b=BOSSES.find(x=>x.id===this.boss)!;
    return `<div class="vc-bestiary"><nav class="vc-boss-nav" aria-label="中立奶娃">${BOSSES.map(x=>`<button data-boss="${x.id}" aria-pressed="${x.id===b.id}"><img src="${x.image}" alt=""/><span><strong>${x.name}</strong><small>${x.title}</small></span></button>`).join("")}</nav><article class="vc-boss-feature"><img src="${b.image}" alt="${b.name}场景原画"/><div><span class="vc-kicker">${b.place} · ${b.title}</span><h2>${b.name}</h2><p>${b.story}</p><section><h3>${b.reward}</h3><p>${b.effect}</p></section><blockquote>“${b.warning}”</blockquote><small>中立目标设定 · 尚未实装战斗</small></div></article></div>`;
  }
  private click = (event: MouseEvent) => {
    const b=(event.target as Element).closest<HTMLButtonElement>("button");
    if(!b||!this.root.contains(b)||b.disabled||(b.type==="submit"&&!!b.closest("form")))return;
    const d=b.dataset;
    if(d.tab&&["lobby","heroes","draft","codex"].includes(d.tab))this.tab=d.tab as ClientTab;
    if(d.focus&&isHeroId(d.focus)){this.send({type:"focus",hero:d.focus});this.skill="Q";}
    if(d.pick&&isHeroId(d.pick))this.send({type:"pick",hero:d.pick});
    if(d.team&&teams.includes(d.team as FactionId))this.send({type:"seat",team:d.team as FactionId,slot:0});
    if(d.seat!==undefined)this.send({type:"seat",team:this.state.activeTeam,slot:Number(d.seat)});
    if(d.filter&&(d.filter==="all"||ART_IDS.includes(d.filter as ArtId))){this.artFilter=d.filter as ArtId|"all";const first=HEROES.find(h=>this.artFilter==="all"||h.art===this.artFilter)!;if(this.artFilter!=="all")this.send({type:"focus",hero:first.id});}
    if(d.skill&&["P","Q","E","R"].includes(d.skill))this.skill=d.skill;
    if(d.book&&["map","arts","bosses"].includes(d.book))this.book=d.book as typeof this.book;
    if(d.art&&ART_IDS.includes(d.art as ArtId))this.art=d.art as ArtId;
    const boss=d.boss??d.mapBoss;if(boss&&BOSSES.some(x=>x.id===boss)){this.boss=boss as BossId;this.book="bosses";}
    switch(d.action){
      case "exit":this.options.onExit();return;
      case "update":this.options.onUpdate();return;
      case "inspect":this.tab="heroes";break;
      case "four-arts":this.art=heroById(this.state.featured).art;this.book="arts";this.tab="codex";break;
      case "take-hero":this.send({type:"pick",hero:this.state.featured});this.tab="draft";break;
      case "lock":this.send({type:"lock",team:this.state.activeTeam});break;
      case "edit":this.send({type:"edit",team:this.state.activeTeam});break;
      case "example":this.send({type:"example"});break;
      case "profile":this.root.querySelector<HTMLDialogElement>(".vc-dialog")!.showModal();return;
      case "close-profile":this.root.querySelector<HTMLDialogElement>(".vc-dialog")!.close();this.options.onSafe();return;
    }
    // Keep keyboard focus on the same control after a view update.
    const selector=d.tab?`[data-tab="${d.tab}"]`:d.skill?`[data-skill="${d.skill}"]`:d.focus?`[data-focus="${d.focus}"]`:d.pick?`[data-pick="${d.pick}"]`:d.seat?`[data-seat="${d.seat}"]`:d.filter?`[data-filter="${d.filter}"]`:d.book?`[data-book="${d.book}"]`:d.art?`[data-art="${d.art}"]`:d.boss?`[data-boss="${d.boss}"]`:null;
    this.render();if(event.detail===0&&selector)this.root.querySelector<HTMLButtonElement>(selector)?.focus({preventScroll:true});
    this.options.onSafe();
  };
  private submit = (event: SubmitEvent) => {
    if(!(event.target instanceof HTMLFormElement)||!event.target.closest(".vc-dialog"))return;
    event.preventDefault();this.send({type:"name",value:String(new FormData(event.target).get("nickname")??"")});this.render();this.root.querySelector<HTMLButtonElement>('[data-action="profile"]')?.focus();this.options.onSafe();
  };
  private dialogClose = () => { if(!this.disposed){this.root.querySelector<HTMLButtonElement>('[data-action="profile"]')?.focus();this.options.onSafe();} };
  setUpdateAvailable() {this.options.updateAvailable=true;const b=this.root.querySelector<HTMLButtonElement>("#update");if(b)b.hidden=false;}
  destroy(){this.disposed=true;this.root.removeEventListener("click",this.click);this.root.removeEventListener("submit",this.submit);this.root.removeEventListener("close",this.dialogClose,true);this.root.querySelector<HTMLDialogElement>(".vc-dialog")?.close();}
}
