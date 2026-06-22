import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import pinoHttp from 'pino-http';


const PORT = process.env.PORT || 3000;
const app = express();
app.use(pinoHttp());
app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/notes', (req, res) => {
  req.log.info('Getting all notes');

  res.status(200).json({ message: 'Retrieved all notes' });
});
app.get('/notes/:noteId', (req, res) => {
  const { noteId } = req.params;
  req.log.info(`Getting note with ID: ${noteId}`);
  res.status(200).json({ message: `Retrieved note with ID: ${noteId}` });
});

app.get('/test-error', () => {
  throw new Error('Simulated server error');
});

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';

  res.status(500).json({
    message: isProd ? 'Server error' : err.stack,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on: ${PORT}`);
});
