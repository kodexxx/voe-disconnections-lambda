import { IsBoolean, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetCalendarQueryDto {
  @IsString()
  cityId: string;

  @IsString()
  streetId: string;

  @IsString()
  houseId: string;

  @IsBoolean()
  @Type(() => Boolean)
  json = false;
}
