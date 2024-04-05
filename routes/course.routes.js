const router = require('express').Router();
const { auth, checkAdmin } = require('../middleware/auth.middleware');
const courseController = require('../controllers/course.controllers');

router.post('/create-course', checkAdmin, courseController.createCourse);

router.get('/get-courses', auth, courseController.getCourses);

router.get('/get-course/:id', auth, courseController.getCourse);

router.put('/update-course/:id', checkAdmin, courseController.updateCourse);

router.delete('/delete-course/:id', checkAdmin, courseController.deleteCourse);

module.exports = router;
