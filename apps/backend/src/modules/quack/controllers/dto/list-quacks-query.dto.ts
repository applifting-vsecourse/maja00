import {
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
} from '@/modules/quack/domain/quack-search';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ListQuacksQueryDto {
  @ApiPropertyOptional({
    description:
      'Only return quacks matching every word, in the text or the author name/username. Ignores case and accents. Blank means no filter.',
    example: 'duck pond',
    minLength: SEARCH_MIN_LENGTH,
    maxLength: SEARCH_MAX_LENGTH,
  })
  // A blank query is "no search", not a too-short one.
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  })
  @IsOptional()
  @IsString()
  @MinLength(SEARCH_MIN_LENGTH)
  @MaxLength(SEARCH_MAX_LENGTH)
  q?: string;
}
