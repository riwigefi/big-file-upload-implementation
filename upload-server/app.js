const Koa = require('koa');
const Router = require('koa-router');
const multer = require('koa-multer');
// const serve = require('koa-static');
const cors = require('@koa/cors');
const koaBody = require('koa-body');
const path = require('path');
const fs = require('fs-extra');

const { faker } = require('@faker-js/faker');

const { mkdirSync } = require('./utils/dir');

const uploadPath = path.join(__dirname, 'uploads');
const uploadTempPath = path.join(uploadPath, 'temp');

/**
 * 大文件上传，后端接口设计
 * 1. /file/upload: 使用 multer 提取content-type为 multipart/form-data请求中的二进制文件内容（文件分片）
 * 再把提取到的二进制内容移动到temp目录下，创建一个以文件hash为名的临时目录，
 * 再将temp目录下文件分片，全部转移到这个特殊目录
 * 2. /file/merge_chunks：前端调用这个接口，将文件的分块情况告知服务器，服务器取出这个请求的分块相关数据
 * 比对服务器上收到的文件分片（这些文件分片全部存储在1中特殊目录中），
 * 如果匹配了，就开始合并文件分片，得到一个完整的文件，在合并的过程中，会把1中创建的特殊目录下的文件分片，依此删除
 * 最后再删除这个特殊目录，只留下最终合并成的完整文件
 */

// 会把前端上传的文件分片从请求中提取出来， 存储到/uploads/temp/文件夹下面
// 比如/uploads/temp/e7fbe81afc5cd68570fdf5554da57f66
const upload = multer({ dest: uploadTempPath });

const router = new Router();
const app = new Koa();

app.use(koaBody());

router.get('/', async (ctx, next) => {
  ctx.status = 200;
  ctx.res.end('Welcoming Koa Server');
});

/**
 * single(filed-name)
 * Accept a single file with the name filed-name
 * The single file will be stored in req.file
 */

router.post('/file/upload', upload.single('file'), async (ctx, next) => {
  // Create a folder based on the file hash
  // and move the default uploaded file under the current hash folder
  // Facilitate subsequent file merging
  const { name, total, index, size, hash } = ctx.req.body;

  console.log('file upload ...', {
    name,
    total,
    index,
    size,
    hash,
  });

  // 前端上传的文件块
  console.log('ctx.req.file--', ctx.req.file);

  // 文件存储路径
  const chunksPath = path.join(uploadPath, hash, '/');

  // 检查uploads文件夹中是否存在当前这次上传的文件对应的文件夹
  // 如果没有，就创建一个对应的文件夹
  if (!fs.existsSync(chunksPath)) mkdirSync(chunksPath);

  // 将tmp中的文件分片，移动至 uploads/fileHash/这个文件下面
  // 比如 /uploads/temp/bf952a794ab4bbfff28ab49959a430e3文件（index--5）
  // 移动至 /uploads/bf952a794ab4bbfff28ab49959a430e3/bf952a794ab4bbfff28ab49959a430e3-5
  fs.renameSync(ctx.req.file.path, chunksPath + hash + '-' + index);

  ctx.status = 200;

  ctx.res.end('Success');
});

router.post('/file/merge_chunks', async (ctx, next) => {
  const { size, name, total, hash } = ctx.request.body;
  // According to the hash value,get the fragmented file
  // Create a storage file
  // Merger
  const chunksPath = path.join(uploadPath, hash, '/');
  const filePath = path.join(uploadPath, name);
  // Read all chunks file names and store them in an array
  const chunks = fs.readdirSync(chunksPath);
  if (chunks.length !== total || chunks.length === 0) {
    ctx.status = 200;
    ctx.res.end('The number of sliced files does not match');
    return;
  }
  // Create a storage file
  fs.writeFileSync(filePath, '');
  for (let i = 0; i < total; i++) {
    // Additional Write to File
    // 将文件分片，写到`uploads/`目录下，对应的文件里面去
    fs.appendFileSync(filePath, fs.readFileSync(chunksPath + hash + '-' + i));
    // Delete the chunk used this time
    fs.unlinkSync(chunksPath + hash + '-' + i);
  }
  // 将相应的文件分片内容读取完了,删掉为了存储当前上传文件的文件分片所建立的目录
  // 比如 /uploads/bf952a794ab4bbfff28ab49959a430e3
  // rmdir 只能删除空目录
  fs.rmdirSync(chunksPath);
  // Successful file merging allows file information to be stored
  ctx.status = 200;
  ctx.res.end('merged successfully');
});

router.get('/news-list', async (ctx, next) => {
  const newsList = [];
  for (let i = 0; i < 20; i++) {
    newsList.push({
      id: Math.random() * 1000,
      title: `${faker.company.name()}--${Math.random() * 10000}`,
    });
  }
  ctx.status = 200;
  ctx.res.setHeader('content-type', 'application/json;charset=utf-8');
  ctx.res.end(JSON.stringify({ newsList }));
  // ctx.res.end({ newsList });
});

app.use(
  cors({
    origin: '*',
    allowHeaders: ['GET', 'POST', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);

app.use(router.routes());

app.use(router.allowedMethods());

app.listen(9000, () => {
  console.log('koa 服务启动了 ');
});
