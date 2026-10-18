import { QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreatePollDto } from './create-poll.dto';

export class CreateQuackDto {
  @ApiProperty({
    description: 'Body of the quack',
    example: 'Hello, world!',
    maxLength: 280,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  text!: string;

  @ApiPropertyOptional({
    description: 'How the author feels about the quack',
    enum: QUACK_MOODS,
    example: 'silly',
  })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  mood?: QuackMood;

  @ApiPropertyOptional({
    description: 'Attach a poll; the text of the quack is the question',
    type: CreatePollDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto;
}
