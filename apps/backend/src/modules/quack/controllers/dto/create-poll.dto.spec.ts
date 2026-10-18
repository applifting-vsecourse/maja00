import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePollDto } from './create-poll.dto';

const errorsFor = async (input: object): Promise<string[]> => {
  const errors = await validate(plainToInstance(CreatePollDto, input));
  return errors.map((error) => error.property);
};

const valid = { options: ['Pizza', 'Ramen'], durationMinutes: 90 };

describe('CreatePollDto', () => {
  it('accepts a valid poll', async () => {
    await expect(errorsFor(valid)).resolves.toEqual([]);
  });

  it('accepts from one minute up to exactly seven days', async () => {
    await expect(errorsFor({ ...valid, durationMinutes: 1 })).resolves.toEqual(
      [],
    );
    await expect(
      errorsFor({ ...valid, durationMinutes: 7 * 24 * 60 }),
    ).resolves.toEqual([]);
  });

  it('rejects zero minutes, more than seven days and fractions', async () => {
    for (const durationMinutes of [0, 7 * 24 * 60 + 1, 1.5, -5]) {
      await expect(errorsFor({ ...valid, durationMinutes })).resolves.toEqual([
        'durationMinutes',
      ]);
    }
  });

  it('allows 2 to 4 options', async () => {
    await expect(errorsFor({ ...valid, options: ['a'] })).resolves.toEqual([
      'options',
    ]);
    await expect(
      errorsFor({ ...valid, options: ['a', 'b', 'c', 'd', 'e'] }),
    ).resolves.toEqual(['options']);
  });

  it('trims options and rejects blank or overlong ones', async () => {
    await expect(
      errorsFor({ ...valid, options: ['a', '   '] }),
    ).resolves.toEqual(['options']);
    await expect(
      errorsFor({ ...valid, options: ['a', 'x'.repeat(51)] }),
    ).resolves.toEqual(['options']);
    await expect(
      errorsFor({ ...valid, options: ['a', 'x'.repeat(50)] }),
    ).resolves.toEqual([]);
  });
});
