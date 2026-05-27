import dotenv from 'dotenv';
import path from 'path';

// Load env vars before anything else
dotenv.config({ path: path.join(__dirname, '../.env') });

import app from './app';
import connectDB from './config/db';

const PORT = parseInt(process.env.PORT || '5000', 10);

const start = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
