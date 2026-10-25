export class NoteDialog {
  private readonly element: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly content: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly onClose: () => void;

  constructor(parent: HTMLElement, onClose: () => void) {
    this.onClose = onClose;
    this.element = document.createElement('section');
    this.element.className = 'escape-note-dialog';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', '阅读纸条');

    const paper = document.createElement('article');
    paper.className = 'escape-note-paper';
    const top = document.createElement('header');
    top.className = 'escape-note-header';
    this.heading = document.createElement('h2');
    this.heading.className = 'escape-note-title';
    this.closeButton = document.createElement('button');
    this.closeButton.className = 'escape-note-close';
    this.closeButton.type = 'button';
    this.closeButton.textContent = '合上纸条';
    this.closeButton.setAttribute('aria-label', '合上纸条');
    this.closeButton.addEventListener('click', () => this.close());
    top.append(this.heading, this.closeButton);

    this.content = document.createElement('p');
    this.content.className = 'escape-note-content';
    paper.append(top, this.content);
    this.element.append(paper);
    parent.append(this.element);
  }

  show(title: string, text: string): void {
    this.heading.textContent = title;
    this.content.textContent = text;
    this.element.hidden = false;
    this.closeButton.focus({ preventScroll: true });
  }

  close(): void {
    if (this.element.hidden) return;
    this.element.hidden = true;
    this.onClose();
  }

  destroy(): void {
    this.element.remove();
  }
}
