import { v4 as uuid } from 'uuid';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const authorization = req.header('Authorization') || null;
    const credentials = authorization.split(' ')[1];
    const decodedCredentials = Buffer.from(credentials, 'base64').toString('utf-8');
    const [email, password] = decodedCredentials.split(':');
    const user = await dbClient.users.findOne({ email, password: sha1(password) });
    if (!user) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    const token = uuid();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 86400);
    res.status(200).send({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.header('X-Token') || null;
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    await redisClient.del(key);
    res.status(204).send();
  }
}

module.exports = AuthController;
