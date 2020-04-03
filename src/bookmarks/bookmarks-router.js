const path = require('path');
const express = require('express');
const xss = require('xss');
const logger = require('../logger');
const BookmarksService = require('../bookmarks-service');

const bookmarksRouter = express.Router();
const bodyParser = express.json();

const serializeBookmark = bookmark => ({
  id: bookmark.id,
  title: xss(bookmark.title),
  site_url: xss(bookmark.site_url),
  site_description: xss(bookmark.site_description),
  rating: bookmark.rating
});

bookmarksRouter
  .route('/')
  .get((req, res, next) => {
    const knexInstance = req.app.get('db');
    BookmarksService.getAllBookmarks(knexInstance)
      .then(bookmarks => {
        res.json(bookmarks.map(serializeBookmark));
      })
      .catch(next);
  })
  .post(bodyParser, (req, res) => {
    const { title, site_url, site_description = '', rating = 1 } = req.body;

    if (!title) {
      logger.error('Title is required');
      return res.status(400).send('Title is required');
    }
    if (!site_url) {
      logger.error('Url is required');
      return res.status(400).send('Url is required');
    }
    if (site_url.length < 5) {
      logger.error('Url length is wrong');
      return res.status(400).send('Url length must be 5 or greater');
    }
    if (!Number(rating)) {
      logger.error('Rating is not a number');
      return res.status(400).send('Rating must be a number');
    }
    if (+rating < 1 || +rating > 5) {
      logger.error('Rating is not between 1 and 5');
      return res
        .status(400)
        .send('Rating cannot be less than 1 or greater than 5');
    }

    const newBookmark = {
      title,
      site_url,
      site_description,
      rating
    };

    BookmarksService.insertBookmark(req.app.get('db'), newBookmark).then(
      bookmark => {
        logger.info(`Bookmark with id of ${bookmark.id} created`);
        res
          .status(201)
          .location(path.posix.join(req.originalUrl + `/${bookmark.id}`))
          .json(serializeBookmark(bookmark));
      }
    );
  });

bookmarksRouter
  .route('/:id')
  .all((req, res, next) => {
    BookmarksService.getBookmarkById(req.app.get('db'), req.params.id)
      .then(bookmark => {
        if (!bookmark) {
          return res.status(404).json({
            error: { message: `Bookmark doesn't exist` }
          });
        }
        res.bookmark = bookmark;
        next();
      })
      .catch(next);
  })
  .get((req, res, next) => {
    res.json(serializeBookmark(res.bookmark));
  })
  .delete((req, res, next) => {
    BookmarksService.deleteBookmark(req.app.get('db'), req.params.id)
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  })
  .patch(bodyParser, (req, res, next) => {
    const { title, site_description, site_url, rating } = req.body;
    const bookmarkToUpdate = { title, site_description, site_url, rating };

    const numberOfValues = Object.values(bookmarkToUpdate).filter(Boolean)
      .length;
    if (numberOfValues === 0) {
      return res.status(400).json({
        error: {
          message: `Request body must contain either 'title', 'site_description', 'site_url', or 'rating'`
        }
      });
    }

    BookmarksService.updateBookmark(
      req.app.get('db'),
      req.params.id,
      bookmarkToUpdate
    )
      .then(numRowsAffected => {
        res.status(204).end();
      })
      .catch(next);
  });

module.exports = bookmarksRouter;
