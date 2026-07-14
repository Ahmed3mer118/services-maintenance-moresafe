import serverless from 'serverless-http';
import app from '../src/app.js';
import connectDB from '../src/config/database.js';

const handler = serverless(app);

export default async function vercelHandler(req, res) {
  await connectDB();
  return handler(req, res);
}
