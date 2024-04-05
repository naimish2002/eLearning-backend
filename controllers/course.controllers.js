const db = require('../lib/db');

const courseController = {
  /**
   * Create a new course
   * @route POST /api/courses/create-course
   * @param req
   * @param res
   */
  createCourse: async (req, res) => {
    try {
      const {
        title,
        category,
        level,
        description,
        instructor,
        duration,
        price,
      } = req.body;

      // Validate input
      const validationErrors = validateCourseRequest(req.body);

      if (validationErrors.length > 0) {
        return res.status(400).json({ message: validationErrors.join(', ') });
      }

      // Create the course
      const course = await db.course.create({
        data: {
          title,
          category,
          level,
          description,
          instructor,
          duration,
          price,
          createdBy: { connect: { id: req.user.id } },
        },
      });

      return res
        .status(201)
        .json({ message: 'Course created successfully', course });
    } catch (error) {
      console.error('Error creating course:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Get all courses
   * @route GET /api/courses/get-courses
   * @param req
   * @param res
   */
  getCourses: async (req, res) => {
    try {
      // Get query parameters
      const { title, category, level, page = 1, limit = 10 } = req.query;

      //Define pagination options
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Define filter options
      const where = {
        ...(category && { category: { equals: category } }),
        ...(level && { level: { equals: level } }),
        ...(title && { title: { contains: title } }),
      };

      // Get courses
      const courses = await db.course.findMany({
        where,
        skip,
        take,
      });

      return res.status(200).json({ courses });
    } catch (error) {
      console.error('Error getting courses:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Get a course by ID
   * @route GET /api/courses/get-course/:id
   * @param req
   * @param res
   */
  getCourse: async (req, res) => {
    try {
      const { id } = req.params;

      // Get the course
      const course = await db.course.findUnique({
        where: { id },
      });

      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      return res.status(200).json({ course });
    } catch (error) {
      console.error('Error getting course:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Update a course
   * @route PUT /api/courses/update-course/:id
   * @param req
   * @param res
   */
  updateCourse: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        category,
        level,
        description,
        instructor,
        duration,
        price,
      } = req.body;

      // Find the course
      const courseExists = await db.course.findUnique({
        where: { id },
      });

      if (!courseExists) {
        return res.status(404).json({ message: 'Course not found' });
      }

      // Default to existing values if not provided
      title === '' ? courseExists.title : title;
      category === '' ? courseExists.category : category;
      level === '' ? courseExists.level : level;
      description === '' ? courseExists.description : description;
      instructor === '' ? courseExists.instructor : instructor;
      duration === '' ? courseExists.duration : duration;
      price === '' ? courseExists.price : price;

      // Update the course
      const course = await db.course.update({
        where: { id: courseExists.id },
        data: {
          title,
          category,
          level,
          description,
          instructor,
          duration,
          price,
        },
      });

      return res
        .status(200)
        .json({ message: 'Course updated successfully', course });
    } catch (error) {
      console.error('Error updating course:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Delete a course
   * @route DELETE /api/courses/delete-course/:id
   * @param req
   * @param res
   */
  deleteCourse: async (req, res) => {
    try {
      const { id } = req.params;

      // Find the course
      const courseExists = await db.course.findUnique({
        where: { id },
      });

      if (!courseExists) {
        return res.status(404).json({ message: 'Course not found' });
      }

      // Delete the course
      await db.course.delete({
        where: { id },
      });

      return res.status(200).json({ message: 'Course deleted successfully' });
    } catch (error) {
      console.error('Error deleting course:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
};

//Validate New Course Request
const validateCourseRequest = (body) => {
  const { title, category, level, description, instructor, duration, price } =
    body;
  const validationErrors = [];

  switch (true) {
    case !title ||
      !category ||
      !level ||
      !description ||
      !instructor ||
      !duration ||
      !price:
      validationErrors.push('Please provide all required fields');
      break;
    case title.length < 3:
      validationErrors.push('Title must be at least 3 characters');
      break;
    case description.length < 10:
      validationErrors.push('Description must be at least 10 characters');
      break;
    case duration < 10:
      validationErrors.push('Duration must be at least 10 minute');
      break;
    case price < 0:
      validationErrors.push('Price must be at least $0');
    case !['BEGINNER', 'INTERMEDIATE', 'Expert'].includes(level):
      validationErrors.push(
        'Level must be beginner, intermediate, or advanced'
      );
      break;
    default:
      break;
  }

  return validationErrors;
};

module.exports = courseController;
