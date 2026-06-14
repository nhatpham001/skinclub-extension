const mongoose = require('mongoose');

const dopplerPriceSchema = new mongoose.Schema({
  knife: {
    type: String,
    required: true,
    index: true
  },
  skin: {
    type: String,
    enum: ['Doppler', 'Gamma Doppler'],
    required: true
  },
  wear: {
    type: String,
    enum: ['Factory New', 'Minimal Wear', null],
    default: null
  },
  phase: {
    type: String,
    required: true,
    index: true
  },
  stattrak: {
    type: Boolean,
    default: false
  },
  min_price: {
    type: Number,
    required: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Compound index for fast lookups
dopplerPriceSchema.index({ knife: 1, skin: 1, wear: 1, phase: 1, stattrak: 1 }, { unique: true });

module.exports = mongoose.model('DopplerPrice', dopplerPriceSchema, 'dopplers');
