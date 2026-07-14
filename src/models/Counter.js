import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);
export default Counter;

export async function getNextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

export async function generateTicketNumber() {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`ticket_${year}`);
  return `TKT-${year}-${String(seq).padStart(6, '0')}`;
}
