const express = require('express');
const router  = express.Router();
const {
  getStats, getUsers, getUserDetail, updateUser,
  getSettings, putSetting, removeSetting,
} = require('../controllers/admin.controller');
const { protect, requireAdmin } = require('../middleware/auth.middleware');

// Every route here requires a verified admin session.
router.use(protect, requireAdmin);

router.get('/stats',            getStats);
router.get('/users',            getUsers);
router.get('/users/:id',        getUserDetail);
router.patch('/users/:id',      updateUser);
router.get('/settings',         getSettings);
router.put('/settings/:key',    putSetting);
router.delete('/settings/:key', removeSetting);

module.exports = router;
