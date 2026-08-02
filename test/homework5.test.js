import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import { Segments } from 'celebrate';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import nodemailer from 'nodemailer';
import {
  requestResetEmail,
  resetPassword,
} from '../src/controllers/authController.js';
import { updateUserAvatar } from '../src/controllers/userController.js';
import { upload } from '../src/middleware/multer.js';
import { User } from '../src/models/user.js';
import { saveFileToCloudinary } from '../src/utils/saveFileToCloudinary.js';
import { sendEmail } from '../src/utils/sendMail.js';
import {
  requestResetEmailSchema,
  resetPasswordSchema,
} from '../src/validations/authValidation.js';

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const setTestEmailEnvironment = () => {
  process.env.JWT_SECRET = 'homework-five-test-secret';
  process.env.FRONTEND_DOMAIN = 'http://localhost:3001/';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'smtp-user';
  process.env.SMTP_PASSWORD = 'smtp-password';
  process.env.SMTP_FROM = 'sender@example.com';
};

test('reset request and password bodies have the required validation', () => {
  const validEmail = requestResetEmailSchema[Segments.BODY].validate({
    email: 'user@example.com',
  });
  const invalidEmail = requestResetEmailSchema[Segments.BODY].validate({
    email: 'not-an-email',
  });
  const validPasswordReset = resetPasswordSchema[Segments.BODY].validate({
    password: '12345678',
    token: 'jwt-token',
  });
  const shortPasswordReset = resetPasswordSchema[Segments.BODY].validate({
    password: '1234567',
    token: 'jwt-token',
  });
  const missingToken = resetPasswordSchema[Segments.BODY].validate({
    password: 'new-password',
  });

  assert.equal(validEmail.error, undefined);
  assert.ok(invalidEmail.error);
  assert.equal(validPasswordReset.error, undefined);
  assert.ok(shortPasswordReset.error);
  assert.ok(missingToken.error);
});

test('user model has a default avatar and never serializes the password', () => {
  const user = new User({
    email: 'user@example.com',
    password: 'password',
  });
  const serializedUser = user.toJSON();

  assert.equal(
    user.avatar,
    'https://ac.goit.global/fullstack/react/default-avatar.jpg',
  );
  assert.equal(serializedUser.password, undefined);
});

test('sendEmail is async and forwards email options unchanged', async (t) => {
  setTestEmailEnvironment();
  const originalCreateTransport = nodemailer.createTransport;
  const emailOptions = {
    from: 'sender@example.com',
    to: 'user@example.com',
    subject: 'Test email',
    html: '<p>Test</p>',
  };
  let forwardedOptions;

  t.after(() => {
    nodemailer.createTransport = originalCreateTransport;
  });
  nodemailer.createTransport = () => ({
    sendMail: async (options) => {
      forwardedOptions = options;
    },
  });

  assert.equal(sendEmail.constructor.name, 'AsyncFunction');
  await sendEmail(emailOptions);
  assert.equal(forwardedOptions, emailOptions);
});

