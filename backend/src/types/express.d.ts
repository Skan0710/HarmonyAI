import { IUser } from './domainModels.js';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
