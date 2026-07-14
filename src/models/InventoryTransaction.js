import mongoose from 'mongoose';
import { INVENTORY_TX_TYPE } from '../constants/statuses.js';

const inventoryTransactionSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    quantity: { type: Number, required: true },
    returnQuantity: { type: Number, default: 0 },
    unitCost: { type: Number, required: true },
    type: { type: String, enum: Object.values(INVENTORY_TX_TYPE), required: true },
    materialRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialRequest' },
    issueDate: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true }
);

inventoryTransactionSchema.index({ ticket: 1, issueDate: -1 });
inventoryTransactionSchema.index({ item: 1, issueDate: -1 });

const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
export default InventoryTransaction;
