const db = require('../lib/db');
const { Resend } = require('resend');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;

const RESEND_EMAIL = process.env.RESEND_EMAIL;
const CLIENT_URL = process.env.CLIENT_URL;
const CLOUD_NAME = process.env.CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const userController = {
  /**
   * Update a user
   * @route PUT /api/users/update
   * @param req
   * @param res
   */
  updateProfile: async (req, res) => {
    try {
      const { id } = req.user;
      let { name, email, password, profilePicture, role } = req.body;

      console.log({ id, role });

      // Validate the request
      if (!id) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      // Get the user
      const currentUser = await db.user.findFirst({
        where: { id },
      });

      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      name === '' ? (name = currentUser.name) : name;
      email === '' ? (email = currentUser.email) : email;
      password === '' ? (password = currentUser.password) : password;

      // Upload profile picture to Cloudinary
      if (profilePicture) {
        const uploadedImage = await cloudinary.uploader.upload(profilePicture, {
          folder: 'profile-pictures',
          width: 150,
          height: 150,
          crop: 'fill',
        });

        profilePicture = uploadedImage.secure_url;
      } else {
        profilePicture = currentUser.profilePicture;
      }

      role === '' ? (role = currentUser.role) : role;

      // Update the user
      const updatedUser = await db.user.update({
        where: {
          id: currentUser.id,
        },
        data: {
          name,
          email,
          password,
          profilePicture,
          role,
        },
      });

      // Send a user updated email
      const resend = new Resend(RESEND_API_KEY || '');

      // Send the email
      const { error } = resend.emails.send({
        from: 'onboarding@resend.dev',
        to: RESEND_EMAIL || '',
        subject: 'Profile Updated',
        text: 'Your profile has been updated successfully',
        html: '<p>Your profile has been updated successfully</p>',
      });

      // Send the response
      return res
        .status(200)
        .json({ message: 'User updated successfully', user: updatedUser });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Forgot password
   * @route POST /api/users/forgot-password
   * @param req
   * @param res
   */
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      // Validate the request
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Get the user
      const user = await db.user.findFirst({
        where: { email },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Generate a password reset token
      const token = generateForgotPasswordToken(user);

      // Send a welcome email
      const resend = new Resend(RESEND_API_KEY || '');

      // Send the email
      const { error } = resend.emails.send({
        from: 'onboarding@resend.dev',
        to: RESEND_EMAIL || '',
        subject: 'Password Reset',
        text: `Use this link to reset your password: ${CLIENT_URL}/reset-password/${token}`,
        html: `<p>Use this link to reset your password: <a href="${CLIENT_URL}/reset-password/${token}">Reset Password</a></p>`,
      });

      if (error) {
        console.error('Error sending password reset email:', error);
      }

      // Update the user with the reset token
      await db.user.update({
        where: { id: user.id },
        data: {
          resetToken: token,
        },
      });

      // Send the response
      return res
        .status(200)
        .json({ message: 'Password reset link sent to your email' });
    } catch (error) {
      console.error('Error forgot password:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Reset password
   * @route POST /api/users/reset-password
   * @param req
   * @param res
   */
  resetPassword: async (req, res) => {
    try {
      const { password, confirmPassword } = req.body;
      const { id, resetToken } = req.user;
      const { token } = req.params;

      if (!id) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      if (!token) {
        return res.status(400).json({ message: 'Invalid token' });
      }

      if (resetToken !== token) {
        return res.status(400).json({ message: 'Invalid token' });
      }

      // Validate the request
      const validatePassword = ResetPasswordValidation({
        password,
        confirmPassword,
      });

      if (validatePassword.length > 0) {
        return res.status(400).json({ message: validatePassword.join(', ') });
      }

      const user = await db.user.findFirst({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);

      if (passwordMatch) {
        return res.status(400).json({
          message: 'New password must be different from the current password',
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the user
      const updatedUser = await db.user.update({
        where: { id },
        data: {
          password: hashedPassword,
        },
      });

      // Send a password reset email
      const resend = new Resend(RESEND_API_KEY || '');

      // Send the email
      const { error } = resend.emails.send({
        from: 'onboarding@resend.dev',
        to: RESEND_EMAIL || '',
        subject: 'Password Reset Successful',
        text: 'Your password has been reset successfully',
        html: '<p>Your password has been reset successfully</p>',
      });

      if (error) {
        console.error('Error sending password reset email:', error);
      }

      // Send the response
      return res
        .status(200)
        .json({ message: 'Password reset successfully', user: updatedUser });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Delete a user
   * @route DELETE /api/users/delete
   * @param req
   * @param res
   */
  deleteUser: async (req, res) => {
    try {
      const { id } = req.user;

      // Validate the request
      if (!id) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      // Get the user
      const currentUser = await db.user.findFirst({
        where: { id },
      });

      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Delete the user
      await db.user.delete({
        where: { id },
      });

      // Send a goodbye email
      const resend = new Resend(RESEND_API_KEY || '');

      // Send the email
      const { error } = resend.emails.send({
        from: 'onboarding@resend.dev',
        to: RESEND_EMAIL || '',
        subject: 'Account Deleted',
        text: 'Your account has been deleted successfully',
        html: '<p>Your account has been deleted successfully</p>',
      });

      if (error) {
        console.error('Error sending account deleted email:', error);
      }

      // Send the response
      return res.status(200).json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Enroll user in a course
   * @route POST /api/users/enroll
   * @param req
   * @param res
   */
  enrollCourse: async (req, res) => {
    try {
      const { id } = req.user;
      const { courseId } = req.body;

      // Validate the request
      if (!id) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      if (!courseId) {
        return res.status(400).json({ message: 'Course ID is required' });
      }

      // Get the user
      const user = await db.user.findFirst({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get the course
      const course = await db.course.findFirst({
        where: { id: courseId },
      });

      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      // Already enrolled
      const alreadyEnrolled = await db.enrollment.findFirst({
        where: {
          userId: user.id,
          courseId: course.id,
        },
      });

      if (alreadyEnrolled) {
        return res
          .status(400)
          .json({ message: 'User is already enrolled in the course' });
      }

      // Enroll the user in the course
      const enrollment = await db.enrollment.create({
        data: {
          user: {
            connect: {
              id: user.id,
            },
          },
          course: {
            connect: {
              id: course.id,
            },
          },
        },
      });

      // Send a enrollment email
      const resend = new Resend(RESEND_API_KEY || '');

      // Send the email
      const { error } = resend.emails.send({
        from: 'onboarding@resend.dev',
        to: RESEND_EMAIL || '',
        subject: 'Course Enrollment',
        text: `You have successfully enrolled in ${course.title}`,
        html: `<p>You have successfully enrolled in ${course.title}</p>`,
      });

      if (error) {
        console.error('Error sending enrollment email:', error);
      }

      // Send the response
      return res
        .status(200)
        .json({ message: 'User enrolled in course successfully', enrollment });
    } catch (error) {
      console.error('Error enrolling user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  /**
   * Get user enrollments
   * @route GET /api/users/enrollments
   * @param req
   * @param res
   */
  getUserEnrollments: async (req, res) => {
    try {
      const { id } = req.user;

      // Validate the request
      if (!id) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      // Get the user enrolled courses
      const userCourses = await db.enrollment.findMany({
        where: {
          userId: id,
        },
        include: {
          course: true,
        },
      });

      if (!userCourses) {
        return res.status(404).json({ message: 'Please Enroll in a course' });
      }

      // Send the response
      return res.status(200).json({ userCourses });
    } catch (error) {
      console.error('Error getting user enrollments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
};

const generateForgotPasswordToken = (user) => {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });
};

const ResetPasswordValidation = ({ password, confirmPassword }) => {
  const validationErrors = [];

  switch (true) {
    case !password || !confirmPassword:
      validationErrors.push('Password and confirm password are required');
      break;
    case password !== confirmPassword:
      validationErrors.push('Passwords do not match');
      break;
    case password.length < 6 || password.length > 20:
      validationErrors.push('Password must be between 6 and 20 characters');
      break;
    case !/[a-z]/.test(password):
      validationErrors.push('Password must contain a lowercase letter');
      break;
    case !/[A-Z]/.test(password):
      validationErrors.push('Password must contain an uppercase letter');
      break;
    case !/[0-9]/.test(password):
      validationErrors.push('Password must contain a number');
      break;
    case !/[!@#$%^&*]/.test(password):
      validationErrors.push('Password must contain a special character');
      break;
    case !/^[a-zA-Z0-9!@#$%^&*]+$/.test(password):
      validationErrors.push(
        'Password must contain only alphanumeric characters and special characters'
      );
      break;
    case password.includes(' '):
      validationErrors.push('Password must not contain spaces');
      break;
    default:
      break;
  }

  return validationErrors;
};

module.exports = userController;
