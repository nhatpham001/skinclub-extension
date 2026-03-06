const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
  gun_type: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  wear: {
    type: String,
    enum: ['factory new', 'minimal wear', 'field-tested', 'well-worn', 'battle-scarred', null],
    default: null
  },
  stattrak: {
    type: Boolean,
    default: false
  },
  min_price: {
    type: Number,
    required: true
  }
});

// Compound index for fast lookups
priceSchema.index({ gun_type: 1, name: 1, wear: 1, stattrak: 1 }, { unique: true });

module.exports = mongoose.model('Price', priceSchema);
