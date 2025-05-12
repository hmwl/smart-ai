const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId');

const PageSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('PG')
  },
  name: {
    type: String,
    required: [true, '页面名称不能为空']
  },
  type: {
    type: String,
    required: true,
    enum: ['single', 'collection'],
    default: 'single'
  },
  route: {
    type: String,
    unique: true,
    validate: {
      validator: function(v) {
        if (this.type === 'single' || this.type === 'collection') {
          return v && v.startsWith('/');
        }
        return true;
      },
      message: props => `Route '${props.value}' is required for this page type and must start with /`
    },
    index: true
  },
  content: {
    type: String,
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'disabled'],
    default: 'active'
  },
  templateSingle: {
    type: String,
    ref: 'Template',
    required: function() { return this.type === 'single'; }
  },
  templateList: {
    type: String,
    ref: 'Template',
    required: function() { return this.type === 'collection'; }
  },
  templateItem: {
    type: String,
    ref: 'Template',
    required: function() { return this.type === 'collection'; }
  }
}, { timestamps: true });

PageSchema.pre('save', function (next) {
    if (this.isNew && !this._id) {
        this._id = generateCustomId('PG');
    }
    next();
});

module.exports = mongoose.model('Page', PageSchema); 