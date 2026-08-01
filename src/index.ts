import express, {type Request,type Response} from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import  jwt from 'jsonwebtoken';

const app = express();
const PORT = 3000;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(express.json()); 

//GET isteği (örnek veri dönme)
app.get('/api/kullanici', async (req: Request, res: Response) => {
    try {
        const kullanicilar = await prisma.kullanici.findMany({
            select: {
                id: true,
                isim: true,
                email: true,
                rol: true,
                createdAt: true
            }
        });
        return res.json(kullanicilar);
    }
    catch (error) {
        return res.status(500).json({mesaj: 'Veriler çekilirken hata oluştu.'});
    }
});

app.post('/api/auth/register', async (req:Request, res: Response) => {
    const {email,sifre,isim} = req.body;

    if (!email || !sifre || !isim){
        return res.status(400).json({mesaj: "Email, şifre ve isim alanları zorunludur!"});
    }

    try{
        const varMi = await prisma.kullanici.findUnique({where: {email}});
        if (varMi){
            return res.status(400).json({mesaj: "Bu email zaten kullanımda!"});
        }

        const hashedPassword = await bcrypt.hash(sifre, 10);

        const yeniKullanici = await prisma.kullanici.create({
            data: {
                email,
                sifre: hashedPassword,
                isim,
            },
        });

        return res.status(201).json({
            mesaj: "Kullanıcı başarıyla oluşturuldu!",
            kullanici: {
                id: yeniKullanici.id,
                email: yeniKullanici.email,
                isim: yeniKullanici.isim,
                rol: yeniKullanici.rol,
            },
        });
    } 
    catch(error) {
        return res.status(500).json({mesaj: "Kayıt sırasında bir hata oluştu!"});
    }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
    const {email,sifre} = req.body;

    if (!email || !sifre) {
        return res.status(400).json({mesaj: "Email ve şifre alanları zorunludur!"});
    }

    try {
        const kullanici = await prisma.kullanici.findUnique({where: {email}});

        if (!kullanici) {
            return res.status(400).json({mesaj: "Hatalı email ya da şifre!"});
        }

        const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
        if (!sifreDogruMu) {
            return res.status(400).json({mesaj: "Hatalı email ya da şifre!"});
        }

        const token = jwt.sign(
            {id: kullanici.id,
             rol: kullanici.rol
            },
            process.env.JWT_SECRET || "varsayilan_secret",
            {expiresIn: "1h"}
        );

        return res.json({
            mesaj: "Giriş başarılı!",
            token,
        });
    }
    catch (error) {
        return res.status(500).json({mesaj: "Giriş yapılırken bir hata oluştu!"});
    }
})

interface AuthRequest extends Request {
    kullaniciId?: number;
    kullaniciRol?: string;
}

const authKontrol = (req: AuthRequest, res: Response, next: Function) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({mesaj: "Yetkisiz erişim! Token bulunamadı!"});
    }
    const token = authHeader.split(' ')[1];

    if(!token) {
        return res.status(401).json({mesaj: "Yetkisiz erişim, format hatalı!"});
    }

    try {
        const cozulmusToken = jwt.verify(
            token,
            process.env.JWT_SECRET || 'varsayilan_secret'
        ) as unknown as{ id: number, rol: string};

        req.kullaniciId = cozulmusToken.id;
        req.kullaniciRol = cozulmusToken.rol;
        next();
    }
    catch (error) {
        return res.status(403).json({mesaj: "Geçersiz veya süresi dolmuş token!"});
    }
};


app.delete('/api/kullanici/:id',authKontrol,async (req: AuthRequest, res: Response) => {
    const silinecek_id = Number(req.params.id);
    const istekAtanId = req.kullaniciId;
    const istekAtanRol = req.kullaniciRol;

    if (istekAtanRol !== "Admin" && istekAtanId !== silinecek_id){
        return res.status(403).json({mesaj: "Sadece kendi hesabınızı silebilirsiniz!"});
    }
    
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