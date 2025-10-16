import querystring from 'querystring';

export const getSubscriptionArgs = (
  cityId: string,
  streetId: string,
  houseId: string,
) => {
  return querystring.stringify({ cityId, streetId, houseId });
};
