import BaseRepository from './BaseRepository.js';
import { User } from '../models/index.js';

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() }).select('+password +refreshToken');
  }

  async findByEmailWithProfile(email) {
    return User.findOne({ email: email.toLowerCase() })
      .select('+password +refreshToken')
      .populate('workerProfile')
      .populate('region school');
  }
}

export default new UserRepository();
