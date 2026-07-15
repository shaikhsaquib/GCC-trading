import { Pipe, PipeTransform } from '@angular/core';
import { timeAgo } from '../utils/time';

/**
 * `{{ someIsoDate | timeAgo }}` → "3h ago".
 * Thin wrapper over the shared timeAgo() util for template use.
 */
@Pipe({ name: 'timeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return timeAgo(iso);
  }
}
