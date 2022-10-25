import { useState, useRef } from 'react';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import SparkMD5 from 'spark-md5';

// Size for each chunk, set to 1MB
const chunkSize = 1 * 1024 * 1024;

// Blob.slice() method is used to segment files
// At the same time,this method is used in different browser in different ways
const BlocSlice = File.prototype.slice;

const hasFile = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();
    const loadNext = () => {
      const start = currentChunk * chunkSize;
      const end =
        start + chunkSize >= file.size ? file.size : start + chunkSize;
      fileReader.readAsArrayBuffer(BlocSlice.call(file, start, end));
    };
    fileReader.onload = (e) => {
      if (!e.target?.result) return;
      if (typeof e.target.result === 'string') return;
      spark.append(e.target.result);
      currentChunk = currentChunk + 1;
      if (currentChunk < chunks) {
        loadNext();
      } else {
        console.log(' finishing loading ');
        const result = spark.end();
        const sparkMD5 = new SparkMD5();
        sparkMD5.append(result);
        sparkMD5.append(file.name);
        const hexHash = sparkMD5.end();
        resolve(hexHash);
      }
    };
    fileReader.onerror = () => {
      console.log('file reading failed');
      reject('');
    };
    loadNext();
  }).catch((err) => {
    console.log('err', err);
    return '';
  });
};

const 小盖 = `盖总`;

const Index = () => {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async () => {
    if (!fileRef.current) return;
    const files = fileRef.current.files;
    const file = files?.[0];
    if (!file) {
      alert('not file acquired');
      return;
    }
    // total number of fragment
    const blockCount = Math.ceil(file.size / chunkSize);

    // axios promise array
    const axiosPromiseArray: Promise<AxiosResponse<any, any>>[] = [];

    // file hash
    const hash = await hasFile(file);
    if (!hash) return;
    for (let i = 0; i < blockCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      // building form data
      const form = new FormData();
      form.append('file', BlocSlice.call(file, start, end));
      form.append('name', file.name);
      form.append('total', `${blockCount}`);
      form.append('index', `${i}`);
      form.append('size', `${file.size}`);
      form.append('hash', hash);

      // ajax submit fragmentation
      // where content-type is multipart/form-data

      const axiosOptions: AxiosRequestConfig = {
        onUploadProgress: (e) => {
          // Progress in handing uploads function
          console.log('上传中--', blockCount, i, file, e);
        },
      };

      axiosPromiseArray.push(
        axios.post(`http://localhost:9000/file/upload`, form, axiosOptions)
      );
    }
    // After all fragments are uploaded
    // request to merge the fragmented files
    await axios.all(axiosPromiseArray).then(() => {
      // merge chunks
      const data = {
        size: file.size,
        name: file.name,
        totalChunk: blockCount,
        hash: hash,
      };
      axios
        .post(`http://localhost:9000/file/merge_chunks`, data)
        .then((res) => {
          console.log('successful upload');
          console.log(res.data, file);
          alert('successful uploaded');
        })
        .catch((err) => {
          console.log('merge err--', err);
        });
    });
  };

  return (
    <div>
      <div>
        <input
          ref={(e) => {
            fileRef.current = e;
          }}
          type='file'
          name='avatar'
          id='avatar'
        />
      </div>
      <div>
        <input type='button' value='submit' onClick={handleSubmit} />
      </div>
    </div>
  );
};

export default Index;
