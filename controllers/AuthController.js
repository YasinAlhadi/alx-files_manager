const uuid = require('uuid').v4;
const sha1 = require('sha1');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const getConnect = async (req, res) => {
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
};

const getDisconnect = async (req, res) => {
  const token = req.header('X-Token') || null;
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    res.status(401).send({ error: 'Unauthorized' });
    return;
  }
  await redisClient.del(key);
  res.status(204).send();
};

module.exports = {
  getConnect,
  getDisconnect,
};
