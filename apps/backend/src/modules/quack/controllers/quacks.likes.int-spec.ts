// Likes over HTTP against the test database: "API behaviour (integration)" in
// cases.md. Each `it` names the case it covers.
import {
  createTestApp,
  SignedInUser,
  TestApp,
} from '@/test/integration/test-app';
import type { Test } from 'supertest';

type QuackJson = {
  id: string;
  deleted: boolean;
  likeCount: number;
  likedByMe: boolean;
};

describe('Likes API', () => {
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

  const post = async (
    author: SignedInUser,
    text: string,
    parentId?: string,
  ): Promise<string> => {
    const response = await author.agent
      .post('/api/quacks')
      .send(parentId ? { text, parentId } : { text })
      .expect(201);
    return response.body.id as string;
  };

  const like = (user: SignedInUser, quackId: string): Test =>
    user.agent.put(`/api/quacks/${quackId}/like`);

  const unlike = (user: SignedInUser, quackId: string): Test =>
    user.agent.delete(`/api/quacks/${quackId}/like`);

  const inFeed = async (
    viewer: SignedInUser,
    quackId: string,
    query: Record<string, string> = {},
  ): Promise<QuackJson | undefined> => {
    const response = await viewer.agent
      .get('/api/quacks')
      .query(query)
      .expect(200);
    return (response.body as QuackJson[]).find((q) => q.id === quackId);
  };

  const likeRows = (quackId: string): Promise<number> =>
    t.prisma.quackLike.count({ where: { quackId } });

  // Case: Signed out.
  it('answers 401 to like and unlike when signed out', async () => {
    const author = await t.signUp();
    const quackId = await post(author, 'Pond is warm today');

    await t.anonymous().put(`/api/quacks/${quackId}/like`).expect(401);
    await t.anonymous().delete(`/api/quacks/${quackId}/like`).expect(401);
  });

  // Case: Like.
  it("likes someone else's quack and shows it in the feed", async () => {
    const author = await t.signUp();
    const me = await t.signUp();
    const quackId = await post(author, 'Bread at noon');

    const response = await like(me, quackId).expect(200);

    expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
    expect(await inFeed(me, quackId)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
  });

  // Case: Like twice.
  it('keeps one like when liking twice', async () => {
    const author = await t.signUp();
    const me = await t.signUp();
    const quackId = await post(author, 'Bread at noon');

    await like(me, quackId).expect(200);
    const response = await like(me, quackId).expect(200);

    expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
    expect(await likeRows(quackId)).toBe(1);
  });

  // Case: Unlike.
  it('removes the like on unlike', async () => {
    const author = await t.signUp();
    const me = await t.signUp();
    const quackId = await post(author, 'Bread at noon');
    await like(me, quackId).expect(200);

    const response = await unlike(me, quackId).expect(200);

    expect(response.body).toEqual({ likeCount: 0, likedByMe: false });
    expect(await inFeed(me, quackId)).toMatchObject({
      likeCount: 0,
      likedByMe: false,
    });
  });

  // Case: Unlike without a like.
  it('changes nothing when unliking a quack I have not liked', async () => {
    const author = await t.signUp();
    const me = await t.signUp();
    const quackId = await post(author, 'Bread at noon');

    const response = await unlike(me, quackId).expect(200);

    expect(response.body).toEqual({ likeCount: 0, likedByMe: false });
  });

  // Case: Own quack.
  it('lets the author like their own quack', async () => {
    const me = await t.signUp();
    const quackId = await post(me, 'My own quack');

    const response = await like(me, quackId).expect(200);

    expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
  });

  // Case: Per viewer.
  it('counts every like but marks only the viewer’s own', async () => {
    const author = await t.signUp();
    const a = await t.signUp();
    const b = await t.signUp();
    const c = await t.signUp();
    const quackId = await post(author, 'Who likes ducks?');
    await like(a, quackId).expect(200);
    await like(b, quackId).expect(200);

    expect(await inFeed(a, quackId)).toMatchObject({
      likeCount: 2,
      likedByMe: true,
    });
    expect(await inFeed(b, quackId)).toMatchObject({
      likeCount: 2,
      likedByMe: true,
    });
    expect(await inFeed(c, quackId)).toMatchObject({
      likeCount: 2,
      likedByMe: false,
    });
  });

  // Case: Replies.
  it('likes a reply and shows it in the thread', async () => {
    const author = await t.signUp();
    const replier = await t.signUp();
    const me = await t.signUp();
    const quackId = await post(author, 'Pond meeting at noon');
    const replyId = await post(replier, 'I will bring bread', quackId);

    await like(me, replyId).expect(200);

    const thread = await me.agent
      .get(`/api/quacks/${quackId}/thread`)
      .expect(200);
    const reply = (thread.body.descendants as QuackJson[]).find(
      (q) => q.id === replyId,
    );
    expect(reply).toMatchObject({ likeCount: 1, likedByMe: true });
    expect(thread.body.focus).toMatchObject({
      likeCount: 0,
      likedByMe: false,
    });
  });

  // Case: Search and Mine.
  it('shows the same likes in search and in Mine', async () => {
    const me = await t.signUp();
    const other = await t.signUp();
    const quackId = await post(me, 'Searchable mallard');
    await like(me, quackId).expect(200);
    await like(other, quackId).expect(200);

    expect(await inFeed(me, quackId, { q: 'mallard' })).toMatchObject({
      likeCount: 2,
      likedByMe: true,
    });
    expect(await inFeed(me, quackId, { mine: 'true' })).toMatchObject({
      likeCount: 2,
      likedByMe: true,
    });
  });

  // Case: Unknown quack.
  it('answers 404 for a quack that does not exist', async () => {
    const me = await t.signUp();

    await like(me, 'no-such-quack').expect(404);
    await unlike(me, 'no-such-quack').expect(404);
  });

  // Case: Tombstone.
  it('answers 409 for a deleted quack and shows it without likes', async () => {
    const author = await t.signUp();
    const replier = await t.signUp();
    const me = await t.signUp();
    const quackId = await post(author, 'Soon gone');
    await post(replier, 'A reply keeps it as a tombstone', quackId);
    await author.agent.delete(`/api/quacks/${quackId}`).expect(204);

    await like(me, quackId).expect(409);
    await unlike(me, quackId).expect(409);

    const thread = await me.agent
      .get(`/api/quacks/${quackId}/thread`)
      .expect(200);
    expect(thread.body.focus).toMatchObject({
      deleted: true,
      likeCount: 0,
      likedByMe: false,
    });
    expect(await likeRows(quackId)).toBe(0);
  });

  // Case: Delete without replies.
  it('removes the likes with a quack that is deleted completely', async () => {
    const author = await t.signUp();
    const me = await t.signUp();
    const quackId = await post(author, 'No replies here');
    await like(me, quackId).expect(200);

    await author.agent.delete(`/api/quacks/${quackId}`).expect(204);

    expect(await t.prisma.quack.count({ where: { id: quackId } })).toBe(0);
    expect(await likeRows(quackId)).toBe(0);
  });

  // Case: Delete with replies.
  it('removes the likes of a quack that becomes a tombstone', async () => {
    const author = await t.signUp();
    const replier = await t.signUp();
    const me = await t.signUp();
    const quackId = await post(author, 'Liked, then deleted');
    await post(replier, 'Still here', quackId);
    await like(me, quackId).expect(200);
    await like(replier, quackId).expect(200);

    await author.agent.delete(`/api/quacks/${quackId}`).expect(204);

    const row = await t.prisma.quack.findUnique({ where: { id: quackId } });
    expect(row?.deletedAt).not.toBeNull();
    expect(await likeRows(quackId)).toBe(0);
  });
});
