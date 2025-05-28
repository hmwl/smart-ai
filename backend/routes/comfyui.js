const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads/comfyui');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer 存储到 comfyui 子目录
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 完全参照 aiApplications.js 命名方式
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 上传 JSON 文件接口
router.post('/upload', upload.single('comfyuiFile'), async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!req.file) {
    return res.status(400).json({ message: '未收到文件' });
  }
  // 只允许 .json 文件
  if (path.extname(req.file.originalname).toLowerCase() !== '.json') {
    // 删除已存储的非 json 文件
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: '只允许上传 JSON 文件' });
  }

  // 修复 originalName 中文乱码
  let originalName = req.file.originalname;
  if (originalName) {
    originalName = Buffer.from(originalName, 'latin1').toString('utf8');
  }

  res.json({
    message: '上传成功',
    file: {
      fileName: req.file.filename,
      filePath: `/uploads/comfyui/${req.file.filename}`,
      originalName,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  });
});

module.exports = router; 