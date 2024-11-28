import { VoeDisconnectionValueItem } from '../../disconnections/interfaces/disconnections-item.interface';
import { getTimezoneOffset } from 'date-fns-tz';

export const getDateWithTzOffset = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minutes: number,
  offset: number,
) => {
  const date = new Date(year, month, day, hour, minutes);

  const tzOffset = new Date().getTimezoneOffset();

  return new Date(date.getTime() + (tzOffset + offset) * 1000 * 60);
};

export const mergeInterval = (
  intervals: VoeDisconnectionValueItem[],
): VoeDisconnectionValueItem[] => {
  if (!intervals.length) {
    return [];
  }
  const mergedIntervals = [intervals[0]];

  const sorted = intervals.sort((a, b) => a.from.getTime() - b.from.getTime());

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const lastMerged = mergedIntervals[mergedIntervals.length - 1];

    if (
      current.from.getTime() <= lastMerged.to.getTime() &&
      current.possibility === lastMerged.possibility
    ) {
      lastMerged.to = current.to;
    } else {
      mergedIntervals.push(current);
    }
  }

  return mergedIntervals;
};

export const getUkraineUtcOffsetMinutes = (): number => {
  return -getTimezoneOffset('Europe/Kyiv') / 60000;
};
