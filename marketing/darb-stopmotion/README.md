# درب — فيديوهات يوتيوب (عربي + إنجليزي)

فيديوان يشرحان فكرة نظام التوصيل بدون وسيط (المطعم ↔ السائق مباشرة، بدون نسبة، مع «إيصالات موقّعة» مربوطة ببعضها
مثل البلوك تشين… بدون بلوك تشين)، كل واحد بنسختين عربي وإنجليزي بنفس المشاهد. الاسم «درب / Darb» مؤقت (مفتاح `name` في الصفحات و`product` في ملفات السكربت).

| الملف | الأسلوب | اللغة | المدة | المقاس |
|---|---|---|---|---|
| `Darb-stopmotion-ar.mp4` | ستوب موشن ورقي، «يوتيوبر مصدوم»، تشويقة البيتكوين + الذكاء الاصطناعي، ينتهي بزر اشتراك | عربي | ≈ 2:10 | 1920×1080، 24 fps |
| `Darb-stopmotion-en.mp4` | نفسه | English | ≈ 2:10 | 1920×1080، 24 fps |
| `Darb-cinematic-ar.mp4` | وثائقي سينمائي داكن («ثلاث مرات اختفى الوسيط»)، إعلان غير مباشر، بدون زر اشتراك | عربي | ≈ 3:01 | 1920×1080، 24 fps |
| `Darb-cinematic-en.mp4` | نفسه | English | ≈ 3:30 | 1920×1080، 24 fps |
| `Darb-short-ar.mp4` / `-en.mp4` | شورت عمودي 9:16 بنفس أسلوب الستوب موشن والهايب، إعلاني غير مباشر (ينتهي بـ«درب… قريباً بحارتك» بدون زر اشتراك) | عربي / English | ≈ 0:49 / 0:45 | 1080×1920، 24 fps |
| `Darb-hook-ar.mp4` / `-en.mp4` | شورت عمودي بأسلوب «إيصالات ورقية في عالم داكن» (موشن جرافيك واجهات بأسلوب إطلاق المنتجات): هوك الفاتورتين «نفس الشاورما… 10 مقابل 12.50» في أول 3 ثوانٍ، شطب «شركة توصيل»، محاكاة تطبيق بثلاث خطوات مع شريط تقدم 1/3، ختمان، سلسلة إيصالات، عدّاد العمولة 2.50 ← 0.00، ترجمة كلمة‑بكلمة، نهاية ناعمة بدون زر اشتراك | عربي / English | ≈ 0:46 / 0:47 | 1080×1920، 30 fps |

