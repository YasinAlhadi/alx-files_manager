import { v4 as uuid } from 'uuid';
import path from 'path';
import { promises as fs } from 'fs';
import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull/lib/queue';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token') || null;
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    const {
      name,
      type,
      parentId,
      isPublic,
      data,
    } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Missing name' });
      return;
    }
    if (!type) {
      res.status(400).json({ error: 'Missing type' });
      return;
    }
    if (type !== 'folder' && type !== 'file' && type !== 'image') {
      res.status(400).json({ error: 'Missing type' });
      return;
    }
    if (type !== 'folder' && !data) {
      res.status(400).json({ error: 'Missing data' });
      return;
    }
    if (parentId) {
      const parent = await dbClient.files.findOne({ _id: ObjectId(parentId) });
      if (!parent) {
        res.status(400).json({ error: 'Parent not found' });
        return;
      }
      if (parent.type !== 'folder') {
        res.status(400).json({ error: 'Parent is not a folder' });
        return;
      }
    }
    const file = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId || 0,
    };
    if (type === 'folder') {
      await dbClient.files.insertOne(file);
      res.status(201).send({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      });
      return;
    }
    const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileName = uuid();
    const buff = Buffer.from(data, 'base64');
    const fileCompletePath = path.join(filePath, fileName);
    try {
      try {
        await fs.mkdir(filePath, { recursive: true });
      } catch (error) {
        console.log(error);
      }
      await fs.writeFile(fileCompletePath, buff, 'utf-8');
    } catch (error) {
      console.log(error);
    }
    file.localPath = fileCompletePath;
    await dbClient.files.insertOne(file);
    res.status(201).send({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
    if (type === 'image') {
      const queue = new Queue('fileQueue');
      await queue.add({
        userId: file.userId,
        fileId: file._id,
      });
    }
  }

  static async getShow(req, res) {
    const token = req.header('X-Token') || null;
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    const fileId = req.params.id;
    const file = await dbClient.files.findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) {
      res.status(404).send({ error: 'Not found' });
      return;
    }
    res.status(200).send({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token') || null;
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    const parentId = req.query.parentId || 0;
    const page = req.query.page || 0;
    const limit = req.query.limit || 20;
    const skip = page * limit;
    const files = await dbClient.files.find({ parentId: ObjectId(parentId) })
      .skip(skip)
      .limit(limit)
      .toArray();
    const filesData = files.map((f) => ({
      id: f._id,
      userId: f.userId,
      name: f.name,
      type: f.type,
      isPublic: f.isPublic,
      parentId: f.parentId,
    }));
    res.status(200).send(filesData);
    console.log(filesData);
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token') || null;
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    const fileId = req.params.id;
    const file = await dbClient.files.findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) {
      res.status(404).send({ error: 'Not found' });
      return;
    }
    await dbClient.files.updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });
    res.status(200).send({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token') || null;
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    const fileId = req.params.id;
    const file = await dbClient.files.findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) {
      res.status(404).send({ error: 'Not found' });
      return;
    }
    await dbClient.files.updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });
    res.status(200).send({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId,
    });
  }

  static async getFile(req, res) {
    const token = req.header('X-Token') || null;
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    const fileId = req.params.id;
    const file = await dbClient.files.findOne({ _id: ObjectId(fileId) });
    if (!file) {
      res.status(404).send({ error: 'Not found' });
      return;
    }
    if (!file.isPublic && !req.header('X-Token')) {
      res.status(404).send({ error: 'Not found' });
      return;
    }
    if (file.userId.toString() !== userId.toString()) {
      res.status(404).send({ error: 'Not found' });
      return;
    }
    if (file.type === 'folder') {
      res.status(400).send({ error: 'A folder doesn\'t have content' });
      return;
    }
    if (!file.localPath) {
      res.status(404).send({ error: 'Not found' });
    }
    res.setHeader('Content-Type', mime.lookup(file.name));
    res.setHeader('Content-Disposition', `attachment; filename=${file.name}`);
  }
}

export default FilesController;
