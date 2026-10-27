import { isHeroId, type HeroId, type FactionId } from "./catalog.ts";
export type Slots = [HeroId | null, HeroId | null, HeroId | null];
export type ClientTab = "lobby" | "heroes" | "draft" | "codex";
export type DraftState = { version: 1; nickname: string; featured: HeroId; activeTeam: FactionId; activeSlot: number; teams: Record<FactionId, Slots>; locked: Record<FactionId, boolean> };
export const DRAFT_KEY = "nwaxz-versus-preview-v1";
export function initialDraft(): DraftState { return { version: 1, nickname: "新来的奶娃", featured: "alan", activeTeam: "clear", activeSlot: 0, teams: { clear: [null,null,null], warm: [null,null,null] }, locked: { clear:false,warm:false } }; }
export function complete(slots: Slots) { return slots.every(isHeroId) && new Set(slots).size === 3; }
export function nickname(value: string) { return [...value.normalize("NFC").trim().replace(/[<>\u0000-\u001f\u007f]/gu, "")].slice(0,12).join("") || "新来的奶娃"; }
export function readDraft(raw: string | null): DraftState {
  try {
    const value=JSON.parse(raw??"null") as DraftState;
    if(!value||value.version!==1||typeof value.nickname!=="string"||!isHeroId(value.featured)||!['clear','warm'].includes(value.activeTeam)||!Number.isInteger(value.activeSlot)||value.activeSlot<0||value.activeSlot>2) return initialDraft();
    for(const team of ['clear','warm'] as const){const slots=value.teams?.[team];if(!Array.isArray(slots)||slots.length!==3||slots.some(s=>s!==null&&!isHeroId(s))||new Set(slots.filter(Boolean)).size!==slots.filter(Boolean).length||typeof value.locked?.[team]!=="boolean"||value.locked[team]&&!complete(slots))return initialDraft();}
    return {version:1,nickname:nickname(value.nickname),featured:value.featured,activeTeam:value.activeTeam,activeSlot:value.activeSlot,teams:{clear:[...value.teams.clear],warm:[...value.teams.warm]},locked:{clear:value.locked.clear,warm:value.locked.warm}};
  } catch { return initialDraft(); }
}
export type DraftEvent = {type:"focus";hero:HeroId}|{type:"seat";team:FactionId;slot:number}|{type:"pick";hero:HeroId}|{type:"lock";team:FactionId}|{type:"edit";team:FactionId}|{type:"name";value:string}|{type:"example"};
export function reduceDraft(state: DraftState, event: DraftEvent): DraftState {
  const next:DraftState={...state,teams:{clear:[...state.teams.clear],warm:[...state.teams.warm]},locked:{...state.locked}};
  if(event.type==="focus"){if(isHeroId(event.hero))next.featured=event.hero;}
  if(event.type==="seat"&&['clear','warm'].includes(event.team)&&Number.isInteger(event.slot)&&event.slot>=0&&event.slot<3){next.activeTeam=event.team;next.activeSlot=event.slot;next.featured=next.teams[event.team][event.slot]??next.featured;}
  if(event.type==="pick"&&isHeroId(event.hero)&&!next.locked[next.activeTeam]){
    const seats=next.teams[next.activeTeam],old=seats[next.activeSlot],other=seats.indexOf(event.hero);
    if(other!==-1&&other!==next.activeSlot)seats[other]=old;
    seats[next.activeSlot]=event.hero;next.featured=event.hero;
  }
  if(event.type==="lock"&&['clear','warm'].includes(event.team)&&complete(next.teams[event.team]))next.locked[event.team]=true;
  if(event.type==="edit"&&['clear','warm'].includes(event.team))next.locked[event.team]=false;
  if(event.type==="name")next.nickname=nickname(event.value);
  if(event.type==="example"){next.teams={clear:['alan','zhenzhen','dingdang'],warm:['paoying','alan','dingdang']};next.locked={clear:false,warm:false};}
  return next;
}
