import BaseRepository from './BaseRepository.js';
import { Worker } from '../models/index.js';

const workerRepository = new BaseRepository(Worker);
export default workerRepository;
