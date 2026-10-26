import 'dotenv/config';
import { env } from './config/env.js';
import { app } from './app.js';

app.listen(env.PORT, () => {
  console.info('LMS API listening on port ' + env.PORT);
});

