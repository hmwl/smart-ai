const { MongoClient } = require('mongodb');

// MongoDB 连接 URL (默认端口 27017)
const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);

// 数据库名称
const dbName = 'myProject'; // 你可以修改为你想要的数据库名称

async function main() {
  try {
    // 连接到 MongoDB 服务器
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('documents'); // 你可以修改为你想要的集合名称

    // 在这里可以执行数据库操作
    // 例如：插入一个文档
    const insertResult = await collection.insertOne({ item: 'test', qty: 10 });

    // 例如：查找文档
    const findResult = await collection.find({}).toArray();

  } catch (err) {
    console.error('连接或操作数据库时出错:', err);
  } finally {
    // 确保在完成后关闭连接
    await client.close();
  }
}

main(); 