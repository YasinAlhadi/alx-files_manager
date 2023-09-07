import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = new Queue('userQueue');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      res.status(400).send({ error: 'Missing email' });
      return;
    }
    if (!password) {
      res.status(400).send({ error: 'Missing password' });
      return;
    }
    const user = await dbClient.users.findOne({ email });
    if (user) {
      res.status(400).send({ error: 'Already exist' });
      return;
    }
    const newUser = await dbClient.users.insertOne({
      email,
      password: sha1(password),
    });
    res.status(201).send({ id: newUser.insertedId, email });
    await userQueue.add({ userId: newUser.insertedId });
  }

  static async getMe(req, res) {
    const token = req.header('X-Token') || null;
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
    if (!user) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    res.status(200).send({ id: user._id, email: user.email });
  }
}

module.exports = UsersController;
