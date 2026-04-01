import express from 'express';
import cors from 'cors';
import { waitForDb } from './db';
import { errorHandler } from './middleware/errorHandler';
import configRouter      from './routes/config';
import membersRouter     from './routes/members';
import workHoursRouter   from './routes/workHours';
import reportsRouter     from './routes/reports';
import importRouter      from './routes/import';
import departmentsRouter from './routes/departments';

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/v1/config',      configRouter);
app.use('/api/v1/members',     membersRouter);
app.use('/api/v1/work-hours',  workHoursRouter);
app.use('/api/v1/reports',     reportsRouter);
app.use('/api/v1/import',      importRouter);
app.use('/api/v1/departments', departmentsRouter);

app.use(errorHandler);

async function main() {
  await waitForDb();
  app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
}

main().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
