require('dotenv').config(); // Load environment variables from .env file

// Debug: Check if MONGO_URI is loaded

const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;

// Exit early if URI is still not found after loading dotenv
if (!uri) {
  console.error('ERROR: MONGO_URI was not found in .env file or process.env after dotenv.config()');
  process.exit(1); // Exit the process
}


const client = new MongoClient(uri);
let dbConnection;

module.exports = {
  connectToServer: async function (callback) {
    try {
      await client.connect();
      dbConnection = client;
      return callback();
    } catch (err) {
      return callback(err);
    }
  },

  getDb: function () {
    if (!dbConnection) {
        throw new Error("Database not initialized. Call connectToServer first.")
    }
    return dbConnection;
  },

  // Optional: Add a function to close the connection when the app shuts down
  closeConnection: async function() {
    if (dbConnection) {
        await dbConnection.close();
    }
  }
}; 