export class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id, populate = []) {
    let query = this.model.findById(id);
    populate.forEach((p) => {
      query = query.populate(p);
    });
    return query.exec();
  }

  async findOne(filter, populate = []) {
    let query = this.model.findOne(filter);
    populate.forEach((p) => {
      query = query.populate(p);
    });
    return query.exec();
  }

  async findAll(filter = {}, options = {}) {
    const { skip = 0, limit = 20, sort = { createdAt: -1 }, populate = [] } = options;
    let query = this.model.find(filter).skip(skip).limit(limit).sort(sort);
    populate.forEach((p) => {
      query = query.populate(p);
    });
    return query.exec();
  }

  async count(filter = {}) {
    return this.model.countDocuments(filter);
  }

  async create(data) {
    return this.model.create(data);
  }

  async updateById(id, data, options = { new: true, runValidators: true }) {
    return this.model.findByIdAndUpdate(id, data, options);
  }

  async deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }

  async softDelete(id, userId) {
    return this.model.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date(), deletedBy: userId },
      { new: true }
    );
  }
}

export default BaseRepository;
