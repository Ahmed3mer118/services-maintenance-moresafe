import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    unit: { type: String, default: 'pcs' },
    quantity: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    region: { type: mongoose.Schema.Types.ObjectId, ref: 'Region', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

inventoryItemSchema.index({ region: 1, name: 'text', sku: 'text' });
inventoryItemSchema.index({ quantity: 1, minStock: 1 });

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);
export default InventoryItem;
