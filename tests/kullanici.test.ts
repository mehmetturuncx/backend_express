import request from 'supertest';
import { app, prisma } from '../src/index.js'; 



describe('Kullanıcı API Testleri', () => {

    afterAll(async () => {
        await prisma.$disconnect();
    })

    it('GET /api/kullanici - Tüm kullanıcıları listeleyebilmeli', async () => {
        const response = await request(app).get('/api/kullanici');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('POST /api/auth/register', async () => {
        const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: "invaild-email"
                });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('hatalar');
    })
});