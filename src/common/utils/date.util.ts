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
