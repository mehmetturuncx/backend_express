import request from 'supertest';
import { app, prisma } from '../src/index.js'; 
import { redis } from '../src/redis.js'; 
import { email } from 'zod';

describe('Kullanıcı API Testleri', () => {

    let createdEmail: string;

    afterAll(async () => {
        await prisma.$disconnect();
        await redis.quit(); 
    });

    it('GET /api/kullanici - Kullanıcıları sayfalamalı getirebilmeli', async () => {
        const response = await request(app).get('/api/kullanici?sayfa=1&limit=5');

        expect(response.status).toBe(200);
        
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        
        expect(response.body).toHaveProperty('sayfa', 1);
        expect(response.body).toHaveProperty('kaynak');
    });

    it('POST /api/auth/register - Geçersiz emaili reddetmeli', async () => {
        const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: "invalid-email"
                });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('hatalar');
    });

    it('POST /api/auth/register', async () => {
        const dynamicEmail = `testuser_${Date.now()}@test.com`;
        const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: dynamicEmail,
                    isim: "testuser",
                    sifre: "123456789"
                });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('kullanici');
        createdEmail = dynamicEmail;
    });

    it('POST /api/auth/login', async () => {
        const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: createdEmail,
                    sifre: "123456789"
                });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
    })
});