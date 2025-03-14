const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const cors = require('cors');
app.use(cors());

// 检查是否在Vercel环境中运行
const isVercel = process.env.VERCEL === '1';

// 添加静态文件支持
app.use(express.static(path.join(__dirname, 'public')));

// 使用内存存储代替文件系统
const memoryStorage = {};

// 只在非Vercel环境中创建目录
if (!isVercel) {
  // 在本地环境中创建数据目录
  const data_dir = path.join(__dirname, 'data');
  if (!fs.existsSync(data_dir)) fs.mkdirSync(data_dir);

  // 确保public目录存在
  const public_dir = path.join(__dirname, 'public');
  if (!fs.existsSync(public_dir)) fs.mkdirSync(public_dir);
}

var multer = require('multer');
var forms = multer({limits: { fieldSize: 100*1024*1024 }});
app.use(forms.array()); 

const bodyParser = require('body-parser')
app.use(bodyParser.json({limit : '50mb' }));  
app.use(bodyParser.urlencoded({ extended: true }));

const api_root = process.env.API_ROOT ? process.env.API_ROOT.trim().replace(/\/+$/, '') : '';
// console.log(api_root, process.env);

// 根路径处理
app.all(`${api_root}/`, (req, res) => {
    // 如果是API请求，返回API信息
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
        res.json({
            status: 'ok',
            message: 'CookieCloud API is running',
            api_root: api_root,
            isVercel: isVercel
        });
    } else {
        // 否则返回HTML内容
        try {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        } catch (error) {
            // 如果文件不存在，返回简单的HTML
            res.send(`
                <html>
                <head><title>CookieCloud API</title></head>
                <body>
                    <h1>CookieCloud API</h1>
                    <p>API服务器正在运行</p>
                </body>
                </html>
            `);
        }
    }
});

app.post(`${api_root}/update`, (req, res) => {
    const { encrypted, uuid } = req.body;
    // none of the fields can be empty
    if (!encrypted || !uuid) {
        res.status(400).send('Bad Request');
        return;
    }

    try {
        // 使用内存存储
        memoryStorage[uuid] = { encrypted };
        
        // 如果不是Vercel环境，也保存到文件
        if (!isVercel) {
            try {
                const file_path = path.join(__dirname, 'data', path.basename(uuid)+'.json');
                const content = JSON.stringify({"encrypted":encrypted});
                fs.writeFileSync(file_path, content);
            } catch (fileError) {
                console.error('Error writing to file:', fileError);
                // 继续执行，因为我们已经保存到内存中
            }
        }
        
        res.json({"action":"done"});
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({"action":"error", "message": error.message});
    }
});

app.all(`${api_root}/get/:uuid`, (req, res) => {
    const { uuid } = req.params;
    // none of the fields can be empty
    if (!uuid) {
        res.status(400).send('Bad Request');
        return;
    }
    
    try {
        let data;
        
        // 首先尝试从内存中获取
        if (memoryStorage[uuid]) {
            data = memoryStorage[uuid];
        } 
        // 如果不是Vercel环境且内存中没有，尝试从文件获取
        else if (!isVercel) {
            try {
                const file_path = path.join(__dirname, 'data', path.basename(uuid)+'.json');
                if (fs.existsSync(file_path)) {
                    data = JSON.parse(fs.readFileSync(file_path));
                    // 存入内存
                    memoryStorage[uuid] = data;
                }
            } catch (fileError) {
                console.error('Error reading from file:', fileError);
                // 继续执行，可能内存中有数据
            }
        }
        
        if (!data) {
            res.status(404).send('Not Found');
            return;
        }
        
        // 如果传递了password，则返回解密后的数据
        if (req.body.password) {
            try {
                const parsed = cookie_decrypt(uuid, data.encrypted, req.body.password);
                res.json(parsed);
            } catch (error) {
                console.error('Decryption error:', error);
                res.status(400).json({"error": "Decryption failed", "message": error.message});
            }
        } else {
            res.json(data);
        }
    } catch (error) {
        console.error('Error retrieving data:', error);
        res.status(500).send('Internal Serverless Error: ' + error.message);
    }
});

app.use(function (err, req, res, next) {
    console.error('Global error handler:', err);
    res.status(500).send('Internal Serverless Error: ' + err.message);
});

// 添加一个通配符路由，确保所有请求都能被处理
// 注意：这个路由必须放在所有其他路由之后
app.all('*', (req, res) => {
    // 检查是否是对根路径的请求
    if (req.path === '/' || req.path === '') {
        try {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        } catch (error) {
            // 如果文件不存在，返回简单的HTML
            res.send(`
                <html>
                <head><title>CookieCloud API</title></head>
                <body>
                    <h1>CookieCloud API</h1>
                    <p>API服务器正在运行</p>
                </body>
                </html>
            `);
        }
    } else {
        res.status(404).send('CookieCloud API Server. Endpoint not found. Please use the correct endpoints.');
    }
});

// 只在非Vercel环境中启动服务器
if (!isVercel) {
    const port = process.env.PORT || 8088;
    app.listen(port, () => {
        console.log(`Server start on http://localhost:${port}${api_root}`);
    });
}

// 导出app以供Vercel使用
module.exports = app;

function cookie_decrypt(uuid, encrypted, password) {
    try {
        const CryptoJS = require('crypto-js');
        const the_key = CryptoJS.MD5(uuid+'-'+password).toString().substring(0,16);
        const decrypted = CryptoJS.AES.decrypt(encrypted, the_key).toString(CryptoJS.enc.Utf8);
        const parsed = JSON.parse(decrypted);
        return parsed;
    } catch (error) {
        console.error('Decryption function error:', error);
        throw new Error('Failed to decrypt data: ' + error.message);
    }
}
  