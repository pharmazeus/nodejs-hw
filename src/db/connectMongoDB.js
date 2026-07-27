import mongoose from 'mongoose';

export default async function connectMongoDB() {
  try {
    const Mongo_url = process.env.MONGO_URL;
    await mongoose.connect(Mongo_url);
    console.log('✅ MongoDB connection established successfully');
  } catch (error) {
    console.error('❌ Connection was not established', error);
    process.exit(1);
  }
}
