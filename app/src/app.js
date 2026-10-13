const express = require('express');
const os = require('os');
const path = require('path');

const app = express();
const startedAt = new Date();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Liveness / readiness probe used by Docker HEALTHCHECK and Kubernetes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Info endpoint: shows which pod/container served the request (useful to see K8s load balancing)
app.get('/api/info', (req, res) => {
  res.json({
    app: 'devops-webapp',
    version: process.env.APP_VERSION || 'dev',
    environment: process.env.NODE_ENV || 'development',
    hostname: os.hostname(),
    uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
  });
});

// Simple in-memory task API (demo CRUD)
const tasks = [];
let nextId = 1;

app.get('/api/tasks', (req, res) => res.json(tasks));

app.post('/api/tasks', (req, res) => {
  const title = (req.body && req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title is required' });
  const task = { id: nextId++, title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const idx = tasks.findIndex((t) => t.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  tasks.splice(idx, 1);
  res.status(204).end();
});

module.exports = app;
