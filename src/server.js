import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import connectMongoDB from './db/connectMongoDB.js';
// import { logger } from './middleware/logger.js';
import { errors } from 'celebrate';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import notesRoutes from './routes/notesRoutes.js';

const PORT = process.env.PORT || 3000;
const app = express();
// app.use(logger());
app.use(cors());
app.use(helmet());
app.use(express.json());

app.use(notesRoutes);

app.use(notFoundHandler);
app.use(errors());
app.use(errorHandler);

await connectMongoDB();

app.listen(PORT, () => {
  console.log(`Server running on: ${PORT}`);
});
