const express = require('express');
const router = express.Router();
const EnumConfig = require('../models/EnumConfig'); // Adjust path if necessary

// GET /public/enum-configs/details?ids=id1,id2,id3
router.get('/enum-configs/details', async (req, res) => {
    const { ids } = req.query;

    if (!ids) {
        return res.status(400).json({ message: '未提供枚举配置ID (ids query parameter is missing)' });
    }

    const idArray = ids.split(',').map(id => id.trim()).filter(id => id);

    if (idArray.length === 0) {
        return res.status(400).json({ message: '提供的ID列表为空或无效' });
    }

    try {
        // Find EnumConfigs where _id is in the provided idArray
        // Only select relevant fields for the frontend to use in options
        const enumConfigs = await EnumConfig.find(
            { _id: { $in: idArray }, status: 'active' }, // Only fetch active enums
            'name translation _id' // Select specific fields: name for display, translation for value, _id for key
        ).lean(); // .lean() for faster, plain JS objects

        if (!enumConfigs || enumConfigs.length === 0) {
            // It's possible some IDs are invalid or no active configs found, return empty or partial based on needs.
            // For now, if nothing matches (or partial matches), return what's found (can be an empty array).
            return res.status(200).json([]);
        }

        // The frontend might expect a certain order or structure, but for now, we return them as found.
        // If order matters and needs to match the input `idArray`, further processing would be needed.
        res.json(enumConfigs);

    } catch (error) {
        console.error('Error fetching enum config details:', error);
        res.status(500).json({ message: '获取枚举配置详情失败: ' + error.message });
    }
});

// NEW ROUTE TO ADD:
// GET all active EnumConfig items for a specific EnumType ID
router.get('/enum-types/:enumTypeId/configs', async (req, res) => {
  try {
    const { enumTypeId } = req.params;

    // Optional: Validate if the enumTypeId itself exists
    // const EnumType = require('../models/EnumType'); // Import EnumType model if validation is uncommented
    // const enumTypeExists = await EnumType.findById(enumTypeId).lean();
    // if (!enumTypeExists) {
    //   return res.status(404).json({ message: '指定枚举类型不存在 (EnumType not found)' });
    // }

    const enumConfigs = await EnumConfig.find({
      enumType: enumTypeId,
      status: 'active'
    })
    .select('_id name description') // 移除 translation 和 platform 字段
    .lean();

    // It's okay to return an empty array if no configs are found for this type.
    res.json(enumConfigs);
  } catch (error) {
    console.error('Error fetching enum configs by type:', error);
    res.status(500).json({ message: '按类型获取枚举配置列表失败: ' + error.message });
  }
});

module.exports = router;