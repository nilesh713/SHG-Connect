const mongoose = require('mongoose');

// Atomic sequence used for human-friendly order numbers (SC1001, SC1002 …)
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 1000 }
});

const START = 1000;

counterSchema.statics.next = async function (name) {
  // Create the counter at START the first time (defaults are not applied by $inc upserts)
  await this.updateOne({ _id: name }, { $setOnInsert: { seq: START } }, { upsert: true });
  const doc = await this.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true });
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
