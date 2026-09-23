# رفع VAYRO على هوستنجر

## الخلاصة أولاً

| الجزء | أين يُرفع | لماذا |
|---|---|---|
| **صفحة الهبوط** (`frontend`) | Hostinger → **Static app** ✅ | ملفات ثابتة، مثالية لهذه الخطة |
| **لوحة التحكم** (`apps/dashboard`) | Hostinger → **Static app** ✅ | نفس الشيء |
| **الـ API** (`apps/api`) | **VPS (KVM 2)** — وليس خطة Node.js المُدارة ❌ | يحتاج متصفح Chrome وقرصاً دائماً وصلاحية root |

خطة «Push your code, we host it» ممتازة لواجهتَي المشروع. لكن الـ API **لا يعمل عليها**، لثلاثة أسباب تقنية:

1. **يحتاج Chromium مثبتاً على النظام.** `whatsapp-web.js` يشغّل متصفحاً حقيقياً لكل شركة. التثبيت يحتاج صلاحية root، وهوستنجر نفسها توصي بالـ VPS «لمن يحتاج صلاحية root وتبعيات النظام».
2. **كل عملية رفع تنشئ مجلداً جديداً.** جلسات واتساب محفوظة في `.wwebjs_auth` على القرص — ومع كل تحديث تُفقد، فيطلب كل رقم مسح QR من جديد.
3. **الذاكرة.** كل جلسة واتساب تستهلك 200–250 ميغا. خطط الاستضافة المُدارة لا تعطي هذا الهامش.

---

## 1) الـ API على VPS

```bash
# على الـ VPS (Ubuntu، صلاحية root)
sudo bash vps-setup.sh api.YOUR-DOMAIN.com you@example.com
```

ثم ارفع `apps/api` إلى `/home/vayro/api` واتبع [README.md](README.md) (الخطوات 2 و4 و5).

المتغيرات المطلوبة في `apps/api/.env` — انظر [env.production.example](env.production.example). المهم منها:

```
APP_PUBLIC_URL=https://api.YOUR-DOMAIN.com
DASHBOARD_ORIGIN=https://app.YOUR-DOMAIN.com
CORS_ALLOWED_ORIGINS=https://app.YOUR-DOMAIN.com,https://YOUR-DOMAIN.com
```

## 2) الواجهتان على Hostinger Static app

الخطة تسحب الكود من GitHub. المشروع حالياً **ليس** مستودع git، فالخطوات:

```bash
git init
git add .
git commit -m "VAYRO"
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

⚠️ **قبل الرفع:** ملف `apps/api/.env` يحتوي كلمة مرور قاعدة البيانات. هو مستثنى في `.gitignore` — تأكد أنه لم يُرفع (`git status` يجب ألا يظهره). والأفضل تغيير كلمة المرور من MongoDB Atlas بعد النقل.

ثم في هوستنجر أنشئ **تطبيقين static**:

| التطبيق | مجلد الجذر | أمر البناء | مجلد الإخراج |
|---|---|---|---|
| صفحة الهبوط | `frontend` | `npm ci && npm run build` | `dist` |
| لوحة التحكم | `apps/dashboard` | `npm ci && npm run build` | `dist` |

وأضف متغيّر البيئة لكل منهما قبل البناء:

```
VITE_API_BASE_URL=https://api.YOUR-DOMAIN.com
```

(ملف `.htaccess` موجود داخل `public/` في كلا المشروعين، فتعمل الروابط العميقة مثل `/support/inbox` بدون 404.)

## 3) ربط الدومين

| النطاق | النوع | القيمة | الوجهة |
|---|---|---|---|
| `YOUR-DOMAIN.com` | Static app | — | صفحة الهبوط |
| `app.YOUR-DOMAIN.com` | Static app | — | لوحة التحكم |
| `api.YOUR-DOMAIN.com` | سجل A | IP الـ VPS | الـ API |

بعد ربط `api` انتظر انتشار DNS ثم شغّل على الـ VPS:

```bash
certbot --nginx -d api.YOUR-DOMAIN.com
```

## 4) بعد الرفع

1. افتح `https://api.YOUR-DOMAIN.com/docs` للتأكد أن الـ API يعمل.
2. سجّل الدخول من `https://app.YOUR-DOMAIN.com`.
3. على كل موبايل: واتساب ← الأجهزة المرتبطة ← **احذف الأجهزة القديمة**، ثم امسح QR الجديد من صفحة «ربط واتساب».
4. تأكد أن كل شركة لها رقم خاص بها (رقم واحد لعدة شركات = انقطاع متكرر).

## بديل إن أردت كل شيء في مكان واحد

VPS واحد يكفي للثلاثة: الـ API عبر PM2، والواجهتان كملفات ثابتة يخدمها Nginx. عندها لا تحتاج خطة الاستضافة المُدارة إطلاقاً — أخبرني وأجهّز إعداد Nginx لذلك.
