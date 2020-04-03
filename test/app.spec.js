const app = require('../src/app');
const knex = require('knex');
const {
  makeBookmarksArray,
  makeMaliciousBookmark
} = require('./bookmarks.fixtures');

describe('app, bookmarks-router', () => {
  let db;

  before('make a knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('clean the table', () => db('bookmarks').truncate());

  afterEach('clean up the table', () => db('bookmarks').truncate());

  describe('GET /api/bookmarks', () => {
    context(`given there are no bookmarks in the database`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get('/api/bookmarks')
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .expect(200, []);
      });
    });

    context(`given there are bookmarks in the database`, () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach('insert bookmarks', () => {
        return db.into('bookmarks').insert(testBookmarks);
      });

      it('should return a list of bookmarks', () => {
        return supertest(app)
          .get('/api/bookmarks')
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            expect(res.body).to.be.an('array');
            expect(res.body[0]).to.be.an('object');
            expect(res.body[0]).to.have.all.keys(
              'id',
              'title',
              'site_url',
              'site_description',
              'rating'
            );
          });
      });
    });

    context(`Given an XSS attack article`, () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      beforeEach('insert malicious bookmark', () => {
        return db.into('bookmarks').insert([maliciousBookmark]);
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get('/api/bookmarks')
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .expect(200)
          .expect(res => {
            expect(res.body[0].title).to.eql(expectedBookmark.title);
            expect(res.body[0].site_description).to.eql(
              expectedBookmark.site_description
            );
          });
      });
    });
  });

  describe('GET /api/bookmarks/:id', () => {
    context(`given there are bookmarks in the database`, () => {
      const testBookmarks = makeBookmarksArray();
      beforeEach('insert bookmarks', () => {
        return db.into('bookmarks').insert(testBookmarks);
      });

      it('should return a specific bookmark with id', () => {
        const bookmarkId = 1;
        return supertest(app)
          .get(`/api/bookmarks/${bookmarkId}`)
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.all.keys(
              'id',
              'title',
              'site_url',
              'site_description',
              'rating'
            );
          });
      });
      it('should return an error if id is invalid', () => {
        return supertest(app)
          .get('/api/bookmarks/12345678')
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .expect(404);
      });
    });

    context(`Given an XSS attack article`, () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      beforeEach('insert malicious bookmark', () => {
        return db.into('bookmarks').insert([maliciousBookmark]);
      });

      it('removes CSS attack content', () => {
        return supertest(app)
          .get(`/api/bookmarks/${maliciousBookmark.id}`)
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .expect(200)
          .expect(res => {
            expect(res.body.title).to.eql(expectedBookmark.title);
            expect(res.body.site_description).to.eql(
              expectedBookmark.site_description
            );
          });
      });
    });
  });

  describe('POST /api/bookmarks', () => {
    const validBookmark = {
      title: 'Google',
      site_url: 'https://www.google.com/',
      site_description: 'The best search engine. Period.',
      rating: 5
    };

    it('should create a new bookmark when all params valid', () => {
      return supertest(app)
        .post('/api/bookmarks')
        .set('Authorization', 'bearer ' + process.env.API_KEY)
        .send(validBookmark)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.eql(validBookmark.title);
          expect(res.body.site_url).to.eql(validBookmark.site_url);
          expect(res.body.site_description).to.eql(
            validBookmark.site_description
          );
          expect(res.body.rating).to.eql(validBookmark.rating);
          expect(res.headers.location).to.eql(`/api/bookmarks/${res.body.id}`);
        })
        .then(res =>
          supertest(app)
            .get(`/api/bookmarks/${res.body.id}`)
            .set('Authorization', 'bearer ' + process.env.API_KEY)
            .expect(res.body)
        );
    });

    ['title', 'site_url'].forEach(key => {
      it(`should send back a 400 error if ${key} is not provided`, () => {
        const invalidBookmark = { ...validBookmark, [key]: '' };
        return supertest(app)
          .post('/api/bookmarks')
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .send(invalidBookmark)
          .expect(400);
      });
    });

    it('should send back a 400 error if rating is not between 1 and 5', () => {
      const invalidBookmark = { ...validBookmark, rating: 500 };
      return supertest(app)
        .post('/api/bookmarks')
        .set('Authorization', 'bearer ' + process.env.API_KEY)
        .send(invalidBookmark)
        .expect(400);
    });

    it('should send back a 400 error is the url is less than 5 chars', () => {
      const invalidBookmark = { ...validBookmark, site_url: 'http' };
      return supertest(app)
        .post('/api/bookmarks')
        .set('Authorization', 'bearer ' + process.env.API_KEY)
        .send(invalidBookmark)
        .expect(400);
    });

    it('removes XSS attack content from a response', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();
      return supertest(app)
        .post('/api/bookmarks')
        .set('Authorization', 'bearer ' + process.env.API_KEY)
        .send(maliciousBookmark)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.eql(expectedBookmark.title);
          expect(res.body.site_description).to.eql(
            expectedBookmark.site_description
          );
        });
    });
  });

  describe('DELETE /bookmarks/:id', () => {
    context(`Given there are bookmarks in the database`, () => {
      const testBookmarks = makeBookmarksArray();
      beforeEach('insert bookmarks', () => {
        return db.into('bookmarks').insert(testBookmarks);
      });

      it('deletes a bookmark when provided a valid id', () => {
        const bookmarkId = 2;
        return supertest(app)
          .delete(`/api/bookmarks/${bookmarkId}`)
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .expect(204);
      });
    });

    context(`Given there are no bookmarks in the database`, () => {
      it('sends back a 404 error when bookmark with id cannot be found', () => {
        const invalidId = 123456;
        return supertest(app)
          .delete(`/api/bookmarks/${invalidId}`)
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .expect(404);
      });
    });
  });

  describe.only(`PATCH /api/bookmarks/:id`, () => {
    context(`Given no bookmarks`, () => {
      it(`returns 404 when bookmark with id does not exist`, () => {
        const bookmarkId = 123456789;
        return supertest(app)
          .patch(`/api/bookmarks/${bookmarkId}`)
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .expect(404, {
            error: { message: `Bookmark doesn't exist` }
          });
      });
    });
    context(`Given there are bookmarks in the db`, () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach('insert bookmarks into table', () => {
        return db.into('bookmarks').insert(testBookmarks);
      });

      it(`responds with 204 and updates the bookmark with id`, () => {
        const targetId = 2;
        const updateBookamrk = {
          title: 'updated title',
          site_description: 'updated description',
          site_url: 'https://imanewurl.com/',
          rating: 5
        };
        const expectedBookmark = {
          ...testBookmarks[targetId - 1],
          ...updateBookamrk
        };
        return supertest(app)
          .patch(`/api/bookmarks/${targetId}`)
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .send(updateBookamrk)
          .expect(204)
          .then(res => {
            supertest(app)
              .get(`/api/bookmarks/${targetId}`)
              .expect(expectedBookmark);
          });
      });

      it(`responds with 204 and updates the bookmark with only a specific set of fields`, () => {
        const targetId = 2;
        const updateBookamrk = {
          site_description: 'updated description'
        };
        const expectedBookmark = {
          ...testBookmarks[targetId - 1],
          ...updateBookamrk
        };
        return supertest(app)
          .patch(`/api/bookmarks/${targetId}`)
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .send({
            ...updateBookamrk,
            fieldToIgnore: 'should not appear in GET resposne'
          })
          .expect(204)
          .then(res => {
            supertest(app)
              .get(`/api/bookmarks/${targetId}`)
              .expect(expectedBookmark);
          });
      });

      it(`responds with 400 when no required fields are provided`, () => {
        const targetId = 2;
        return supertest(app)
          .patch(`/api/bookmarks/${targetId}`)
          .set('Authorization', 'bearer ' + process.env.API_KEY)
          .send({ totallyWrongField: 'This definitely is not right' })
          .expect(400, {
            error: {
              message: `Request body must contain either 'title', 'site_description', 'site_url', or 'rating'`
            }
          });
      });
    });
  });
});
