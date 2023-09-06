import Queue from 'bull';
import imgThumbnail from 'image-thumbnail';
import { ObjectId } from 'mongodb';
import { promises as fs } from 'fs';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

async function thumbNail(localPath, { width }) {
  const thumbnail = await imgThumbnail(localPath, { width });
  const image = await fs.writeFile(`${localPath}_${width}`, thumbnail);
  return image;
}

fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;
  if (!fileId) {
    done(Error('Missing fileId'));
    return;
  }
  if (!userId) {
    done(Error('Missing userId'));
    return;
  }
  const file = await dbClient.files.findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
  if (!file) {
    done(Error('File not found'));
    return;
  }
  const thumbnail1 = await thumbNail(file.localPath, { width: 500 });
  const thumbnail2 = await thumbNail(file.localPath, { width: 250 });
  const thumbnail3 = await thumbNail(file.localPath, { width: 100 });
  if (!thumbnail1 || !thumbnail2 || !thumbnail3) {
    done(Error('Error creating the thumbnails'));
  }
});

export default fileQueue;
