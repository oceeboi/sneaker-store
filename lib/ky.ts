import ky from 'ky';

const http = ky.create({
  prefix: '/api/',
  timeout: 30000, // 30 seconds
});

export default http;
