import { isHttpError } from 'http-errors';

export default function errorHandler(err, req, res, next) {
  void next;
  const isProd = process.env.NODE_ENV === 'production';

  if (isHttpError(err)) {
    return res.status(err.status).json({
      message: err.message || err.name,
    });
  }

  res.status(500).json({
    message: isProd ? 'Server error' : err.message,
    ...(!isProd && { stack: err.stack }),
  });
}
