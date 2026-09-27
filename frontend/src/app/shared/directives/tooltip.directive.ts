import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  Renderer2,
  inject
} from '@angular/core';

@Directive({
  selector: '[aaTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  @Input('aaTooltip') tooltipText = '';
  @Input() aaTooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';

  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private tooltipEl: HTMLElement | null = null;
  private showTimeout?: ReturnType<typeof setTimeout>;

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.show();
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.hide();
  }

  @HostListener('focus')
  onFocus(): void {
    this.show();
  }

  @HostListener('blur')
  onBlur(): void {
    this.hide();
  }

  @HostListener('click')
  onClick(): void {
    this.hide();
  }

  private show(): void {
    if (!this.tooltipText || this.tooltipEl) return;

    this.showTimeout = setTimeout(() => {
      this.createTooltip();
    }, 150);
  }

  private hide(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = undefined;
    }
    if (this.tooltipEl) {
      this.renderer.removeChild(document.body, this.tooltipEl);
      this.tooltipEl = null;
    }
  }

  private createTooltip(): void {
    if (!this.tooltipText) return;

    const tip = this.renderer.createElement('div') as HTMLElement;
    tip.className = 'aa-tooltip-bubble';
    tip.textContent = this.tooltipText;

    this.renderer.appendChild(document.body, tip);
    this.tooltipEl = tip;

    this.positionTooltip();
  }

  private positionTooltip(): void {
    if (!this.tooltipEl) return;

    const hostRect = this.el.nativeElement.getBoundingClientRect();
    const tipRect = this.tooltipEl.getBoundingClientRect();

    let top = 0;
    let left = 0;
    const gap = 8;

    switch (this.aaTooltipPosition) {
      case 'bottom':
        top = hostRect.bottom + gap;
        left = hostRect.left + (hostRect.width - tipRect.width) / 2;
        break;
      case 'left':
        top = hostRect.top + (hostRect.height - tipRect.height) / 2;
        left = hostRect.left - tipRect.width - gap;
        break;
      case 'right':
        top = hostRect.top + (hostRect.height - tipRect.height) / 2;
        left = hostRect.right + gap;
        break;
      case 'top':
      default:
        top = hostRect.top - tipRect.height - gap;
        left = hostRect.left + (hostRect.width - tipRect.width) / 2;
        break;
    }

    // Viewport containment: keep at least 8px from screen edges
    const pad = 8;
    if (left < pad) left = pad;
    if (left + tipRect.width > window.innerWidth - pad) {
      left = window.innerWidth - pad - tipRect.width;
    }
    if (top < pad) {
      top = hostRect.bottom + gap;
    }

    this.renderer.setStyle(this.tooltipEl, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipEl, 'left', `${left}px`);
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
