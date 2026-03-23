const fs = require('fs');
const file = 'c:\\\\Users\\\\saulo\\\\OneDrive\\\\Desktop\\\\Unifenas - EAD\\\\portal-ads-express\\\\server\\\\server.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "app.post('/api/login', async (req, res) => {\\n    const { matricula, senha } = req.body;\\n\\n    if (!matricula || !senha) {\\n        return res.status(400).json({ success: false, error: 'Matrícula e Senha são obrigatórios' });\\n    }",
  `app.post('/api/login', async (req, res) => {
    const { matricula, senha } = req.body;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const sendLog = (msg) => {
        console.log(msg);
        res.write(JSON.stringify({ type: 'log', message: msg }) + '\\n');
    };

    if (!matricula || !senha) {
        res.write(JSON.stringify({ type: 'error', error: 'Matrícula e Senha são obrigatórios' }) + '\\n');
        return res.end();
    }`
);

content = content.replace(
  "res.json({ success: true, matricula, nome: nomeAluno || 'Aluno UNIFENAS', data: courses });",
  "res.write(JSON.stringify({ type: 'success', matricula, nome: nomeAluno || 'Aluno UNIFENAS', data: courses }) + '\\n');\\n        res.end();"
);

content = content.replace(
  "res.status(500).json({ success: false, error: error.message });",
  "res.write(JSON.stringify({ type: 'error', error: error.message }) + '\\n');\\n        res.end();"
);

content = content.replace(/console\\.log/g, 'sendLog');
content = content.replace(/sendLog\\(`\\\\n🤖 Express Scraper/g, 'console.log(`\\\\n🤖 Express Scraper');
content = content.replace(/sendLog\\(`✅ Rodando na porta/g, 'console.log(`✅ Rodando na porta');

fs.writeFileSync(file, content, 'utf8');
console.log('Update complete');