## الملفات
- `stopmotion.html` + `script.json`: الفيديو الأول. كل شيء مرسوم كقصاصات ورق (SVG) على طاولة كرتون، يُصوَّر إطاراً إطاراً عبر Playwright بـ12 إطاراً في الثانية «on twos» مع اهتزاز وومضة إضاءة، وفم اليوتيوبر يتحرك حسب غلاف صوت التعليق.
- `cinematic.html` + `script2.json`: الفيديو الثاني. خلفية داكنة بحبيبات فيلم وشرائط سينمائية، نص حركي، أيقونات خطية تُرسم تدريجياً، خط زمني (2009 البيتكوين، 2022 الذكاء الاصطناعي، 2026 ؟)، شريط العمولة، نمط «الوسيط»، بطاقات التجربة، سلسلة الإيصالات، ونهاية بسؤال بدل النداء للاشتراك. يُصوَّر بـ24 إطاراً في الثانية.
- `short.html` (يُولَّد من `build_short.py` + `script3.json`): الشورت العمودي، يعيد استخدام قصاصات الستوب موشن بتخطيط 1080×1920 ولقطات سريعة؛ `mix3.py` صوته (تعليق + مؤثرات).
- `hook.html` + `script4.json`: الشورت الرابع (أسلوب مختلف كلياً، مبني على بحث في أقوى فيديوهات الشورت التسويقية: هوك رقمي في الإطار الأول، تغيير بصري كل 2–5 ثوانٍ، حلقات مفتوحة، ترجمة متزامنة مع الكلمات، نهاية بدون نداء اشتراك). كل شيء دالة في الزمن `render(t)`: الإيصالات الحرارية (clip‑path مسنّن)، قصاصة «+2.50» التي تُنتزع في الهوك وتعود في مشهد الأدوار، الهاتف بثلاث شاشات، حلقة اللمس والأختام، سلسلة الإيصالات (SVG)، العدّاد، وبطاقة «درب» المقلوبة. `wordtimes.py` يقدّر زمن كل كلمة من غلاف الصوت (تُدمج في `timeline4-<lang>.json`)، `hits.mjs` يصدّر قائمة الضربات/المؤثرات من الصفحة نفسها إلى `hits4-<lang>.json` كي تتطابق الحركة والصوت، و`mix4.py` يمزج التعليق مع المؤثرات فقط. `tighten.py` يقصّ الصمت ويضغط الوقفات ويسرّع التعليق قليلاً (`vo4/` الأصل، `vo4t/` المستخدم).
- `timeline.py`: يبني `timeline*-<lang>.json` (بداية ونهاية كل مشهد من مدد التعليق + غلاف الصوت). للفيديو الثاني: `SCRIPT=script2.json VO=vo2 TLPREFIX=timeline2 TAIL_CTA=4 python3 timeline.py ar en`.
- `mix.py` / `mix2.py`: التعليق + مؤثرات (والموسيقى اختيارية: الإصدار المنشور بدون موسيقى، أي `NO_MUSIC=1`)، بأزمنة تطابق كسور المشاهد في الصفحات.
- `render.mjs`: `node render.mjs <lang> <outDir> <fps> <a-b | t:1,2,3> [page.html] [timelinePrefix]`.
- `overlap.mjs`: فحص آلي كل ربع ثانية لأي نصين متراكبين أو نص خارج الشاشة: `node overlap.mjs ar cinematic.html timeline2 .t`.
- `vo/` و`vo2/`: مقاطع التعليق لكل مشهد (الناتج النهائي من Gemini).

## الصوت
**التعليق** من Gemini TTS (`gemini-3.8-flash-tts` عبر Interactions API) بسكربت `tts_gemini.py`: طلب واحد لكل لغة لكل فيديو (النص كاملاً مع `<long pause>` بين المشاهد)،
ثم يُقسَّم الملف إلى مشاهد عند الصمت الأقرب للحصة المتوقعة من الأحرف. الأصوات المستخدمة:

| الفيديو | عربي | إنجليزي | الأسلوب |
|---|---|---|---|
| ستوب موشن | `ar-001-commercial-3` | `Fenrir` | excited, energetic YouTuber delivery |
| سينمائي | `ar-001-advisor-2` | `Charon` | calm, suspenseful documentary narration |
| شورت الهوك | `ar-001-commercial-3` | `Fenrir` | confident, punchy, fast-paced launch-video voiceover, Levantine dialect |

```bash
export GEMINI_API_KEY=...        # المفتاح من البيئة فقط، لا يُكتب في أي ملف
python3 tts_gemini.py --script script.json  --out vo  --voice-ar ar-001-commercial-3 --voice-en Fenrir --style "excited, energetic YouTuber delivery, clear, fast pace"
python3 tts_gemini.py --script script2.json --out vo2 --voice-ar ar-001-advisor-2   --voice-en Charon --style "calm, suspenseful documentary narration, deliberate pace"
python3 tts_gemini.py --script script4.json --out vo4 --voice-ar ar-001-commercial-3 --voice-en Fenrir --style "confident, punchy, fast-paced launch-video voiceover, energetic and crisp, clear pronunciation, Jordanian Levantine dialect for the Arabic"
```
الحصة المجانية 10 طلبات يومياً للموديل (تُصفّر منتصف الليل بتوقيت المحيط الهادئ)؛ الخروج برمز 3 يعني نفاد الحصة.
`gemini_tts.py` و`add_voice.py` هما مساعدا الـbrief الأصليان (بدون المفتاح). `tts_edge.py` بديل مجاني مؤقت (أصوات Edge).

