/** Normalize Mongoose ObjectId, populated doc, or string to id string */
export function toObjectId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
}
