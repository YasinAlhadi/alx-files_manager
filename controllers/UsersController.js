const sha1 = require('sha1');
const { ObjectId } = require('mongodb');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const postNew = async (req, res) => {
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
};

const getMe = async (req, res) => {
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
};

module.exports = {
  postNew,
  getMe,
};
