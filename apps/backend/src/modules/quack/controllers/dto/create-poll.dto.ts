import {
  POLL_MAX_DURATION_MINUTES,
  POLL_MAX_OPTIONS,
  POLL_MIN_DURATION_MINUTES,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
} from '@/modules/quack/domain/poll';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePollDto {
  @ApiProperty({
    description: 'The answers to choose from, in display order',
    example: ['Pizza', 'Ramen', 'Salad'],
    minItems: POLL_MIN_OPTIONS,
    maxItems: POLL_MAX_OPTIONS,
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(POLL_MIN_OPTIONS)
  @ArrayMaxSize(POLL_MAX_OPTIONS)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((v: unknown) => (typeof v === 'string' ? v.trim() : v))
      : value,
  )
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(POLL_OPTION_MAX_LENGTH, { each: true })
  options!: string[];

  @ApiProperty({
    description:
      'How long the poll stays open, in whole minutes, at most 7 days',
    example: 1440,
    minimum: POLL_MIN_DURATION_MINUTES,
    maximum: POLL_MAX_DURATION_MINUTES,
  })
  @IsInt()
  @Min(POLL_MIN_DURATION_MINUTES)
  @Max(POLL_MAX_DURATION_MINUTES)
  durationMinutes!: number;
}
