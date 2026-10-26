/** Shared wire contract for authoritative co-op escape rooms. */
import type { EscapeEvent, EscapeSnapshot, Vec } from "./world.ts";

export const COOP_PROTOCOL_VERSION = 1;
export type CoopPhase = "lobby" | "playing" | "won" | "lost";
export type CoopPlayerStatus = "connected" | "reconnecting" | "caught" | "eliminated" | "escaped" | "left";
export type CoopPlayer = {
  id: string;
  uid?: string;
  slot: 1 | 2 | 3;
  name: string;
  avatar: 0 | 1 | 2 | 3;
  ready: boolean;
  lives: number;
  status: CoopPlayerStatus;
  position?: Vec & { angle: number; pitch?: number; crouched?: boolean; sprinting?: boolean; moving?: boolean };
};
export type CoopRoomView = {
  code: string;
  name?: string;
  locked?: boolean;
  phase: CoopPhase;
  leaderId: string;
  players: CoopPlayer[];
  startedAt?: number;
};
export type CoopSnapshot = {
  protocol: typeof COOP_PROTOCOL_VERSION;
  serverTime: number;
  revision: number;
  viewPlayerId: string;
  targetPlayerId?: string;
  abilityTargetPlayerId?: string;
  room: CoopRoomView;
  /** Personal client render snapshot projected from the room's shared hunter and team state. */
  world: EscapeSnapshot;
  search?: { id: string; remaining: number };
  events: EscapeEvent[];
  team: { crystals: number; maxCrystals: number; escaped: number; alive: number; total: number };
};
export type CoopAction = "interact" | "crouch" | "sprint" | "light" | "stone" | "freeze" | "reveal" | "ward";
export type CoopInput = {
  seq: number;
  move: { forward: number; strafe: number; turn: number; look: number; sprint: boolean };
  aim?: { angle: number; pitch: number };
  action?: CoopAction;
  targetId?: string;
};
export type CoopCreateRequest = { version: string; name: string; avatar: 0 | 1 | 2 | 3;profileToken?:string;title?:string;visibility?:'public'|'private';password?:string };
export type CoopJoinRequest = { version: string; code: string; name: string; avatar: 0 | 1 | 2 | 3;profileToken?:string;password?:string };
export type CoopSessionResponse = { code: string; playerId: string; token: string; leader: boolean; phase: CoopPhase; protocol: typeof COOP_PROTOCOL_VERSION };

export function validCoopInput(value: unknown): value is CoopInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Partial<CoopInput>;
  const move = input.move;
  return Number.isSafeInteger(input.seq) && (input.seq as number) >= 0
    && !!move && typeof move === "object" && !Array.isArray(move)
    && [move.forward, move.strafe, move.turn, move.look].every(n => typeof n === "number" && Number.isFinite(n))
    && typeof move.sprint === "boolean"
    && (!input.aim || typeof input.aim.angle === "number" && Number.isFinite(input.aim.angle) && typeof input.aim.pitch === "number" && Number.isFinite(input.aim.pitch))
    && (input.action === undefined || ["interact", "crouch", "sprint", "light", "stone", "freeze", "reveal", "ward"].includes(input.action))
    && (input.targetId === undefined || typeof input.targetId === "string" && input.targetId.length <= 48);
}
