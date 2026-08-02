import pinoHttp from 'pino-http';

const isProduction = process.env.NODE_ENV === 'production';

// Pretty, colorized logs while developing; plain JSON in production
// (pino-pretty is a devDependency and won't be installed on the server).
export const logger = () => {
  return pinoHttp({
    redact: {
      paths: ['req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[Redacted]',
    },
    transport: isProduction
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
  });
};
