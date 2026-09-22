import type { Exam } from '../../../engine/types'

// A Term 2 practice paper in the exact format of the real final exam (Units 7–12).
export const term2F: Exam = {
  id: 't2-f',
  term: 2,
  title: 'Term 2 — Test (F)',
  titleAr: 'الفصل الثاني — النموذج (F)',
  minutes: 60,
  totalMarks: 400,
  sourceAr: 'نموذج تدريبي بشكل الامتحان النهائي يغطي الوحدات 7–12 (النصان من الوحدتين 8 و10، والتعبير من الوحدة 7).',
  sections: [
    {
      letter: 'A',
      title: 'Read the following text then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ النص التالي ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 50,
      passage: {
        paragraphs: [
          "In every country, people wear different kinds of clothes. Some of these clothes are traditional, and others follow the newest fashion. Traditional clothes are passed from one generation to the next. They represent a country's culture and identity. In Syria, for example, women in the villages used to wear long, colourful dresses, and men wore wide trousers and long coats. Today, many people still wear these clothes at weddings and national celebrations. On the other hand, most young people today prefer modern fashion. They want to look fashionable and up to date, so they follow the newest trends on the internet and on TV. They buy jeans, T-shirts, modern footwear and accessories. Fashion designers hold fashion shows every year to impress people with their new designs. Fashion is one of the biggest industries in the world. Some people who go abroad adopt western trends and forget their own traditions. However, many young designers today mix the old and the new. They add a modern twist to traditional clothes. For example, they make modern dresses with {their} grandmothers' traditional designs. In this way, people can keep their identity and look fashionable at the same time. I think this is the best way to love both fashion and tradition.",
        ],
        paragraphsAr: [
          'يرتدي الناس في كل بلد أنواعاً مختلفة من الملابس، بعضها تقليدي وبعضها يتبع أحدث صيحات الموضة. تنتقل الملابس التقليدية من جيل إلى الجيل الذي يليه، وهي تمثّل ثقافة البلد وهويته. ففي سوريا مثلاً كانت النساء في القرى يرتدين فساتين طويلة ملوّنة، وكان الرجال يرتدون سراويل واسعة ومعاطف طويلة. واليوم ما يزال كثير من الناس يرتدون هذه الملابس في الأعراس والاحتفالات الوطنية. ومن ناحية أخرى، يفضّل معظم الشباب اليوم الموضة الحديثة، فهم يريدون أن يبدوا عصريين ومواكبين للجديد، لذلك يتابعون أحدث الصيحات على الإنترنت والتلفاز، ويشترون الجينز والقمصان القطنية والأحذية والإكسسوارات الحديثة. ويقيم مصمّمو الأزياء عروض أزياء كل عام ليبهروا الناس بتصاميمهم الجديدة. والموضة من أكبر الصناعات في العالم. بعض من يسافرون إلى الخارج يتبنّون الصيحات الغربية وينسون تقاليدهم. لكن كثيراً من المصمّمين الشباب اليوم يمزجون القديم بالجديد، فيضيفون لمسة عصرية إلى الملابس التقليدية؛ فمثلاً يصنعون فساتين حديثة بتصاميم جدّاتهم التقليدية. وبهذه الطريقة يستطيع الناس أن يحافظوا على هويتهم ويبدوا عصريين في الوقت نفسه. أظن أن هذه أفضل طريقة لنحب الموضة والتقاليد معاً.',
        ],
      },
      questions: [
        { n: 1, kind: 'mcq', prompt: 'Traditional clothes are passed ___.', promptAr: 'تنتقل الملابس التقليدية ___.', options: ['from one country to another', 'from designers to shops', 'from one generation to the next', 'from the internet to TV'], answer: 2, explainAr: 'النص: "Traditional clothes are passed from one generation to the next" — من جيل إلى الجيل الذي يليه.' },
        { n: 2, kind: 'mcq', prompt: 'Many young designers today ___.', promptAr: 'كثير من المصمّمين الشباب اليوم ___.', options: ['forget their own traditions', 'mix traditional clothes with modern fashion', 'only make western clothes', 'never hold fashion shows'], answer: 1, explainAr: 'النص: "many young designers today mix the old and the new. They add a modern twist to traditional clothes" أي يمزجون التقليدي بالحديث.' },
        { n: 3, kind: 'mcq', prompt: 'What does "their" in the text refer to?', promptAr: 'إلامَ تعود كلمة "their" في النص؟', options: ['young designers', 'people who go abroad', 'traditions', 'modern dresses'], answer: 0, explainAr: 'الجملة: "they make modern dresses with their grandmothers\' traditional designs" — و they هنا تعود على young designers، فجدّاتهم هنّ جدّات المصمّمين الشباب.' },
        { n: 4, kind: 'mcq', prompt: '"Fashionable" is the opposite of:', promptAr: 'كلمة "Fashionable" (عصري/مواكب للموضة) عكسها:', options: ['up to date', 'old-fashioned', 'confident', 'stylish'], answer: 1, explainAr: 'fashionable = يتبع الموضة الحالية، وعكسها old-fashioned = قديم الطراز. أما up to date و stylish فمعناهما قريب منها.' },
        { n: 5, kind: 'mcq', prompt: '"Adopt" means ___.', promptAr: 'كلمة "Adopt" تعني ___.', options: ['to depend on', 'to change', 'to take and use as your own', 'to make someone admire you'], answer: 2, explainAr: 'adopt = يتبنّى، أي يأخذ الشيء ويستخدمه كأنه له. أما الخيارات الأخرى فهي معاني rely on و alter و impress.' },
      ],
    },
    {
      letter: 'B',
      title: 'Read the following text then write if the sentences are True or False:',
      titleAr: 'اقرأ النص التالي ثم اكتب إن كانت الجمل صحيحة أم خاطئة:',
      marks: 50,
      passage: {
        paragraphs: [
          "Since her childhood, Rama has had a passion for drawing. When she was five years old, she drew pictures of trees, birds and people on every piece of paper at home. Her parents noticed her talent and her great imagination, so they bought her colours and books about art. When Rama grew up, her ambition was to become a famous painter. But the road wasn't easy. Some people told her, \"You can't make a living from painting. Study something else!\" In her first art competition, she failed and didn't win any prize. It was a big setback, but Rama didn't make excuses and she didn't quit. She was convinced that every failure was one step closer to success. Rama invested a lot of time in her skills. She practised drawing for three hours every day, and she took lessons with an old painter in her town. Her passion kept her focused and on track. Last year, Rama's paintings were shown in an exhibition in Damascus. Many people came to see her work, and some of her paintings were bought by visitors. Now Rama gives art lessons to children. She tells them, \"Your creativity is a gift. Don't let anyone stop you from following your dreams.\"",
        ],
        paragraphsAr: [
          'منذ طفولتها، لدى راما شغف بالرسم. عندما كانت في الخامسة رسمت أشجاراً وطيوراً وأشخاصاً على كل قطعة ورق في البيت. لاحظ والداها موهبتها وخيالها الواسع، فاشتريا لها ألواناً وكتباً عن الفن. عندما كبرت راما كان طموحها أن تصبح رسّامة مشهورة، لكن الطريق لم يكن سهلاً. قال لها بعض الناس: "لا يمكنك أن تكسبي عيشك من الرسم. ادرسي شيئاً آخر!" وفي أول مسابقة فنية شاركت فيها أخفقت ولم تفز بأي جائزة. كانت تلك انتكاسة كبيرة، لكن راما لم تختلق الأعذار ولم تستسلم، فقد كانت مقتنعة بأن كل إخفاق هو خطوة أقرب إلى النجاح. استثمرت راما وقتاً كثيراً في مهاراتها، فكانت تتدرّب على الرسم ثلاث ساعات كل يوم، وأخذت دروساً عند رسّام عجوز في بلدتها. أبقاها شغفها مركّزة وعلى الطريق الصحيح. في العام الماضي عُرضت لوحات راما في معرض في دمشق، وجاء كثير من الناس ليروا أعمالها، واشترى الزوّار بعض لوحاتها. والآن تعطي راما دروساً في الرسم للأطفال، وتقول لهم: "إبداعكم هبة. لا تدعوا أحداً يمنعكم من اتباع أحلامكم."',
        ],
      },
      questions: [
        { n: 6, kind: 'truefalse', prompt: 'Rama started drawing when she was a child.', promptAr: 'بدأت راما الرسم عندما كانت طفلة.', answer: true, explainAr: 'النص: "Since her childhood ... When she was five years old, she drew pictures".' },
        { n: 7, kind: 'truefalse', prompt: "Rama's parents didn't help her with her hobby.", promptAr: 'لم يساعد والدا راما ابنتهما في هوايتها.', answer: false, explainAr: 'النص: "Her parents noticed her talent ... so they bought her colours and books about art" — فقد ساعداها.' },
        { n: 8, kind: 'truefalse', prompt: 'Rama won a prize in her first art competition.', promptAr: 'فازت راما بجائزة في أول مسابقة فنية.', answer: false, explainAr: 'النص: "In her first art competition, she failed and didn\'t win any prize."' },
        { n: 9, kind: 'truefalse', prompt: 'Rama practised drawing for three hours every day.', promptAr: 'تدرّبت راما على الرسم ثلاث ساعات كل يوم.', answer: true, explainAr: 'النص: "She practised drawing for three hours every day".' },
        { n: 10, kind: 'truefalse', prompt: 'Now Rama teaches children how to draw.', promptAr: 'تعلّم راما الأطفال الرسم الآن.', answer: true, explainAr: 'النص: "Now Rama gives art lessons to children."' },
      ],
    },
    {
      letter: 'C',
      title: 'Read the sentences then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ الجمل ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 200,
      questions: [
        { n: 11, kind: 'mcq', topic: 'grammar', prompt: 'Our new house is ___ than the old one.', promptAr: 'بيتنا الجديد ___ من القديم.', options: ['larger', 'more large', 'largger', 'the largest'], answer: 0, explainAr: 'نقارن بين بيتين ومعنا than. large تنتهي بـ e فنضيف -r فقط: larger.' },
        { n: 12, kind: 'mcq', topic: 'grammar', prompt: 'Layan is ___ than her friends. She always makes them laugh.', promptAr: 'ليان ___ من صديقاتها. إنها تضحكهن دائماً.', options: ['funnyer', 'more funny', 'funnier', 'the funniest'], answer: 2, explainAr: 'funny تنتهي بـ y، فنقلب y إلى i ونضيف -er: funnier (مع than).' },
        { n: 13, kind: 'mcq', topic: 'grammar', prompt: 'These are ___ shoes I have.', promptAr: 'هذا ___ حذاء أملكه.', options: ['more comfortable', 'the most comfortable', 'the comfortablest', 'most comfortable'], answer: 1, explainAr: 'نقارن هذا الحذاء بكل أحذيتي فنستخدم التفضيل، و comfortable صفة طويلة: the most comfortable.' },
        { n: 14, kind: 'mcq', topic: 'grammar', prompt: 'Basel is ___ player in our football team.', promptAr: 'باسل ___ لاعب في فريق كرة القدم لدينا.', options: ['the goodest', 'better', 'the better', 'the best'], answer: 3, explainAr: 'good صفة شاذة، وصيغة التفضيل منها the best (نقارن باسل بكل لاعبي الفريق).' },
        { n: 15, kind: 'mcq', topic: 'grammar', prompt: 'My sister always takes my things. I wish she ___ ask me first.', promptAr: 'أختي تأخذ أشيائي دائماً. أتمنى لو ___ تستأذنني أولاً.', options: ['will', 'would', 'is', 'does'], answer: 1, explainAr: 'نتمنى أن يغيّر شخص آخر تصرّفه فنستخدم wish + would + الفعل المجرد: I wish she would ask.' },
        { n: 16, kind: 'mcq', topic: 'grammar', prompt: 'I live far from my school. I wish I ___ near it.', promptAr: 'أسكن بعيداً عن مدرستي. أتمنى لو ___ قريباً منها.', options: ['live', 'will live', 'lived', 'am living'], answer: 2, explainAr: 'نتمنى عكس الواقع الحاضر فنستخدم wish + الماضي البسيط: I wish I lived.' },
        { n: 17, kind: 'mcq', topic: 'grammar', prompt: 'Your father has got a new car, ___?', promptAr: 'أبوك لديه سيارة جديدة، ___؟', options: ['has he', "doesn't he", "hasn't he", "isn't he"], answer: 2, explainAr: 'الفعل المساعد في الجملة has، والجملة مثبتة فالذيل منفي، والفاعل father فالضمير he: hasn\'t he?' },
        { n: 18, kind: 'mcq', topic: 'grammar', prompt: 'I am late, ___?', promptAr: 'لقد تأخّرت، ___؟', options: ["aren't I", 'am not I', "isn't I", "don't I"], answer: 0, explainAr: 'حالة خاصة: ذيل I am المثبتة هو aren\'t I.' },
        { n: 19, kind: 'mcq', topic: 'grammar', prompt: 'Mouayyad waited for ___ hour at the bus station.', promptAr: 'انتظر مؤيّد ___ ساعة في محطة الحافلات.', options: ['a', 'an', 'the', 'no article'], answer: 1, explainAr: 'حرف h في hour صامت، فالكلمة تبدأ بصوت حرف علة، لذلك نستخدم an: an hour.' },
        { n: 20, kind: 'mcq', topic: 'grammar', prompt: 'Science-fiction movies ___ by millions of people every year.', promptAr: 'أفلام الخيال العلمي ___ من قِبَل ملايين الناس كل عام.', options: ['watch', 'are watching', 'is watched', 'are watched'], answer: 3, explainAr: 'الأفلام لا تشاهِد بل تُشاهَد (by millions of people)، وهي حقيقة متكررة (every year) والفاعل جمع: are + التصريف الثالث: are watched.' },
        { n: 21, kind: 'mcq', topic: 'pronunciation', prompt: 'The word "generation" has ___ syllables.', promptAr: 'كلمة "generation" تتكون من ___ مقاطع صوتية.', options: ['two', 'three', 'four', 'five'], answer: 2, explainAr: 'ge-ne-ra-tion = أربعة مقاطع، لكل مقطع صوت حرف علة واحد.' },
        { n: 22, kind: 'mcq', topic: 'pronunciation', prompt: "The word that doesn't have /ʃ/ sound is:", promptAr: 'الكلمة التي لا تحتوي على الصوت /ʃ/ هي:', options: ['pressure', 'shy', 'chin', 'insurance'], answer: 2, explainAr: 'ch في chin تُلفظ /tʃ/ (تش). أما shy ففيها sh /ʃ/، و pressure و insurance يُلفظ فيهما s بصوت /ʃ/.' },
        { n: 23, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has /f/ sound is:', promptAr: 'الكلمة التي تحتوي على الصوت /f/ هي:', options: ['vet', 'of', 'vine', 'proof'], answer: 3, explainAr: 'proof تُلفظ بـ /f/. أما vet و vine ففيهما /v/، و of تُكتب بـ f لكنها تُلفظ /v/.' },
        { n: 24, kind: 'mcq', topic: 'grammar', prompt: 'My cousin speaks ___ English very well.', promptAr: 'ابن عمّي يتكلم ___ الإنجليزية جيداً جداً.', options: ['a', 'an', 'the', 'no article'], answer: 3, explainAr: 'لا نستخدم أداة قبل أسماء اللغات: speak English.' },
        { n: 25, kind: 'mcq', topic: 'grammar', prompt: 'The old castle started ___ again last year.', promptAr: 'بدأت ___ القلعة القديمة من جديد العام الماضي.', options: ['to build', 'to be built', 'building', 'be built'], answer: 1, explainAr: 'القلعة لا تبني نفسها، وبعد فعل آخر (started) يكون المبني للمجهول: to be + التصريف الثالث: to be built (مثل Movies started to be made).' },
        { n: 26, kind: 'mcq', topic: 'wordform', prompt: 'UFOs are still a ___ phenomenon for many people.', promptAr: 'ما تزال الأجسام الطائرة المجهولة ظاهرة ___ لكثير من الناس.', options: ['mystery', 'mysterious', 'mysteriously', 'mysteries'], answer: 1, explainAr: 'قبل الاسم (phenomenon) نحتاج صفة: mysterious (غامضة). أما mystery فاسم، و mysteriously حال.' },
        { n: 27, kind: 'mcq', topic: 'vocab', prompt: 'Not recognised; not known what it is:', promptAr: 'غير معروف؛ لا يُعرف ما هو:', options: ['supernatural', 'unidentified', 'emotional', 'logical'], answer: 1, explainAr: 'unidentified = مجهول الهوية، ومنها UFO = unidentified flying object (الوحدة الثانية عشرة).' },
        { n: 28, kind: 'mcq', topic: 'vocab', prompt: 'An excessively talkative person:', promptAr: 'شخص كثير الكلام جداً:', options: ['chatterbox', 'illusionist', 'designer', 'swimmer'], answer: 0, explainAr: 'chatterbox = ثرثار، كثير الكلام (الوحدة السابعة).' },
        { n: 29, kind: 'mcq', topic: 'vocab', prompt: 'Something you hope to achieve; an aim is called ___.', promptAr: 'الشيء الذي تأمل أن تحقّقه، أي الغاية، يسمّى ___.', options: ['obstacle', 'excuse', 'setback', 'goal'], answer: 3, explainAr: 'goal = هدف (الوحدة التاسعة). أما obstacle و setback فهما عقبتان في طريق الهدف.' },
        { n: 30, kind: 'mcq', topic: 'vocab', prompt: 'The amount of water in the air is known as ___.', promptAr: 'كمية الماء الموجودة في الهواء تُعرف بـ ___.', options: ['lightning', 'surface', 'humidity', 'phenomenon'], answer: 2, explainAr: 'humidity = الرطوبة، أي كمية بخار الماء في الهواء (الوحدة الثانية عشرة).' },
      ],
    },
    {
      letter: 'D',
      title: 'Ask about the underline word(s):',
      titleAr: 'اسأل عن الكلمة (الكلمات) التي تحتها خط:',
      marks: 40,
      questions: [
        { n: 31, kind: 'ask', prompt: '{The designer} made this beautiful dress.', promptAr: 'صنع المصمّم هذا الفستان الجميل.', options: ['What did the designer make?', 'Who made this beautiful dress?', 'Who did this beautiful dress make?', 'Whom made this beautiful dress?'], answer: 1, explainAr: 'نسأل عن الفاعل (شخص) فنستخدم Who مباشرة مع الفعل الماضي دون did: Who made this beautiful dress?' },
        { n: 32, kind: 'ask', prompt: 'Fashion shows are held {in big cities}.', promptAr: 'تُقام عروض الأزياء في المدن الكبيرة.', options: ['Where are fashion shows held?', 'When are fashion shows held?', 'Where do fashion shows held?', 'Where fashion shows are held?'], answer: 0, explainAr: 'نسأل عن المكان فنستخدم Where، والجملة مبنية للمجهول فنقدّم are على الفاعل: Where are fashion shows held?' },
        { n: 33, kind: 'ask', prompt: 'Rama wants to be a painter {because she loves colours}.', promptAr: 'تريد راما أن تكون رسّامة لأنها تحب الألوان.', options: ['What does Rama want to be?', 'Why does Rama wants to be a painter?', 'Why Rama wants to be a painter?', 'Why does Rama want to be a painter?'], answer: 3, explainAr: 'نسأل عن السبب فنستخدم Why، والفعل wants مضارع مع she فنستخدم does + الفعل المجرد: Why does Rama want to be a painter?' },
        { n: 34, kind: 'ask', prompt: "{No, they didn't see a UFO.}", promptAr: 'لا، لم يروا جسماً طائراً مجهولاً.', options: ['Do they see a UFO?', 'What did they see?', 'Did they see a UFO?', "Didn't they saw a UFO?"], answer: 2, explainAr: 'الجواب يبدأ بـ No فهو جواب سؤال نعم/لا، والفعل ماضٍ (didn\'t see) فنسأل بـ Did + الفعل المجرد: Did they see a UFO?' },
      ],
    },
    {
      letter: 'E',
      title: 'Choose the wrong part in each phrase:',
      titleAr: 'اختر الجزء الخاطئ في كل جملة:',
      marks: 20,
      questions: [
        { n: 35, kind: 'wrongpart', prompt: 'Nowadays, {fashion} {is} {the} {bigger} part of our life.', promptAr: 'في هذه الأيام، الموضة هي الجزء الأكبر من حياتنا.', answer: 3, explainAr: 'مع the نقارن بالكل فنستخدم صيغة التفضيل: bigger ← biggest (the biggest part).' },
        { n: 36, kind: 'wrongpart', prompt: 'My father {has} got {a} new job, {isn\'t} {he}?', promptAr: 'حصل أبي على عمل جديد، أليس كذلك؟', answer: 2, explainAr: 'الفعل المساعد في الجملة has، فالذيل يكرّره منفياً: isn\'t ← hasn\'t he?' },
        { n: 37, kind: 'wrongpart', prompt: 'The new dresses {was} {made} {by} {a} famous designer.', promptAr: 'صُنعت الفساتين الجديدة على يد مصمّم مشهور.', answer: 0, explainAr: 'الفاعل جمع (dresses)، فالمبني للمجهول في الماضي يكون were + التصريف الثالث: was ← were made.' },
        { n: 38, kind: 'wrongpart', prompt: 'I {wish} I {have} {more} {free} time.', promptAr: 'أتمنى لو كان لديّ وقت فراغ أكثر.', answer: 1, explainAr: 'بعد wish نستخدم الماضي البسيط للتعبير عن أمنية في الحاضر: have ← had.' },
      ],
    },
    {
      letter: 'F',
      title: 'Write a 50-word paragraph about the following topic:',
      titleAr: 'اكتب فقرة من 50 كلمة عن الموضوع التالي:',
      marks: 40,
      writing: {
        topic: 'Describe your best friend',
        topicAr: 'صِف صديقك (صديقتك) المقرّب',
        words: 50,
        model: 'My best friend is Lamar. She is fourteen years old. She is tall and slim, and she has long straight black hair and bright brown eyes. She is a little taller than me. Lamar is generous and helpful, and she has a great sense of humor. She is the funniest girl in our class, but she is also very smart. I love her because she always helps me when I have a problem.',
        modelAr: 'صديقتي المقرّبة هي لمار. عمرها أربعة عشر عاماً. هي طويلة ونحيفة، ولها شعر أسود طويل أملس وعينان بنيّتان لامعتان. وهي أطول مني قليلاً. لمار كريمة ومتعاونة ولديها حسّ فكاهة رائع. إنها أظرف فتاة في صفّنا، لكنها أيضاً ذكية جداً. أحبها لأنها تساعدني دائماً عندما تواجهني مشكلة.',
        checklistAr: [
          'كتبت عن الموضوع المطلوب نفسه (وصف صديقي المقرّب).',
          'وصفت المظهر (الطول، الشعر، العينان) والشخصية بمفردات الوحدة السابعة.',
          'استخدمت صيغتي المقارنة والتفضيل بشكل صحيح (taller than / the funniest).',
          'راعيت الإملاء وعلامات الترقيم والحروف الكبيرة ووصلت الجمل بـ and, but, because.',
        ],
      },
    },
  ],
}
