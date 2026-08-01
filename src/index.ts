import express, {type Request,type Response, type NextFunction} from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import  jwt from 'jsonwebtoken';
import z from 'zod';

const app = express();
const PORT = 3000;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(express.json()); 

const registerSchema = z.object({
    email: z.email("Geçerli bir email girin."),
    sifre: z.string().min(6, "Şifreniz en az 6 karakter uzunluğunda olmalıdır."),
    isim: z.string().min(2, "İsminiz en az 2 karakter uzunluğunda olmalıdır.")
});

const loginSchema = z.object({
    email: z.email("Geçerli bir email girin."),
    sifre: z.string().min(6, "Şifreniz en az 6 karakter uzunluğunda olmalıdır."),
});

//GET isteği (örnek veri dönme)
app.get('/api/kullanici', async (req: Request, res: Response, next: NextFunction) => {
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
        next(error);
    }
});

app.post('/api/auth/register', async (req:Request, res: Response) => {
    const dogrulama = registerSchema.safeParse(req.body);

    if(!dogrulama.success) {
        return res.status(400).json({
            mesaj: "Girdiğiniz bilgiler kurallara uygun değil!",
            hatalar: dogrulama.error.issues
        });
    }

    const {email,sifre,isim} = dogrulama.data;

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
    const dogrulama = loginSchema.safeParse(req.body);

    if(!dogrulama.success) {
        return res.status(400).json({
            mesaj: "Hatalı email ya da şifre!",
            hatalar: dogrulama.error.issues
        });
    }
    const {email,sifre} = dogrulama.data;


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

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('🔥 Sunucu Hatası Yakalandı:', err.stack);

    return res.status(500).json({
        mesaj: 'Sunucu tarafında bir hata oluştu!',
        hata: err.message || 'Bilinmeyen hata'
    });
});