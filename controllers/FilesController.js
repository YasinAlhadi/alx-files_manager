import { v4 as uuid } from 'uuid';
import path from 'path';
import { promises as fs } from 'fs';
import { ObjectId } from 'mongodb';
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
  }
}

export default FilesController;
