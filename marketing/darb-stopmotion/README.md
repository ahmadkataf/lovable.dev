# درب — فيديو ستوب موشن (عربي + إنجليزي)

فيديو يوتيوب بأسلوب «اليوتيوبر المصدوم» يشرح فكرة نظام التوصيل بدون وسيط: المطعم ↔ السائق مباشرة، بدون نسبة،
مع «إيصالات موقّعة» مربوطة ببعضها (مثل البلوك تشين… بدون بلوك تشين). نفس الفيديو بنسختين:

| الملف | اللغة | المدة | المقاس |
|---|---|---|---|
| `Darb-stopmotion-ar.mp4` | عربي (لهجة بيضاء) | ≈ 2:29 | 1920×1080، 24 fps |
| `Darb-stopmotion-en.mp4` | English | ≈ 1:57 | 1920×1080، 24 fps |

المشاهد: الصدمة → المشكلة (العمولة 30%) → الاكتشاف (مثال البيتكوين والبنك) → كيف بيشتغل (3 بطاقات) →
الدفتر الموقّع → الكل رابح → النداء للاشتراك. الاسم «درب / Darb» مؤقت ومذكور في `script.json` و`stopmotion.html` (المفتاح `name`).

## كيف يُصنع الستوب موشن
كل شيء مرسوم كقصاصات ورق (SVG داخل `stopmotion.html`) على طاولة كرتون، ويُصوَّر إطاراً إطاراً عبر Playwright
بمعدل 12 إطاراً في الثانية «on twos»، مع اهتزاز طفيف عشوائي لكل قطعة وومضة إضاءة في كل إطار، وظهور العناصر
على 4 خطوات مع تجاوز بسيط (overshoot) بدل الحركة الناعمة. فم اليوتيوبر يتحرك حسب غلاف صوت التعليق.

## الصوت
- **التعليق الصوتي**: حالياً أصوات Microsoft Edge العصبية (`tts_edge.py`: `ar-JO-TaimNeural` و`en-US-AndrewMultilingualNeural`) كبديل مؤقت.
  للاستبدال بصوت Google Cloud Text-to-Speech: ضع المفتاح في `GOOGLE_API_KEY` (أو حساب خدمة في `GOOGLE_APPLICATION_CREDENTIALS`) ثم:
  ```bash
  python3 tts_google.py ar en     # يكتب vo/<lang>-<scene>.mp3 بأصوات Chirp 3 HD (قابلة للتغيير بـ VOICE_AR / VOICE_EN)
  ```
  وأعد الخطوات من `timeline.py` لأن مدد المشاهد تتبع مدد التعليق تلقائياً.
- **الموسيقى**: Mixkit «Playful» (رقم 10) برخصة Mixkit المجانية للاستخدام التجاري، لا تُوزَّع هنا: `curl -o music/10.mp3 https://assets.mixkit.co/music/10/10.mp3`
- **المؤثرات**: من Mixkit أيضاً (نفس الرخصة). نزّلها قبل المزج:
  ```bash
  mkdir -p sfx music && for id in 473 702 704 744 937 938 951 1104 1109 1133 1395 1440 1490 1492 1530 1939 1989 1993 1999 2003 2068 2350 2354 2356 2357 2358 2359 2364 2365 2368 2369 2380 2384 2385 2568 2627 2633 2731 2732 2853 2854 2867 2870 2894 2903 2918 2996 3005 3060 3062; do
    curl -s -o sfx/$id.mp3 https://assets.mixkit.co/active_storage/sfx/$id/$id-preview.mp3 && ffmpeg -loglevel error -y -i sfx/$id.mp3 -ar 44100 -ac 2 sfx/$id.wav; done
  ```
  (`sfx/info.json` يحمل زمن بداية كل مؤثر لمحاذاته مع الحدث البصري.)

## إعادة الإنتاج
```bash
python3 tts_edge.py ar en            # أو tts_google.py
python3 timeline.py ar en            # timeline-<lang>.json: بداية ونهاية كل مشهد + غلاف الصوت
python3 mix.py ar && python3 mix.py en   # mix-<lang>.wav
node render.mjs ar frames-ar 12 0-1786   # الإطارات (عدّل الحد الأعلى: total × 12)
node render.mjs en frames-en 12 0-1402
ffmpeg -framerate 12 -i frames-ar/f%05d.jpg -i mix-ar.wav -r 24 -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart Darb-stopmotion-ar.mp4
```
لمعاينة إطارات بعينها: `node render.mjs ar prev 12 "t:5.5,24,110"`.

## الخطوط
Cairo وLalezar (عربي) وBangers وFredoka (إنجليزي) من Google Fonts برخصة OFL، مضمّنة في `fonts/`.
