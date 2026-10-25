export type AbilityHUDView = {
  enabled: boolean;
  floor: 0 | -1;
  stage: 'rest' | 'cooldown' | 'attempt' | 'warning';
  selected?: 'sense' | 'teleport';
  rest: number;
  attempt: number;
  warning: number;
  cooldowns: { sense: number; teleport: number };
  notice?: { kind: 'sense-warning' | 'teleport-warning' | 'exposed' | 'evaded' | 'teleported' | 'teleport-failed'; remaining: number; duration: number };
  moving: boolean;
  scanChance: number;
};

const SENSE_COOLDOWN = 35;
const TELEPORT_COOLDOWN = 45;

/** A lightweight view over basement abilities. Progress is driven by the game model. */
export class AbilityHud {
  private readonly element: HTMLElement;
  private readonly senseMeter: HTMLProgressElement;
  private readonly teleportMeter: HTMLProgressElement;
  private readonly note: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerTitle: HTMLElement;
  private readonly warningMeter: HTMLProgressElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('section');
    this.element.className = 'escape-ability-hud';
    this.element.setAttribute('aria-label', '负一楼技能状态');
    this.element.hidden = true;

    const status = document.createElement('div');
    status.className = 'escape-ability-status';
    status.setAttribute('aria-live', 'polite');

    const avatar = document.createElement('span');
    avatar.className = 'escape-ability-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    status.append(avatar);

    const readout = document.createElement('div');
    readout.className = 'escape-ability-readout';
    const sense = this.createAbilityCard('感测', SENSE_COOLDOWN, '感测充能');
    const teleport = this.createAbilityCard('瞬移', TELEPORT_COOLDOWN, '瞬移充能');
    this.senseMeter = sense.meter;
    this.teleportMeter = teleport.meter;
    readout.append(sense.card, teleport.card);

    this.note = document.createElement('span');
    this.note.className = 'escape-ability-note';
    this.note.textContent = '进入负一楼后启用';
    this.note.hidden = true;
    readout.append(this.note);
    status.append(readout);

    this.banner = document.createElement('div');
    this.banner.className = 'escape-ability-banner';
    this.banner.setAttribute('role', 'status');
    this.banner.setAttribute('aria-live', 'assertive');
    this.banner.hidden = true;
    const bannerAvatar = document.createElement('span');
    bannerAvatar.className = 'escape-ability-avatar';
    bannerAvatar.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    copy.className = 'escape-ability-banner-copy';
    this.bannerTitle = document.createElement('strong');
    this.warningMeter = document.createElement('progress');
    this.warningMeter.className = 'escape-ability-warning-meter';
    this.warningMeter.max = 3;
    this.warningMeter.value = 0;
    this.warningMeter.setAttribute('aria-label', '技能预警进度');
    copy.append(this.bannerTitle, this.warningMeter);
    this.banner.append(bannerAvatar, copy);
    this.element.append(status, this.banner);
    parent.append(this.element);
  }

  update(view: AbilityHUDView, visible: boolean, reducedMotion: boolean): void {
    this.element.hidden = !visible || !view.enabled;
    if (this.element.hidden) return;

    this.senseMeter.max = SENSE_COOLDOWN;
    this.senseMeter.value = this.charge(SENSE_COOLDOWN, view.cooldowns.sense);
    this.teleportMeter.max = TELEPORT_COOLDOWN;
    this.teleportMeter.value = this.charge(TELEPORT_COOLDOWN, view.cooldowns.teleport);
    this.note.hidden = view.floor !== 0;

    const notice = view.floor === -1 ? view.notice : undefined;
    const warning = !!notice && (notice.kind === 'sense-warning' || notice.kind === 'teleport-warning');
    this.banner.hidden = !notice;
    this.banner.classList.toggle('is-warning', warning);
    this.banner.classList.toggle('is-exposed', notice?.kind === 'exposed');
    this.banner.classList.toggle('is-result', !!notice && ['evaded', 'teleported', 'teleport-failed'].includes(notice.kind));
    this.element.classList.toggle('reduced-motion', reducedMotion);
    this.warningMeter.hidden = !warning;
    if (notice) {
      this.banner.style.setProperty('--ability-sweep', `${-45 + 155 * (1 - notice.remaining / notice.duration)}%`);
      this.bannerTitle.textContent = this.noticeText(notice.kind);
      this.warningMeter.value = warning ? Math.max(0, Math.min(3, 3 - notice.remaining)) : 0;
    }
  }

  destroy(): void {
    this.element.remove();
  }

  private createAbilityCard(label: string, max: number, accessibleName: string) {
    const card = document.createElement('div');
    card.className = 'escape-ability-item';
    const text = document.createElement('span');
    text.textContent = label;
    const meter = document.createElement('progress');
    meter.className = 'escape-ability-charge';
    meter.max = max;
    meter.value = max;
    meter.setAttribute('aria-label', accessibleName);
    card.append(text, meter);
    return { card, meter };
  }

  private charge(max: number, cooldown: number): number {
    return Math.max(0, Math.min(max, max - (Number.isFinite(cooldown) ? cooldown : max)));
  }

  private noticeText(kind: NonNullable<AbilityHUDView['notice']>['kind']): string {
    if (kind === 'sense-warning') return '即将扫描移动单位';
    if (kind === 'teleport-warning') return '空间出现异动';
    if (kind === 'exposed') return '位置暴露';
    if (kind === 'evaded') return '躲过感测';
    if (kind === 'teleported') return '奶蛙已瞬移';
    return '瞬移失败';
  }
}
