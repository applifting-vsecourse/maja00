import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ListQuacksQueryDto } from './list-quacks-query.dto';

const check = async (
  query: Record<string, unknown>,
): Promise<{ dto: ListQuacksQueryDto; errors: ValidationError[] }> => {
  const dto = plainToInstance(ListQuacksQueryDto, query);
  return { dto, errors: await validate(dto) };
};

describe('ListQuacksQueryDto', () => {
  it('accepts a missing query', async () => {
    const { errors } = await check({});
    expect(errors).toHaveLength(0);
  });

  it.each(['', '   '])('treats %j as no search', async (q) => {
    const { dto, errors } = await check({ q });
    expect(errors).toHaveLength(0);
    expect(dto.q).toBeUndefined();
  });

  it('trims the query', async () => {
    const { dto, errors } = await check({ q: '  duck pond ' });
    expect(errors).toHaveLength(0);
    expect(dto.q).toBe('duck pond');
  });

  it('rejects a single character', async () => {
    const { errors } = await check({ q: ' d ' });
    expect(errors).toHaveLength(1);
  });

  it('accepts exactly 100 characters and rejects 101', async () => {
    expect((await check({ q: 'a'.repeat(100) })).errors).toHaveLength(0);
    expect((await check({ q: 'a'.repeat(101) })).errors).toHaveLength(1);
  });

  it('rejects a repeated parameter (an array)', async () => {
    const { errors } = await check({ q: ['duck', 'pond'] });
    expect(errors).toHaveLength(1);
  });
});
