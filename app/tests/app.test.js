const request = require('supertest');
const app = require('../src/app');

describe('devops-webapp', () => {
  test('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  test('GET /api/info returns app metadata', async () => {
    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body.app).toBe('devops-webapp');
    expect(res.body).toHaveProperty('hostname');
  });

  test('GET / serves the HTML page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Containerized Web App');
  });

  test('task CRUD works', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Write Dockerfile' });
    expect(created.status).toBe(201);

    const list = await request(app).get('/api/tasks');
    expect(list.body).toHaveLength(1);

    const del = await request(app).delete(`/api/tasks/${created.body.id}`);
    expect(del.status).toBe(204);
  });

  test('POST /api/tasks rejects empty title', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '' });
    expect(res.status).toBe(400);
  });
});
