import express from 'express';
import { handler as suggestHandler } from '../src/api/goals/suggest.js';
import { handler as publishHandler } from '../src/api/documents/publish.js';

const app = express();
app.use(express.json());

app.post('/api/goals/suggest', async (req, res) => {
  const out = await suggestHandler({ body: JSON.stringify(req.body || {}) });
  res.status(out.statusCode).json(JSON.parse(out.body));
});

app.post('/api/documents/:documentId/publish', async (req, res) => {
  const out = await publishHandler({ pathParameters: { documentId: req.params.documentId }, requestContext: { authorizer: { principalId: 'dev' } }, body: JSON.stringify(req.body || {}) });
  res.status(out.statusCode).json(JSON.parse(out.body));
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Dev API listening on http://localhost:${port}`));
