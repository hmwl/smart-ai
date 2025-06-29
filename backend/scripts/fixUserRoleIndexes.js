const mongoose = require('mongoose');
require('dotenv').config();

async function fixUserRoleIndexes() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-ai');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('userroles');

    // 获取现有索引
    const existingIndexes = await collection.indexes();
    console.log('现有索引:', existingIndexes.map(idx => ({ name: idx.name, key: idx.key })));

    // 删除旧的唯一索引（如果存在）
    try {
      await collection.dropIndex({ userId: 1, roleId: 1 });
      console.log('已删除旧的唯一索引: { userId: 1, roleId: 1 }');
    } catch (error) {
      console.log('旧索引不存在或已删除:', error.message);
    }

    // 创建新的唯一索引
    try {
      await collection.createIndex(
        { userId: 1, roleId: 1, scope: 1 }, 
        { unique: true, name: 'userId_1_roleId_1_scope_1' }
      );
      console.log('已创建新的唯一索引: { userId: 1, roleId: 1, scope: 1 }');
    } catch (error) {
      console.log('创建索引失败:', error.message);
    }

    // 检查是否有重复数据
    const duplicates = await collection.aggregate([
      {
        $group: {
          _id: { userId: '$userId', roleId: '$roleId', scope: '$scope' },
          count: { $sum: 1 },
          docs: { $push: '$_id' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();

    if (duplicates.length > 0) {
      console.log('发现重复数据:', duplicates.length, '组');
      
      // 删除重复数据，保留最新的
      for (const duplicate of duplicates) {
        const docsToDelete = duplicate.docs.slice(0, -1); // 保留最后一个
        await collection.deleteMany({ _id: { $in: docsToDelete } });
        console.log(`删除了 ${docsToDelete.length} 个重复记录`);
      }
    } else {
      console.log('没有发现重复数据');
    }

    // 验证索引
    const newIndexes = await collection.indexes();
    console.log('修复后的索引:', newIndexes.map(idx => ({ name: idx.name, key: idx.key, unique: idx.unique })));

    console.log('索引修复完成！');
    
  } catch (error) {
    console.error('修复索引时出错:', error);
  } finally {
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

// 运行修复脚本
if (require.main === module) {
  fixUserRoleIndexes();
}

module.exports = fixUserRoleIndexes;
