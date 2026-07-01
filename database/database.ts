// will use class based singleton pattern to create a single mongoose connection instance
import mongoose from 'mongoose';

class Database {
  private static instance: Database;
  constructor() {}

  // method to get the singleton instance of Database

  /** what this instance represents
   * Returns the singleton instance of the Database class.
   * If the instance does not exist, it creates a new one.
   * @returns {Database} The singleton instance of the Database class.
   * @example
   * const db = Database.getInstance();
   * await db.connect();
   * // Now you can use the db instance to interact with the database
   */
  public static getInstance(): Database {
    if (
      !Database.instance
    ) {
      Database.instance =
        new Database();
    }
    return Database.instance;
  }

  // method to connect to mongoDB
  public async connect(): Promise<
    typeof mongoose
  > {
    // check if already connected
    if (
      mongoose
        .connection
        .readyState ===
      1
    ) {
      console.log(
        'MongoDB is already connected'
      );
      return mongoose;
    }

    // check for MONGO_URI in environment variables
    const mongoUri =
      process
        .env
        .MONGO_URI;
    if (
      !mongoUri
    ) {
      console.error(
        'MONGO_URI is not defined in environment variables'
      );
      throw new Error(
        'MONGO_URI is not defined in environment variables'
      );
    }

    // establish a new connection

    try {
      await mongoose.connect(
        mongoUri
      );
      console.log(
        'MongoDB connected successfully'
      );
      return mongoose;
    } catch (error) {
      console.error(
        'Error connecting to MongoDB:',
        error
      );
      throw error;
    }
  }
}

export default Database;

//example usage:
// import Database from './db';
// const db = Database.getInstance();
// await db.connect();
