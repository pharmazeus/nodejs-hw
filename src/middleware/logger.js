import pinoHttp from 'pino-http';

const isProduction = process.env.NODE_ENV === 'production';

// Pretty, colorized logs while developing; plain JSON in production
// (pino-pretty is a devDependency and won't be installed on the server).
export default function logger() {
  return pinoHttp({
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
}
