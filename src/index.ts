import express, {type Request,type Response} from 'express';
import { isIP } from 'node:net';

const app = express();
const PORT = 3000;

app.use(express.json()); 

// Tüm kullanıcı listesini (diziyi) dönen doğru GET endpoint'i
app.get('/api/kullanici', (req: Request, res: Response) => {
  res.json(kullanicilar); // Tek bir obje { id: 1 ... } DEĞİL, doğrudan "kullanicilar" dizisini dönüyoruz
});

//GET isteği (örnek veri dönme)
app.get('/api/kullanici', (req: Request, res: Response) => {
    res.json({
        id: 1,
        isim: 'Mehmet',
        rol: 'Öğrenci',
        durum: 'Aktif'
    });
});

//Kullanıcı listesi
let kullanicilar = [
    {id: 1, isim: 'Mehmet', rol: 'Öğrenci', durum:"Aktif"}
];

//POST isteği
app.post('/api/kullanici', (req: Request, res: Response) => {
    const {isim, rol} = req.body;

    if (!isim || !rol) {
        return res.status(400).json({
            hata: 'İsim ve rol alanları zorunludur!'
        });
    }

    const yeniKullanci = {
        id: kullanicilar.length+1,
        isim:isim,
        rol:rol,
        durum: 'Aktif'
    };

    kullanicilar.push(yeniKullanci);

    res.status(201).json({
        mesaj: 'Kullanıcı başarıyla eklendi',
        kullanıcı: yeniKullanci
    });
});



app.delete('/api/kullanici/:id', (req: Request, res: Response) => {
    const silinecek_id = Number(req.params.id);
    
    const varMi = kullanicilar.find(k => k.id === silinecek_id);

    if(!varMi) {
        return res.status(404).json({
            mesaj: "Bu id'ye sahip kullanıcı bulunamadı!"
        });
    }

    kullanicilar = kullanicilar.filter(k => k.id !== silinecek_id);

    return res.json({
    mesaj: 'Kullanıcı başarıyla silindi',
    silinenId: silinecek_id
    });
});

app.put('/api/kullanici/:id', (req: Request, res: Response) => {
  const gelenId = Number(req.params.id);

  const mevcutKullanici = kullanicilar.find(k => k.id === gelenId);

  if (!mevcutKullanici) {
    return res.status(404).json({
      mesaj: "Bu id'ye sahip kullanıcı bulunamadı!"
    });
  }

  if (req.body.isim) mevcutKullanici.isim = req.body.isim;
  if (req.body.rol) mevcutKullanici.rol = req.body.rol;

  return res.json({
    mesaj: 'Kullanıcı güncellendi',
    kullanici: mevcutKullanici
  });
});

//Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`)
});