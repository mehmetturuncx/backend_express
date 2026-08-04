import express, {type Request,type Response, type NextFunction} from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import  jwt from 'jsonwebtoken';
import z from 'zod';
import {redis} from './redis.js';
import rateLimit from 'express-rate-limit';
import {RedisStore} from 'rate-limit-redis';
import morgan from 'morgan';
import {logger} from '../src/utils/logger.js';
import { upload } from './middalewares/upload.js';

const PORT = 3000;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
export const app = express();

app.use(express.json()); 
app.use('/uploads', express.static('uploads'));

const genelLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args: string[]) => {
            const command = args[0]!;
            const commandArgs = args.slice(1);
            return redis.call(command, ...commandArgs) as any;
        },
    }),
    message: {error: 'Çok fazla istek attınız, lütfen daha sonra tekrar deneyim.'}
});

app.use(genelLimiter);

const morganFormat = "dev";

app.use(morgan(morganFormat, {
    stream: {
        write: (message) => {
            logger.info(message.trim());
        }
    }
}));

const registerSchema = z.object({
    email: z.email("Geçerli bir email girin."),
    sifre: z.string().min(6, "Şifreniz en az 6 karakter uzunluğunda olmalıdır."),
    isim: z.string().min(2, "İsminiz en az 2 karakter uzunluğunda olmalıdır.")
});

const loginSchema = z.object({
    email: z.email("Geçerli bir email girin."),
    sifre: z.string().min(6, "Şifreniz en az 6 karakter uzunluğunda olmalıdır."),
});

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

app.get('/api/kullanici', authKontrol, async (req: AuthRequest, res: Response, next) => {
    const kullaniciId = req.kullaniciId;
    if(!kullaniciId) {
        return res.status(401).json({mesaj: "Kullanıcı doğrulanamadı!"});
    }
    let {sayfa, limit} = req.query;

    const sayfaNumarasi = Number(sayfa) || 1;
    const limitSayisi = Number(limit) || 10;

    const skip = (sayfaNumarasi - 1) * limitSayisi;
    
    try {
        const cacheKey = `kullanicilar_${sayfaNumarasi}_${limitSayisi}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return res.status(200).json(JSON.parse(cachedData));
        }
        const toplamKayit = await prisma.kullanici.count();
        const toplamSayfa = Math.ceil(toplamKayit / limitSayisi);

        const kullanicilar = await prisma.kullanici.findMany({
            select: { id: true, isim: true, email: true, rol: true },
            skip:skip,
            take: limitSayisi,
        });

        const responseData = {
            kaynak: 'database',
            data: kullanicilar,
            sayfa: sayfaNumarasi,
            sayfaSayisi: toplamSayfa,
            kayitSayisi: toplamKayit,
        };

        await redis.setex(
            cacheKey, 
            60, 
            JSON.stringify({ 
                kaynak: 'cache',
                data: responseData.data,
                sayfa: responseData.sayfa,
                sayfaSayisi: responseData.sayfaSayisi,
                kayitSayisi: responseData.kayitSayisi
            })
        );

        res.status(200).json({
            kaynak: 'database',
            data: kullanicilar,
            sayfa: sayfaNumarasi,
            sayfaSayisi: toplamSayfa,
            kayıtSayisi: toplamKayit,
        });
    } catch (error) {
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

        const keys = await redis.keys('kullanicilar_*');

        if (keys.length > 0) {
            await redis.del(...keys);
        }

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
});

app.post('/api/kullanici/avatar', authKontrol, upload.single('profil_foto'), async (req: AuthRequest,res: Response) => {
    if (!req.file) {
        return res.status(400).json({hata: "Dosya yüklenemedi veya geçersiz format!"});
    }

    const erisimLinki = `http://localhost:3000/uploads/${req.file.filename}`;
    const kullaniciId = req.kullaniciId;

    if(!kullaniciId) {
        return res.status(401).json({hata: "Kullanıcı doğrulanamadı!"});
    }
    
    try{
        await prisma.kullanici.update({
            where: {id: kullaniciId},
            data: {avatar: erisimLinki}
        });
        res.status(200).json({
            mesaj: "Profil fotoğrafı başarıyla yüklendi",
            dosyaYolu: req.file.path,
            dosyaAdi: req.file.filename,
            erisimLinki: erisimLinki
        });
    }
    catch (error) {
        return res.status(500).json({mesaj: "Veritabanı güncellernirken bir hata oluştu!"});
    }
});

interface AuthRequest extends Request {
    kullaniciId?: number;
    kullaniciRol?: string;
}

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

if (process.env.NODE_ENV !== 'test') {
    app.listen(3000, () => {
        console.log('Sunucu http://localhost:3000 adresinde çalışıyor...');
    });
}
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('🔥 Sunucu Hatası Yakalandı:', err.stack);

    return res.status(500).json({
        mesaj: 'Sunucu tarafında bir hata oluştu!',
        hata: err.message || 'Bilinmeyen hata'
    });
});