// 设置环境变量，表明这是Vercel环境
process.env.VERCEL = '1';

// 导出app.js
const app = require('./app.js');
module.exports = app; 