const express = require('express');
const bookmarksData = require('../store/store');
const uuid = require('uuid/v4');
const logger = require('../logger');
const BookmarksService = require('../bookmarks-service');

const bookmarksRouter = express.Router();
const bodyParser = express.json();

bookmarksRouter
  .route('/')
  .get((req, res, next) => {
    const knexInstance = req.app.get('db');
    BookmarksService.getAllBookmarks(knexInstance)
      .then(bookmarks => {
        res.json(bookmarks);
      })
      .catch(next);
  })
  .post(bodyParser, (req, res) => {
    const { title, url, desc = '', rating = 1 } = req.body;
    if (!title) {
      logger.error('Title is required');
      return res.status(400).send('Title is required');
    }
    if (!url) {
      logger.error('Url is required');
      return res.status(400).send('Url is required');
    }
    if (url.length < 5) {
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

    const id = uuid();
    const bookmark = {
      id,
      title,
      url,
      desc,
      rating
    };

    bookmarksData.push(bookmark);
    logger.info(`Bookmark with id ${id} created`);
    res
      .status(201)
      .location(`http://localhost:8000/bookmarks/${id}`)
      .json(bookmark);
  });

bookmarksRouter
  .route('/:id')
  .get((req, res, next) => {
    const { id } = req.params;
    const knexInstance = req.app.get('db');
    BookmarksService.getBookmarkById(knexInstance, id)
      .then(bookmark => {
        if (!bookmark) {
          return res
            .status(404)
            .json({ error: { message: `Bookmark does not exist` } });
        }
        res.json(bookmark);
      })
      .catch(next);
  })
  .delete((req, res) => {
    const { id } = req.params;
    const bookIndex = bookmarksData.findIndex(
      bookmarkId => bookmarkId.id === id
    );

    if (bookIndex === -1) {
      logger.error(`Bookmark with id ${id} not found`);
      return res.status(404).send('Id not found');
    }

    bookmarksData.splice(bookIndex, 1);
    logger.info(`Bookmark with id ${id} deleted`);
    res.status(204).end();
  });

module.exports = bookmarksRouter;