test('requestResetEmail does not reveal whether an email exists', async (t) => {
  const originalFindOne = User.findOne;
  t.after(() => {
    User.findOne = originalFindOne;
  });
  User.findOne = async () => null;

  const response = createResponse();
  await requestResetEmail(
    { body: { email: 'missing@example.com' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    message: 'Password reset email sent successfully',
  });
});

test('requestResetEmail sends a 15-minute JWT link through configured SMTP', async (t) => {
  setTestEmailEnvironment();
  const userId = new Types.ObjectId();
  const originalFindOne = User.findOne;
  const originalCreateTransport = nodemailer.createTransport;
  let transportOptions;
  let emailOptions;

  t.after(() => {
    User.findOne = originalFindOne;
    nodemailer.createTransport = originalCreateTransport;
  });
  User.findOne = async () => ({
    _id: userId,
    username: 'Test User',
    email: 'user@example.com',
  });
  nodemailer.createTransport = (options) => {
    transportOptions = options;
    return {
      sendMail: async (mail) => {
        emailOptions = mail;
      },
    };
  };

  const response = createResponse();
  await requestResetEmail(
    { body: { email: 'user@example.com' } },
    response,
  );

  const token = emailOptions.html.match(/reset-password\?token=([^"<]+)/)[1];
  const payload = jwt.verify(token, process.env.JWT_SECRET);

  assert.equal(response.statusCode, 200);
  assert.equal(transportOptions.host, process.env.SMTP_HOST);
  assert.equal(transportOptions.port, 587);
  assert.equal(emailOptions.from, process.env.SMTP_FROM);
  assert.equal(emailOptions.to, 'user@example.com');
  assert.equal(payload.sub, userId.toString());
  assert.equal(payload.email, 'user@example.com');
  assert.equal(payload.exp - payload.iat, 15 * 60);
});

test('requestResetEmail returns the required error when SMTP fails', async (t) => {
  setTestEmailEnvironment();
  const originalFindOne = User.findOne;
  const originalCreateTransport = nodemailer.createTransport;

  t.after(() => {
    User.findOne = originalFindOne;
    nodemailer.createTransport = originalCreateTransport;
  });
  User.findOne = async () => ({
    _id: new Types.ObjectId(),
    username: 'Test User',
    email: 'user@example.com',
  });
  nodemailer.createTransport = () => ({
    sendMail: async () => {
      throw new Error('SMTP is unavailable');
    },
  });

  await assert.rejects(
    requestResetEmail(
      { body: { email: 'user@example.com' } },
      createResponse(),
    ),
    (error) =>
      error.status === 500 &&
      error.message === 'Failed to send the email, please try again later.',
  );
});

test('resetPassword rejects an invalid token with the required error', async () => {
  setTestEmailEnvironment();

  await assert.rejects(
    resetPassword(
      { body: { token: 'invalid-token', password: 'new-password' } },
      createResponse(),
    ),
    (error) =>
      error.status === 401 && error.message === 'Invalid or expired token',
  );
});

test('resetPassword returns 404 when the token user does not exist', async (t) => {
  setTestEmailEnvironment();
  const originalFindOne = User.findOne;
  t.after(() => {
    User.findOne = originalFindOne;
  });
  User.findOne = async () => null;
  const token = jwt.sign(
    { sub: new Types.ObjectId().toString(), email: 'missing@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );

  await assert.rejects(
    resetPassword(
      { body: { token, password: 'new-password' } },
      createResponse(),
    ),
    (error) => error.status === 404 && error.message === 'User not found',
  );
});

test('resetPassword hashes and saves the new password', async (t) => {
  setTestEmailEnvironment();
  const userId = new Types.ObjectId();
  const originalFindOne = User.findOne;
  const user = {
    password: 'old-password',
    saved: false,
    async save() {
      this.saved = true;
    },
  };

  t.after(() => {
    User.findOne = originalFindOne;
  });
  User.findOne = async () => user;
  const token = jwt.sign(
    { sub: userId.toString(), email: 'user@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );
  const response = createResponse();

  await resetPassword(
    { body: { token, password: 'new-password' } },
    response,
  );

  assert.equal(user.saved, true);
  assert.equal(await bcrypt.compare('new-password', user.password), true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { message: 'Password reset successfully' });
});

test('avatar upload uses memory storage, a 2 MB limit, and image filtering', () => {
  assert.equal(upload.storage.constructor.name, 'MemoryStorage');
  assert.equal(upload.limits.fileSize, 2 * 1024 * 1024);

  upload.fileFilter({}, { mimetype: 'image/png' }, (error, accepted) => {
    assert.equal(error, null);
    assert.equal(accepted, true);
  });
  upload.fileFilter({}, { mimetype: 'text/plain' }, (error) => {
    assert.equal(error.message, 'Only images allowed');
  });
});

test('saveFileToCloudinary uploads the buffer with the user id', async (t) => {
  const originalUploadStream = cloudinary.uploader.upload_stream;
  const userId = new Types.ObjectId();
  const buffer = Buffer.from('image-data');
  let uploadOptions;
  let uploadedBuffer;

  t.after(() => {
    cloudinary.uploader.upload_stream = originalUploadStream;
  });
  cloudinary.uploader.upload_stream = (options, callback) => {
    uploadOptions = options;
    return {
      end(value) {
        uploadedBuffer = value;
        callback(null, { secure_url: 'https://example.com/avatar.png' });
      },
    };
  };

  const result = await saveFileToCloudinary(buffer, userId);

  assert.equal(uploadOptions.public_id, userId.toString());
  assert.equal(uploadOptions.folder, 'avatars');
  assert.equal(uploadedBuffer, buffer);
  assert.equal(result.secure_url, 'https://example.com/avatar.png');
});

test('updateUserAvatar requires a file', async () => {
  await assert.rejects(
    updateUserAvatar({}, createResponse()),
    (error) => error.status === 400 && error.message === 'No file',
  );
});

test('updateUserAvatar stores and returns Cloudinary secure_url', async (t) => {
  const originalUploadStream = cloudinary.uploader.upload_stream;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const userId = new Types.ObjectId();
  const secureUrl = 'https://example.com/avatar.png';
  let updateFilter;
  let update;
  let updateOptions;

  t.after(() => {
    cloudinary.uploader.upload_stream = originalUploadStream;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  });
  cloudinary.uploader.upload_stream = (options, callback) => ({
    end() {
      callback(null, { secure_url: secureUrl });
    },
  });
  User.findByIdAndUpdate = async (filter, value, options) => {
    updateFilter = filter;
    update = value;
    updateOptions = options;
    return { avatar: secureUrl };
  };

  const response = createResponse();
  await updateUserAvatar(
    { file: { buffer: Buffer.from('image') }, user: { _id: userId } },
    response,
  );

  assert.equal(updateFilter, userId);
  assert.deepEqual(update, { avatar: secureUrl });
  assert.deepEqual(updateOptions, { returnDocument: 'after' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { url: secureUrl });
});
