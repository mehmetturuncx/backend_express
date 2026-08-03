import multer from 'multer';
import path from 'path';

// 1. Dosyanın Nereye ve Hangi İsimle Kaydedileceğini Belirliyoruz (Storage)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Dosyalar projenin ana dizinindeki 'uploads' klasörüne kaydedilecek
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // İsim çakışmalarını önlemek için dosya adının başına timestamp (zaman damgası) ekliyoruz
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Orijinal uzantıyı (.jpg, .png vs.) koruyoruz
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// 2. Güvenlik: Sadece Belirli Dosya Tiplerine İzin Ver (Örn: Sadece Resimler)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        // Dosya türü resimse kabul et
        cb(null, true);
    } else {
        // Değilse hata fırlat
        cb(new Error('Sadece resim dosyaları yüklenebilir!'));
    }
};

// 3. Multer Objesini Dışa Aktar (Boyut sınırı: 2MB)
export const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2 Megabyte
    }
});