import { DateArray } from 'ics';

export function getDateArray(date: Date): DateArray {
  return [
    date.getFullYear(), // Year
    date.getMonth() + 1, // Month (adjusted for 0-indexing)
    date.getDate(), // Day
    date.getHours(), // Hour
    date.getMinutes(), // Minute
  ];
}
