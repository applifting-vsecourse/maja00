import { createTestApp, TestApp } from '@/test/integration/test-app';

describe('GET /api/quacks', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await t.reset();
  });

  afterAll(async () => {
    await t.close();
  });

  it('returns 401 when signed out', async () => {
    await t.anonymous().get('/api/quacks').expect(401);
  });

  it('returns 200 and the feed when signed in', async () => {
    const { agent } = await t.signUp();

    const response = await agent.get('/api/quacks').expect(200);

    expect(response.body).toEqual([]);
  });
});
