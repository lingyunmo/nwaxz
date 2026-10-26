import type { CoopPlayer, CoopRoomView } from "./coop-protocol.ts";

export type LobbyScreen = "home" | "servers" | "room" | "friends" | "profile";
export type LobbyProfile = { uid: string; name: string; avatar: number };
export type LobbyServer = { id: string; name: string; rooms: number; capacity: number; players: number; latency?: number; state: string };
export type LobbyRoom = { code: string; name: string; players: number; maxPlayers: number; locked: boolean; phase: string; leaderName: string };
export type LobbyFriend = { id: string; uid: string; name: string; avatar: number; online: boolean; roomCode?: string };
export type LobbyRequest = { uid: string; name: string; avatar: number };
export type LobbyInvitation = { fromUid: string; fromName: string; roomCode: string };
export type LobbyModel = {
  profile: LobbyProfile;
  version?: string;
  selfPlayerId?: string;
  screen: LobbyScreen;
  servers: LobbyServer[];
  rooms: LobbyRoom[];
  friends: LobbyFriend[];
  requests: LobbyRequest[];
  invitations: LobbyInvitation[];
  selectedRoom?: CoopRoomView;
  selectedRoomName?: string;
  message?:string;
};
export type LobbyActions = {
  screen(name: LobbyScreen): void;
  create(input: { name: string; visibility: "public" | "private"; password?: string }): void;
  join(code: string, password?: string): void;
  leave(): void;
  exit(): void;
  single?():void;
  controls?():void;
  settings?():void;
  start(): void;
  avatar(id: number): void;
  rename(name: string): void;
  addFriend(uid: string): void;
  acceptFriend(uid: string): void;
  removeFriend(uid: string): void;
  inviteFriend(uid: string): void;
  acceptInvite(roomCode: string): void;
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const avatar = (id: number) => `<span class="lv-portrait lv-avatar-${Math.max(0, Math.min(3, Math.trunc(id)))}" aria-hidden="true"></span>`;

/** Render a data-driven co-op lobby. Call the returned disposer when removing the view. */
export function renderLobbyView(container: HTMLElement, model: LobbyModel, actions: LobbyActions): () => void {
  const nav: [LobbyScreen, string][] = [["home", "大厅"], ["servers", "服务器"], ["room", "房间"], ["friends", "好友"], ["profile", "个人资料"]];
  const activePlayers = model.selectedRoom?.players ?? [];
  const roomScreen = model.screen === "room";
  container.innerHTML = `<section class="escape-lobby" data-lobby-screen="${model.screen}" aria-label="逃生大厅">
    <header class="lv-top"><div class="lv-brand"><span class="lv-mark">蛙</span><span>奶蛙·下水道逃生<small>极限恐怖</small></span></div><div class="lv-status"><i class="${model.servers.some(s=>/online|在线|ready|可用/i.test(s.state))?"is-up":"is-down"}"></i> ${model.servers[0]?esc(model.servers[0].state):"无服务器"} <b>${model.servers.length?`${model.servers.reduce((n,s)=>n+s.rooms,0)}/${model.servers.reduce((n,s)=>n+s.capacity,0)}`:"--/8"} 房间</b><span>·</span> ${model.servers.length?`${model.servers.reduce((n,s)=>n+s.players,0)} 人`:"-- 人"}　 RTT ${model.servers.find(s=>s.latency!=null)?.latency ?? "--"} ms</div><button class="lv-user" data-screen="profile">${avatar(model.profile.avatar)}<span>${esc(model.profile.name)}<small>UID ${esc(model.profile.uid)}</small></span><b>⌄</b></button></header>
    <aside class="lv-rail"><div class="lv-rail-label">主菜单</div><button class="lv-nav" data-action="single" id="escape-menu-solo"><span>◇</span>单人游戏</button>${nav.map(([id,label],i)=>`<button class="lv-nav ${model.screen===id?"is-active":""}" data-screen="${id}" ${id==='servers'?'id="escape-menu-coop"':''} ${id==="room"&&!model.selectedRoom?`aria-label="尚未加入房间，前往服务器"`:""}><span>${["⌂","⌁","▣","♧","◉"][i]}</span>${label}${id==="friends"&&model.requests.length?`<em>${model.requests.length}</em>`:""}</button>`).join("")}<button class="lv-nav" data-action="settings">设置</button><button class="lv-nav" data-action="controls" id="escape-menu-help">操作</button><div class="lv-rail-foot">${model.version?`版本 ${esc(model.version)}`:"多人游戏"}<br><button class="lv-exit" data-action="exit" id="escape-intro-exit">返回主菜单</button></div></aside>
    <main class="lv-main"><div class="lv-heading"><div><div class="lv-eyebrow">多人游戏 / ${nav.find(n=>n[0]===model.screen)?.[1]}</div><h1>${roomScreen?esc(model.selectedRoomName||`房间 ${model.selectedRoom?.code||""}`):(({home:"多人大厅",servers:"选择服务器",friends:"好友",profile:"个人资料"} as Partial<Record<LobbyScreen,string>>)[model.screen]||"房间列表")}</h1><p>${roomScreen?"查看队员状态并开始游戏。":"查看服务器、加入房间或邀请好友。"}</p></div>${!roomScreen?`<button class="lv-primary" data-open-create>＋ 创建房间</button>`:""}</div>
    ${model.message?`<p class="lv-message" role="status">${esc(model.message)}</p>`:''}${roomScreen?roomMarkup(model,activePlayers):model.screen==="servers"?serverMarkup(model):model.screen==="friends"?friendsMarkup(model):model.screen==="profile"?profileMarkup(model):homeMarkup(model)}
    </main><div class="lv-modal-root"></div></section>`;
  const onClick = (event: Event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("button,[data-room]"); if (!target) return;
    const scr=target.dataset.screen as LobbyScreen|undefined; if(scr){actions.screen(scr==="room"&&!model.selectedRoom?"servers":scr);return;}
    if(target.hasAttribute("data-open-create")){showCreate();return;}
    if(target.dataset.action==="join-code"){const code=(container.querySelector<HTMLInputElement>("#lv-code")?.value||"").trim().toUpperCase();if(code)showJoin(code,false);return;}
    const act=target.dataset.action, uid=target.dataset.uid||"";
    if(act==='single'){actions.single?.();return;}if(act==='controls'){actions.controls?.();return;}if(act==='settings'){actions.settings?.();return;}
    if(act==="exit")actions.exit(); else if(act==="leave")actions.leave(); else if(act==="start"){if(canStart(model))actions.start();} else if(act==="accept-friend")actions.acceptFriend(uid); else if(act==="remove-friend")actions.removeFriend(uid); else if(act==="invite"&&model.selectedRoom)actions.inviteFriend(uid); else if(act==="accept-invite")actions.acceptInvite(target.dataset.code||""); else if(target.dataset.room){const room=model.rooms.find(r=>r.code===target.dataset.room);showJoin(target.dataset.room,!!room?.locked);}
    else if(act==="add-friend"){const v=container.querySelector<HTMLInputElement>("#lv-add-uid")?.value.trim();if(v)actions.addFriend(v);}
    else if(act==="rename"){const v=container.querySelector<HTMLInputElement>("#lv-name")?.value.trim();if(v)actions.rename(v);}
    else if(act==="avatar"){const v=Number(target.dataset.avatar);if(Number.isInteger(v))actions.avatar(v);}
  };
  container.addEventListener("click",onClick);
  function showJoin(code:string, locked:boolean){const root=container.querySelector<HTMLElement>(".lv-modal-root")!;root.innerHTML=`<div class="lv-scrim" data-dismiss><form class="lv-modal"><button type="button" class="lv-close" data-dismiss aria-label="关闭">×</button><div class="lv-eyebrow">加入房间</div><h2>${esc(code)}</h2>${locked?`<label>房间密码<input name="password" type="password" required autofocus></label>`:`<label>房间密码（如有）<input name="password" type="password" autofocus></label>`}<button class="lv-primary" type="submit">加入</button></form></div>`;const form=root.querySelector("form")!;form.addEventListener("submit",e=>{e.preventDefault();actions.join(code,String(new FormData(form).get("password")||"")||undefined);root.innerHTML="";});root.addEventListener("click",e=>{if((e.target as HTMLElement).hasAttribute("data-dismiss"))root.innerHTML="";},{once:true});}
  function showCreate(){const root=container.querySelector<HTMLElement>(".lv-modal-root")!;root.innerHTML=`<div class="lv-scrim" data-dismiss><form class="lv-modal"><button type="button" class="lv-close" data-dismiss aria-label="关闭">×</button><div class="lv-eyebrow">新建房间</div><h2>创建房间</h2><label>房间名称<input name="name" maxlength="12" placeholder="房间名称" required></label><label>访问权限<select name="visibility"><option value="public">公开</option><option value="private">密码房</option></select></label><label class="lv-password" hidden>房间密码<input name="password" maxlength="32" type="password" placeholder="设置加入密码"></label><button class="lv-primary" type="submit">创建并加入</button></form></div>`;const form=root.querySelector("form")!,visibilityField=form.querySelector<HTMLSelectElement>('select')!,password=form.querySelector<HTMLInputElement>('[name="password"]')!;visibilityField.addEventListener('change',()=>{const locked=visibilityField.value==='private';password.required=locked;password.closest<HTMLElement>('label')!.hidden=!locked;});form.addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(form);const visibility=fd.get("visibility")==="private"?"private":"public";actions.create({name:String(fd.get("name")||"小队"),visibility,...(visibility==="private"?{password:String(fd.get("password")||"")}: {})});root.innerHTML="";});root.addEventListener("click",e=>{if((e.target as HTMLElement).hasAttribute("data-dismiss"))root.innerHTML="";},{once:true}); }
  return () => { container.removeEventListener("click",onClick); container.innerHTML=""; };
}

