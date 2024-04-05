const router = require('express').Router();
const userController = require('../controllers/user.controllers');
const { auth } = require('../middleware/auth.middleware');

router.put('/update', auth, userController.updateProfile);

router.post('/forgot-password', auth, userController.forgotPassword);

router.post('/reset-password/:token', auth, userController.resetPassword);

router.delete('/delete', auth, userController.deleteUser);

router.post('/enroll', auth, userController.enrollCourse);

router.get('/enrollments', auth, userController.getUserEnrollments);

module.exports = router;