**الموسيقى والمؤثرات** من Mixkit (رخصة مجانية للاستخدام التجاري)، لا تُوزَّع هنا؛ نزّلها قبل المزج:
```bash
mkdir -p music sfx
for id in 10 188 676; do curl -s -o music/$id.mp3 https://assets.mixkit.co/music/$id/$id.mp3; done   # Playful · Echoes · Epical Drums 01
for id in 473 490 494 577 632 662 679 702 704 744 772 788 790 835 937 938 951 1022 1104 1109 1133 1143 1368 1372 1382 1395 1440 1490 1492 1530 1939 1989 1993 1999 2003 2068 2180 2182 2350 2354 2356 2357 2358 2359 2364 2365 2368 2369 2380 2384 2385 2568 2595 2627 2633 2655 2731 2732 2853 2854 2867 2870 2894 2902 2903 2918 2950 2996 3005 3060 3062 3133; do
  curl -s -o sfx/$id.mp3 https://assets.mixkit.co/active_storage/sfx/$id/$id-preview.mp3 && ffmpeg -loglevel error -y -i sfx/$id.mp3 -ar 44100 -ac 2 sfx/$id.wav; done
```
(`sfx/info.json` يحمل زمن بداية وذروة كل مؤثر لمحاذاته مع الحدث البصري، و`sfx/names.json` أسماءها في Mixkit.)

## إعادة الإنتاج
```bash
python3 timeline.py ar en && NO_MUSIC=1 python3 mix.py ar && NO_MUSIC=1 python3 mix.py en   # بدون NO_MUSIC تُضاف الموسيقى
node render.mjs ar frames-ar 12 0-1554 && node render.mjs en frames-en 12 0-1555
ffmpeg -framerate 12 -i frames-ar/f%05d.jpg -i mix-ar.wav -r 24 -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart Darb-stopmotion-ar.mp4

SCRIPT=script2.json VO=vo2 TLPREFIX=timeline2 TAIL_CTA=4 python3 timeline.py ar en && NO_MUSIC=1 python3 mix2.py ar && NO_MUSIC=1 python3 mix2.py en
node render.mjs ar frames2-ar 24 0-4347 cinematic.html timeline2 && node render.mjs en frames2-en 24 0-5047 cinematic.html timeline2
ffmpeg -framerate 24 -i frames2-ar/f%05d.jpg -i mix2-ar.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart Darb-cinematic-ar.mp4

# الشورت العمودي (المقاس عبر VW/VH)
python3 build_short.py && SCRIPT=script3.json VO=vo3 TLPREFIX=timeline3 TAIL_CTA=1.5 python3 timeline.py ar en && python3 mix3.py ar && python3 mix3.py en
VW=1080 VH=1920 node render.mjs ar frames3-ar 12 0-593 short.html timeline3
ffmpeg -framerate 12 -i frames3-ar/f%05d.jpg -i mix3-ar.wav -r 24 -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart Darb-short-ar.mp4
```
(الحد الأعلى للإطارات = `total` في ملف التايملاين × معدل الإطارات.)

```bash
# شورت الهوك (30 إطاراً في الثانية؛ الترجمة والضربات مستخرجة من الصفحة نفسها)
python3 tighten.py vo4 vo4t 1.12 ar && python3 tighten.py vo4 vo4t 1.15 en
HEAD=0 LEAD=0.1 TAIL=0.45 TAIL_CTA=2.2 SCRIPT=script4.json VO=vo4t TLPREFIX=timeline4 python3 timeline.py ar en
python3 wordtimes.py --script script4.json --vo vo4t --timeline timeline4 --out words4   # ثم تُدمج words4-<lang>.json في timeline4-<lang>.json تحت المفتاح words
node hits.mjs ar && python3 mix4.py ar && node hits.mjs en && python3 mix4.py en
VW=1080 VH=1920 node render.mjs ar frames4-ar 30 0-1393 hook.html timeline4 && VW=1080 VH=1920 node render.mjs en frames4-en 30 0-1422 hook.html timeline4
ffmpeg -framerate 30 -i frames4-ar/f%05d.jpg -i mix4-ar.wav -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart Darb-hook-ar.mp4
VW=1080 VH=1920 node overlap.mjs ar hook.html timeline4 ".hl, .w, .pill, .chip, .card, .bub, .rr, .bh"   # فحص التراكب
```

## الخطوط
Cairo وLalezar وChanga (عربي)، Bangers وFredoka وBebas Neue وOswald وInter (إنجليزي)، وللشورت الرابع Noto Kufi Arabic وTajawal وIBM Plex Sans Arabic وIBM Plex Mono، كلها من Google Fonts برخصة OFL ومضمّنة في `fonts/`.
