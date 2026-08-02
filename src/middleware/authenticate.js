import createHttpError from 'http-errors';
import { isValidObjectId } from 'mongoose';
import { Session } from '../models/session.js';
import { User } from '../models/user.js';

export const authenticate = async (req, res, next) => {
  void res;

  const { accessToken, sessionId } = req.cookies ?? {};
  if (!accessToken) {
    throw createHttpError(401, 'Missing access token');
  }

  if (!sessionId || !isValidObjectId(sessionId)) {
    throw createHttpError(401, 'Session not found');
  }

  const session = await Session.findOne({ _id: sessionId, accessToken });
  if (!session) {
    throw createHttpError(401, 'Session not found');
  }

  if (session.accessTokenValidUntil <= new Date()) {
    throw createHttpError(401, 'Access token expired');
  }

  const user = await User.findById(session.userId);
  if (!user) {
    throw createHttpError(401);
  }

  req.user = user;
  next();
};
