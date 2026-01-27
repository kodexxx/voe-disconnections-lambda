import * as querystring from 'querystring';
import axios, { AxiosInstance } from 'axios';
import { Config } from '../config';
import { randomChoice } from '../common/utils/array.utils';
import {DisconnectionsResultInterface} from "../disconnections/interfaces/disconnections.result.interface";

export class VoeFetcherService {
  private readonly axiosInstance: AxiosInstance;
  private readonly proxyUrls = Config.VOE_PROXY_URL;

  constructor() {
    // Initialize axios for voe-proxy-app requests
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  async getDisconnections(
    cityId: string,
    streetId: string,
    houseId: string,
  ): Promise<DisconnectionsResultInterface> {
    const proxyUrl = randomChoice(this.proxyUrls);
    if (!proxyUrl) {
      throw new Error('No VOE_PROXY_URL configured');
    }

    const params = querystring.stringify({
      cityId,
      streetId,
      houseId,
    });

    const url = `${proxyUrl}/disconnections?${params}`;
    console.log('Fetching disconnections from voe-proxy:', url);

    const response = await this.axiosInstance.get(url);

    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to fetch disconnections');
    }

    return {
      intervals: response?.data?.data ?? [],
      queueName: response?.data?.queueName
    }
  }

  async getCityByName(
    cityName: string,
  ): Promise<{ id: string; name: string }[]> {
    const proxyUrl = randomChoice(this.proxyUrls);
    if (!proxyUrl) {
      throw new Error('No VOE_PROXY_URL configured');
    }

    const params = querystring.stringify({
      q: cityName,
    });
    const url = `${proxyUrl}/autocomplete/city?${params}`;
    console.log('Fetching cities from voe-proxy:', url);

    const response = await this.axiosInstance.get(url);

    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to fetch cities');
    }

    return response.data.cities || [];
  }

  async getStreetByName(
    cityId: string,
    streetName: string,
  ): Promise<{ id: string; name: string }[]> {
    const proxyUrl = randomChoice(this.proxyUrls);
    if (!proxyUrl) {
      throw new Error('No VOE_PROXY_URL configured');
    }

    const params = querystring.stringify({
      cityId,
      q: streetName,
    });
    const url = `${proxyUrl}/autocomplete/street?${params}`;
    console.log('Fetching streets from voe-proxy:', url);

    const response = await this.axiosInstance.get(url);

    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to fetch streets');
    }

    return response.data.streets || [];
  }

  async getHouseByName(
    streetId: string,
    houseName: string,
  ): Promise<{ id: string; name: string }[]> {
    const proxyUrl = randomChoice(this.proxyUrls);
    if (!proxyUrl) {
      throw new Error('No VOE_PROXY_URL configured');
    }

    const params = querystring.stringify({
      streetId,
      q: houseName,
    });
    const url = `${proxyUrl}/autocomplete/house?${params}`;
    console.log('Fetching houses from voe-proxy:', url);

    const response = await this.axiosInstance.get(url);

    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to fetch houses');
    }

    return response.data.houses || [];
  }
}