function homeMarkup(m:LobbyModel){return `<div class="lv-home-stage"><div class="lv-home-art lv-body-${Math.max(0,Math.min(3,Math.trunc(m.profile.avatar)))}" aria-hidden="true"></div><div class="lv-home-title"><span>奶蛙·</span><h1>下水道逃生</h1></div><div class="lv-home-actions"><button class="lv-primary" data-action="single">单人游戏</button><button class="lv-secondary" data-screen="servers">多人游戏</button></div></div>${m.invitations.length?`<div class="lv-invites">${m.invitations.map(i=>`<div>${avatar(0)}<span><b>${esc(i.fromName)}</b> 邀请你加入 <strong>${esc(i.roomCode)}</strong></span><button class="lv-primary" data-action="accept-invite" data-code="${esc(i.roomCode)}">接受邀请</button></div>`).join("")}</div>`:""}`;}
function serverCard(s:LobbyServer){return `<article class="lv-server"><div class="lv-card-top"><span class="lv-server-icon">⌁</span><span class="lv-chip">${esc(s.state)}</span></div><h3>${esc(s.name)}</h3><p>${s.rooms}/${s.capacity} 个房间 · ${s.players} 名玩家</p><footer><span class="${s.latency!=null&&s.latency<100?"lv-good":""}">● ${s.latency==null?"--":`${s.latency} ms`}</span><button data-screen="servers">进入　→</button></footer></article>`;}
function serverMarkup(m:LobbyModel){return `<div class="lv-list-tools"><div>服务器 <b>奶蛙浴场</b></div><label>加入房间码<input id="lv-code" maxlength="12" placeholder="输入房间码"></label><button class="lv-secondary" data-action="join-code">输入房间</button></div><div class="lv-server-grid">${m.servers.map(serverCard).join("")||`<div class="lv-empty">暂无服务器数据</div>`}</div><div class="lv-section-head"><h2>房间列表</h2><span>公开房间与密码房</span></div><div class="lv-room-list">${m.rooms.map(r=>`<article><div><b>${esc(r.name)}</b><span>${esc(r.code)} · 队长 ${esc(r.leaderName)}</span></div><span class="lv-room-phase">${phaseLabel(r.phase)}</span><span>${r.locked?"🔒 密码房":"◈ 公开房"}</span><span>${r.players}/${r.maxPlayers}</span><button class="lv-primary" data-room="${esc(r.code)}" ${r.phase!=="lobby"||r.players>=r.maxPlayers?"disabled":""}>${r.players>=r.maxPlayers?"已满":r.phase!=="lobby"?"进行中":"加入"}</button></article>`).join("")||`<div class="lv-empty">暂无房间。</div>`}</div>`;}
function roomMarkup(m:LobbyModel,players:CoopPlayer[]){const ps=players;return `<div class="lv-room-banner"><span>房间　/　${esc(m.selectedRoom?.code||"------")}</span><span>${ps.length}/3 玩家</span></div><div class="lv-roster">${[0,1,2].map(slot=>{const p=ps.find(p=>p.slot===slot+1);return `<article class="lv-slot ${p?"occupied":"vacant"}">${p?`<div class="lv-body lv-body-${p.avatar}" aria-hidden="true"></div><div class="lv-player-card">${avatar(p.avatar)}<span><b>${esc(p.name)}${p.id===m.selectedRoom?.leaderId?` <small>队长</small>`:""}</b><em>${p.status!=="connected"?esc(p.status):p.ready?"已准备":"等待准备"}</em></span><i class="${p.ready?"ready":""}">${p.ready?"✓":"…"}</i></div>`:`<div class="lv-vacant-mark">＋</div><b>等待玩家</b><span>空位</span>`}</article>`;}).join("")}</div><div class="lv-room-bottom"><div><b>队伍状态</b><span>${ps.length<3?`还可加入 ${3-ps.length} 名玩家`:"队伍已满"}</span></div><button class="lv-secondary" data-action="leave">离开房间</button>${m.selfPlayerId===m.selectedRoom?.leaderId?`<button class="lv-primary" data-action="start" ${canStart(m)?"":"disabled"}>开始游戏　→</button>`:`<button class="lv-secondary" disabled>等待队长</button>`}</div>`;}
function friendsMarkup(m:LobbyModel){return `<div class="lv-list-tools"><label>添加好友 UID<input id="lv-add-uid" maxlength="48" placeholder="输入好友 UID"></label><button class="lv-primary" data-action="add-friend">发送申请</button></div>${m.requests.length?`<div class="lv-section-head"><h2>好友申请</h2></div><div class="lv-friend-list">${m.requests.map(r=>`<div>${avatar(r.avatar)}<b>${esc(r.name)} <small>UID ${esc(r.uid)}</small></b><button class="lv-primary" data-action="accept-friend" data-uid="${esc(r.uid)}">接受</button></div>`).join("")}</div>`:""}<div class="lv-section-head"><h2>好友列表</h2><span>${m.friends.filter(f=>f.online).length} 位在线</span></div><div class="lv-friend-list">${m.friends.map(f=>`<div>${avatar(f.avatar)}<b>${esc(f.name)} <small>UID ${esc(f.uid)}</small></b><span class="${f.online?"online":""}">${f.online?(f.roomCode?`房间 ${esc(f.roomCode)}`:"在线"):"离线"}</span>${f.online?`<button class="lv-secondary" data-action="invite" data-uid="${esc(f.uid)}" ${m.selectedRoom?"":"disabled title=\"请先加入房间\""}>邀请</button>`:""}<button class="lv-quiet" data-action="remove-friend" data-uid="${esc(f.uid)}">移除</button></div>`).join("")||`<div class="lv-empty">暂无好友。输入 UID 发送申请。</div>`}</div>${m.invitations.length?`<div class="lv-section-head"><h2>房间邀请</h2></div><div class="lv-friend-list">${m.invitations.map(i=>`<div>${avatar(0)}<b>${esc(i.fromName)} <small>邀请你加入 ${esc(i.roomCode)}</small></b><button class="lv-primary" data-action="accept-invite" data-code="${esc(i.roomCode)}">加入房间</button></div>`).join("")}</div>`:""}`;}
function profileMarkup(m:LobbyModel){return `<div class="lv-profile"><div class="lv-profile-card">${avatar(m.profile.avatar)}<div><span class="lv-eyebrow">个人资料</span><h2>${esc(m.profile.name)}</h2><p>UID ${esc(m.profile.uid)}</p></div></div><label>昵称<input id="lv-name" maxlength="12" value="${esc(m.profile.name)}"></label><button class="lv-primary" data-action="rename">保存昵称</button><div class="lv-section-head"><h2>选择角色</h2></div><div class="lv-avatar-picker">${[0,1,2,3].map(i=>`<button class="${m.profile.avatar===i?"selected":""}" data-action="avatar" data-avatar="${i}">${avatar(i)}<b>${["雨衣青年","旧浴袍幸存者","蒙脸维修员","旧制服巡夜人"][i]}</b><span>${m.profile.avatar===i?"当前选择":"选择角色"}</span></button>`).join("")}</div></div>`;}

function canStart(m:LobbyModel){const room=m.selectedRoom;return !!room&&room.leaderId===m.selfPlayerId&&room.players.length>=2&&room.players.every(p=>p.ready&&p.status==="connected");}
function phaseLabel(phase:string){return phase==="lobby"?"等待中":phase==="playing"?"进行中":phase==="won"||phase==="lost"?"已结束":phase;}
