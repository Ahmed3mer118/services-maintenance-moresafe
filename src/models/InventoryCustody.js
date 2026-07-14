import mongoose from 'mongoose';

const inventoryCustodySchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    quantity: { type: Number, required: true, min: 0 },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'MaintenanceTeam' },
    teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
    materialRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialRequest' },
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    status: {
      type: String,
      enum: ['with_leader', 'with_worker', 'returned'],
      default: 'with_leader',
    },
    issuedAt: { type: Date, default: Date.now },
    issuedToWorkerAt: Date,
  },
  { timestamps: true }
);

inventoryCustodySchema.index({ teamLeader: 1, status: 1 });
inventoryCustodySchema.index({ worker: 1, status: 1 });

const InventoryCustody = mongoose.model('InventoryCustody', inventoryCustodySchema);
export default InventoryCustody;
