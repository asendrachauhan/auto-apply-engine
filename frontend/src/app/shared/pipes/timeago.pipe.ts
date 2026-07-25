import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'timeago', standalone: true, pure: false })
export class TimeagoPipe implements PipeTransform {
  transform(value: string | Date | null): string {
    if (!value) return '';
    const diff  = Date.now() - new Date(value).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 7)  return `${days}d ago`;
    return new Date(value).toLocaleDateString();
  }
}
