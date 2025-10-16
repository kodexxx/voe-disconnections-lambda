import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

export const getPayload = async <D extends object>(
  data: any,
  payloadCls?: ClassConstructor<D>,
): Promise<D> => {
  if (!payloadCls) {
    return data;
  }
  if (!data) {
    throw new Error('Incorrect payload');
  }
  const obj = plainToInstance(payloadCls, data);
  try {
    await validateOrReject(obj, {
      whitelist: true,
      forbidUnknownValues: true,
    });
    return obj;
  } catch (e) {
    throw e;
  }
};
