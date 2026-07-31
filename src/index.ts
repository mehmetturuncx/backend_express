import express, {type Request,type Response} from 'express';
import { isIP } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const app = express();
const PORT = 3000;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(express.json()); 

//GET isteği (örnek veri dönme)
app.get('/api/kullanici', async (req: Request, res: Response) => {
    try {
        const kullanicilar = await prisma.kullanici.findMany();
        return res.json(kullanicilar);
    }
    catch (error) {
        return res.status(500).json({mesaj: 'Veriler çekilirken hata oluştu.'});
    }
});


//POST isteği
app.post('/api/kullanici', async (req: Request, res: Response) => {
    const {isim, rol} = req.body;

    if (!isim || !rol) {
        return res.status(400).json({
            hata: 'İsim ve rol alanları zorunludur!'
        });
    }

    try {
        const yeniKullanici = await prisma.kullanici.create({
            data: {
                isim,
                rol,
            },
        });
        return res.status(201).json(yeniKullanici);
    }
    catch (error) {
        return res.status(500).json({mesaj: 'Kullanıcı eklenirken hata oluştu.'})
    }
});



app.delete('/api/kullanici/:id', async (req: Request, res: Response) => {
    const silinecek_id = Number(req.params.id);

    try{
        const silinen = await prisma.kullanici.delete({
            where: {id: silinecek_id},
        });
        return res.json({mesaj: 'Kullanıcı veritabanından silindi: ', silinen});
    }
    catch (error) {
        return res.status(404).json({mesaj: "Bu id ile kullanıcı bulunamadı!"});
    }
});

app.put('/api/kullanici/:id', async (req: Request, res: Response) => {
  const gelenId = Number(req.params.id);
  const {isim,rol} = req.body;

  try {
    const guncellenen_kullanici = await prisma.kullanici.update({
        where: {id: gelenId},
        data: {
            ...(isim && {isim}),
            ...(rol && {rol}),
        }
    });
    return res.json({ mesaj: "Kullanıcı bilgileri güncellendi."})
  }
  catch (error) {
    return res.status(404).json({mesaj: "Bu id ile kullanıcı bulunamadı!"});
  }
});

//Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`)
});