// A tiny fake OpenAI-compatible server for testing the assistant without any real AI.
// Run: node scripts/mock-ai-server.cjs  → listens on http://localhost:1234/v1
const http = require('node:http');
const reply = '## Plan\n\nHere is a suggested plan:\n\n- [ ] Draft the outline\n- [ ] Review with the team\n- [ ] Publish on Friday\n';
http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.end();
    if (req.url.endsWith('/models')) return res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      const msgs = JSON.parse(body || '{}').messages || [];
      const last = msgs[msgs.length - 1]?.content || '';
      const text = /Connection OK/.test(last) ? 'Connection OK' : reply;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const part of text.match(/.{1,12}/gs)) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`);
        await new Promise((r) => setTimeout(r, 10));
      }
      res.end('data: [DONE]\n\n');
    });
  })
  .listen(1234, () => console.log('mock AI on http://localhost:1234/v1'));
