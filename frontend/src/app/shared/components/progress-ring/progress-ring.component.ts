import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'aa-progress-ring',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ring-wrap" [style.width.px]="size" [style.height.px]="size">
      <svg [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 '+size+' '+size" style="transform:rotate(-90deg)">
        <circle class="ring-track" [attr.cx]="half" [attr.cy]="half" [attr.r]="radius" [attr.stroke-width]="stroke"/>
        <circle class="ring-fill" [attr.cx]="half" [attr.cy]="half" [attr.r]="radius"
                [attr.stroke]="color" [attr.stroke-width]="stroke"
                [attr.stroke-dasharray]="circumference"
                [attr.stroke-dashoffset]="offset"
                stroke-linecap="round" fill="none"/>
      </svg>
      <div class="ring-center" [style.transform]="'rotate(0)'">
        <div class="ring-value">{{ displayValue }}</div>
        <div class="ring-label" *ngIf="label">{{ label }}</div>
      </div>
    </div>
  `,
  styles: [`
    .ring-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; }
    .ring-track { fill: none; stroke: rgba(163,177,198,0.35); }
    .ring-fill   { fill: none; transition: stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1); }
    .ring-center {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center;
    }
    .ring-value { font-family: var(--font-display); font-weight: 700; color: var(--text); line-height: 1; }
    .ring-label { font-size: 10px; color: var(--text-muted); margin-top: 2px; font-weight: 500; }
  `]
})
export class ProgressRingComponent implements OnChanges {
  @Input() percent = 0;
  @Input() size    = 100;
  @Input() stroke  = 8;
  @Input() color   = 'var(--accent)';
  @Input() label   = '';
  @Input() suffix  = '%';

  half = 50; radius = 40; circumference = 251.2; offset = 251.2;

  get displayValue(): string { return `${Math.round(this.percent)}${this.suffix}`; }

  ngOnChanges(): void {
    this.half         = this.size / 2;
    this.radius       = this.half - this.stroke;
    this.circumference = 2 * Math.PI * this.radius;
    this.offset       = this.circumference * (1 - Math.min(this.percent, 100) / 100);
  }
}
