import type { Exam } from '../../../engine/types'

// Term 2 practice paper B, written on the pattern of the real final exam (Grade 8, 60 minutes, 400 marks).
export const term2B: Exam = {
  id: 't2-b',
  term: 2,
  title: 'Term 2 — Test (B)',
  titleAr: 'الفصل الثاني — النموذج (B)',
  minutes: 60,
  totalMarks: 400,
  sourceAr: 'نموذج تدريبي للفصل الثاني على نمط الامتحان النهائي، يغطي الوحدات 7–12 (نصّا القراءة من الوحدتين 8 و11).',
  sections: [
    {
      letter: 'A',
      title: 'Read the following text then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ النص التالي ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 50,
      passage: {
        paragraphs: [
          "Fashion is not only about clothes. It is also about footwear, accessories, makeup and hairstyles. Today, fashion is one of the biggest industries in the world, and it has a strong influence on almost every aspect of our lifestyle. Young people are the most interested in new trends. They want to look up to date, so {they} follow famous designers on the internet. Every year, fashion shows are held in big cities like Paris and Milan, and the newest designs are shown there. Many teenagers believe that fashionable clothes make them feel more confident. However, not everyone agrees. My grandmother says that traditional clothes are the most beautiful clothes of all. She still keeps her mother's old dress in a big wooden box. It is red and black, and it has lovely flowers on it. She says that our traditional clothes are part of our identity, and they tell the story of our country. In my opinion, we can enjoy both fashion and tradition. We can wear jeans and T-shirts at school, and we can wear traditional clothes at weddings and festivals. People who go abroad should not forget their traditions. The clothes we wear are an expression of who we are, and the best fashion is the one that makes you comfortable and happy.",
        ],
        paragraphsAr: [
          'الموضة ليست الملابس فقط، بل تشمل أيضاً الأحذية والإكسسوارات ومستحضرات التجميل وتسريحات الشعر. واليوم تُعدّ الموضة من أكبر الصناعات في العالم، ولها تأثير قوي في كل جانب تقريباً من أسلوب حياتنا. والشباب هم الأكثر اهتماماً بصيحات الموضة الجديدة؛ فهم يريدون أن يبدوا عصريين، لذلك يتابعون المصمّمين المشهورين على الإنترنت. وكل عام تُقام عروض الأزياء في مدن كبيرة مثل باريس وميلانو، وتُعرض فيها أحدث التصاميم. ويعتقد كثير من المراهقين أن الملابس العصرية تجعلهم يشعرون بثقة أكبر. لكن ليس الجميع موافقين على ذلك؛ فجدّتي تقول إن الملابس التقليدية هي أجمل الملابس على الإطلاق. وما زالت تحتفظ بثوب أمها القديم في صندوق خشبي كبير، وهو أحمر وأسود وعليه زهور جميلة. وتقول إن ملابسنا التقليدية جزء من هويتنا، وإنها تروي قصة بلدنا. برأيي، يمكننا أن نستمتع بالموضة والتقاليد معاً؛ فنلبس الجينز والقمصان في المدرسة، ونلبس الملابس التقليدية في الأعراس والمهرجانات. وعلى من يسافرون إلى الخارج ألّا ينسوا تقاليدهم. فالملابس التي نرتديها تعبير عمّن نكون، وأفضل موضة هي التي تجعلك مرتاحاً وسعيداً.',
        ],
      },
      questions: [
        { n: 1, kind: 'mcq', prompt: 'Fashion shows are held in ___.', promptAr: 'تُقام عروض الأزياء في ___.', options: ['small villages', 'big cities like Paris and Milan', "the writer's school", 'a big wooden box'], answer: 1, explainAr: 'النص: "fashion shows are held in big cities like Paris and Milan".' },
        { n: 2, kind: 'mcq', prompt: "The writer's grandmother thinks that ___.", promptAr: 'تعتقد جدّة الكاتب أن ___.', options: ['modern clothes are more beautiful than traditional ones', 'young people should follow famous designers', 'no clothes are more beautiful than traditional clothes', 'jeans are the most comfortable clothes'], answer: 2, explainAr: 'النص: "traditional clothes are the most beautiful clothes of all" — أي لا توجد ملابس أجمل من الملابس التقليدية، وهذا الخيار c بصياغة أخرى.' },
        { n: 3, kind: 'mcq', prompt: 'What does "they" in the text refer to?', promptAr: 'إلامَ تعود كلمة "they" في النص؟', options: ['famous designers', 'new trends', 'young people', 'fashion shows'], answer: 2, explainAr: 'الجملة: "Young people ... want to look up to date, so they follow famous designers" — الشباب هم الذين يتابعون المصمّمين، فكلمة they تعود على young people.' },
        { n: 4, kind: 'mcq', prompt: '"Confident" is the opposite of:', promptAr: 'كلمة "Confident" (واثق من نفسه) عكسها:', options: ['fashionable', 'shy', 'modern', 'happy'], answer: 1, explainAr: 'confident = واثق بنفسه، وعكسها shy (خجول، متوتّر وهادئ أمام الناس).' },
        { n: 5, kind: 'mcq', prompt: '"Influence" means ___.', promptAr: 'كلمة "Influence" تعني ___.', options: ['effect', 'charm', 'size', 'custom'], answer: 0, explainAr: 'influence = تأثير (effect). أما charm فمعنى glamour، و size معنى proportions، و custom معنى tradition.' },
      ],
    },
    {
      letter: 'B',
      title: 'Read the following text then write if the sentences are True or False:',
      titleAr: 'اقرأ النص التالي ثم اكتب إن كانت الجمل صحيحة أم خاطئة:',
      marks: 50,
      passage: {
        paragraphs: [
          "Last summer, my cousin Mulham and I went to a magic show in a big theatre in Aleppo. The theatre was full, and there was a huge audience. An illusionist came onto the stage. He was wearing a black uniform and a tall hat. First, he put a glass of water on a table. He looked at it for a long time, and suddenly the glass started to move without any physical contact. Then he asked a girl from the audience to think of a number, and he told her the number immediately. Next, he made a small red ball invisible, and a minute later it appeared in Mulham's pocket! Everyone clapped. After the show, Mulham said, \"That man has a supernatural power!\" But I didn't agree. I told him that there is always a logical explanation. An illusionist uses clever tricks, and he practices them every day for many years. The next day, I told my science teacher about the show. She said that there was probably a magnet under the table, and its magnetic field moved the glass. Mulham still thinks the man has special powers, but I am sure it was only a trick. Anyway, it was the most exciting show I have ever seen.",
        ],
        paragraphsAr: [
          'في الصيف الماضي ذهبت أنا وابن عمّي ملهم إلى عرض سحري في مسرح كبير في حلب. كان المسرح ممتلئاً وكان هناك جمهور ضخم. صعد إلى المسرح مخادع بصري (ساحر) يرتدي زيّاً أسود وقبعة طويلة. في البداية وضع كأس ماء على طاولة، ونظر إليها مدة طويلة، وفجأة بدأت الكأس تتحرّك دون أي تلامس. ثم طلب من فتاة من الجمهور أن تفكّر في رقم، فأخبرها بالرقم فوراً. بعد ذلك جعل كرة حمراء صغيرة تختفي عن الأنظار، وبعد دقيقة ظهرت في جيب ملهم! فصفّق الجميع. بعد العرض قال ملهم: "ذلك الرجل يملك قوة خارقة!" لكنني لم أوافقه، وقلت له إن هناك دائماً تفسيراً منطقياً؛ فالمخادع البصري يستخدم حيلاً ذكية ويتمرّن عليها كل يوم سنوات طويلة. في اليوم التالي أخبرت معلّمة العلوم عن العرض، فقالت إنه كان على الأرجح مغناطيس تحت الطاولة، وإن مجاله المغناطيسي حرّك الكأس. ما زال ملهم يظنّ أن الرجل يملك قوى خاصة، لكنني متأكّد أنها كانت مجرّد حيلة. على كل حال، كان أكثر عرض مثير رأيته في حياتي.',
        ],
      },
      questions: [
        { n: 6, kind: 'truefalse', prompt: 'The show was in a small theatre with few people.', promptAr: 'كان العرض في مسرح صغير فيه قليل من الناس.', answer: false, explainAr: 'النص: "a big theatre ... The theatre was full, and there was a huge audience" — مسرح كبير وجمهور ضخم.' },
        { n: 7, kind: 'truefalse', prompt: 'The illusionist moved a glass without touching it.', promptAr: 'حرّك المخادع البصري كأساً دون أن يلمسها.', answer: true, explainAr: 'النص: "the glass started to move without any physical contact".' },
        { n: 8, kind: 'truefalse', prompt: 'Mulham believed that the illusionist had a supernatural power.', promptAr: 'اعتقد ملهم أن المخادع البصري يملك قوة خارقة.', answer: true, explainAr: 'قال ملهم: "That man has a supernatural power!"، وما زال يظنّ أن لديه قوى خاصة.' },
        { n: 9, kind: 'truefalse', prompt: 'The writer thinks that there is no explanation for the tricks.', promptAr: 'يعتقد الكاتب أنه لا يوجد تفسير للحيل.', answer: false, explainAr: 'الكاتب قال: "there is always a logical explanation" — هناك دائماً تفسير منطقي.' },
        { n: 10, kind: 'truefalse', prompt: "The writer's science teacher thinks there was a magnet under the table.", promptAr: 'تعتقد معلّمة العلوم أنه كان هناك مغناطيس تحت الطاولة.', answer: true, explainAr: 'النص: "She said that there was probably a magnet under the table".' },
      ],
    },
    {
      letter: 'C',
      title: 'Read the sentences then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ الجمل ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 200,
      questions: [
        { n: 11, kind: 'mcq', topic: 'grammar', prompt: 'Today is ___ than yesterday.', promptAr: 'اليوم ___ من البارحة.', options: ['hot', 'hoter', 'more hot', 'hotter'], answer: 3, explainAr: 'hot صفة قصيرة تنتهي بحرف علة واحد + حرف ساكن واحد، فنضاعف الحرف الأخير ونضيف -er: hotter.' },
        { n: 12, kind: 'mcq', topic: 'grammar', prompt: 'Friday is ___ day of the week for our family.', promptAr: 'يوم الجمعة هو ___ يوم في الأسبوع بالنسبة لعائلتنا.', options: ['the busiest', 'the busyest', 'busier than', 'busiest'], answer: 0, explainAr: 'نقارن الجمعة بكل أيام الأسبوع فنستخدم التفضيل مع the. والصفة تنتهي بـ y فتتحوّل إلى i ونضيف -est: the busiest.' },
        { n: 13, kind: 'mcq', topic: 'grammar', prompt: 'Layan is short. She wishes she ___ taller.', promptAr: 'ليان قصيرة. تتمنى لو كانت أطول.', options: ['is', 'were', 'will be', 'has'], answer: 1, explainAr: 'بعد wish نرجع خطوة إلى الماضي، ومع فعل الكون نستخدم were لكل الضمائر: She wishes she were taller.' },
        { n: 14, kind: 'mcq', topic: 'grammar', prompt: 'Mouayyad can swim well, ___?', promptAr: 'مؤيّد يستطيع السباحة جيداً، أليس كذلك؟', options: ['can he', "doesn't he", "can't he", "isn't he"], answer: 2, explainAr: 'الجملة مثبتة بالفعل الناقص can فيكون السؤال الذيلي منفياً بالفعل نفسه: can\'t he.' },
        { n: 15, kind: 'mcq', topic: 'grammar', prompt: 'Mouayyad waited for ___ hour at the bus stop.', promptAr: 'انتظر مؤيّد ساعة عند موقف الحافلة.', options: ['a', 'an', 'the', '(no article)'], answer: 1, explainAr: 'حرف h في hour صامت، فالكلمة تبدأ بصوت علة، والعبرة بالصوت لا بالحرف: an hour.' },
        { n: 16, kind: 'mcq', topic: 'grammar', prompt: 'The windows of our classroom ___ every morning.', promptAr: 'تُنظَّف نوافذ صفّنا كل صباح.', options: ['clean', 'is cleaned', 'are cleaning', 'are cleaned'], answer: 3, explainAr: 'النوافذ لا تنظّف نفسها فنستخدم المبني للمجهول في المضارع البسيط (every morning). والفاعل جمع (windows) فنقول are + التصريف الثالث: are cleaned.' },
        { n: 17, kind: 'mcq', topic: 'grammar', prompt: 'This cardigan is ___ than that one.', promptAr: 'هذه الكنزة ___ من تلك.', options: ['more expensive', 'expensiver', 'most expensive', 'the more expensive'], answer: 0, explainAr: 'نقارن بين شيئين (than) والصفة طويلة (expensive) فنستخدم more + الصفة: more expensive.' },
        { n: 18, kind: 'mcq', topic: 'grammar', prompt: 'My brother always plays loud music. I wish he ___ stop.', promptAr: 'أخي يشغّل الموسيقى بصوت عالٍ دائماً. أتمنى لو يتوقّف.', options: ['will', 'does', 'would', 'is'], answer: 2, explainAr: 'عندما نتمنى أن يغيّر شخص آخر تصرّفه نستخدم wish + would: I wish he would stop.' },
        { n: 19, kind: 'mcq', topic: 'grammar', prompt: 'Bayan lived in Hama, ___?', promptAr: 'عاشت بيان في حماة، أليس كذلك؟', options: ['did she', "doesn't she", "wasn't she", "didn't she"], answer: 3, explainAr: 'لا يوجد فعل مساعد والفعل lived في الماضي البسيط، فنستخدم did، ولأن الجملة مثبتة يكون السؤال منفياً: didn\'t she.' },
        { n: 20, kind: 'mcq', topic: 'grammar', prompt: "This mystery can't ___ easily.", promptAr: 'لا يمكن تفسير هذا اللغز بسهولة.', options: ['explain', 'be explained', 'explained', 'be explaining'], answer: 1, explainAr: 'اللغز لا يفسّر نفسه فنحتاج المبني للمجهول. مع الأفعال الناقصة: can/can\'t + be + التصريف الثالث: can\'t be explained.' },
        { n: 21, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has four syllables is:', promptAr: 'الكلمة المؤلفة من أربعة مقاطع صوتية هي:', options: ['designer', 'bride', 'confident', 'fashionable'], answer: 3, explainAr: 'fash-ion-a-ble أربعة مقاطع. أما de-sign-er و con-fi-dent فثلاثة مقاطع، و bride مقطع واحد.' },
        { n: 22, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has /f/ sound is:', promptAr: 'الكلمة التي فيها الصوت /f/ هي:', options: ['vet', 'save', 'proof', 'of'], answer: 2, explainAr: 'proof تنتهي بالصوت /f/. أما vet و save ففيهما /v/، وكلمة of تُلفظ أيضاً /v/ مع أنها تُكتب بحرف f.' },
        { n: 23, kind: 'mcq', topic: 'pronunciation', prompt: "The word that doesn't have /ʃ/ sound is:", promptAr: 'الكلمة التي لا تحتوي على الصوت /ʃ/ (ش) هي:', options: ['cheese', 'shy', 'sure', 'pressure'], answer: 0, explainAr: 'ch في cheese تُلفظ /tʃ/ (تش). أما sh في shy، و s في sure و ss في pressure فتُلفظ كلها /ʃ/ (ش).' },
        { n: 24, kind: 'mcq', topic: 'grammar', prompt: 'This is ___ film I have ever seen.', promptAr: 'هذا ___ فيلم رأيته في حياتي.', options: ['the worse', 'the worst', 'the baddest', 'worst'], answer: 1, explainAr: 'bad صفة شاذة: bad → worse → the worst. ونقارن الفيلم بكل الأفلام التي رأيتها فنستخدم التفضيل مع the: the worst.' },
        { n: 25, kind: 'mcq', topic: 'grammar', prompt: 'We usually have ___ breakfast at seven o\'clock.', promptAr: 'نتناول عادةً الفطور في الساعة السابعة.', options: ['a', 'the', 'an', '(no article)'], answer: 3, explainAr: 'لا نستخدم أداة تعريف أو تنكير قبل أسماء الوجبات (breakfast, lunch, dinner): have breakfast.' },
        { n: 26, kind: 'mcq', topic: 'wordform', prompt: 'Passing the exam with full marks was a great ___ for Layan.', promptAr: 'كان النجاح في الامتحان بالعلامة الكاملة إنجازاً عظيماً لليان.', options: ['achieve', 'achieved', 'achievement', 'achieving'], answer: 2, explainAr: 'بعد الصفة great وأداة التنكير a نحتاج اسماً: achievement (إنجاز). أما achieve فهو الفعل.' },
        { n: 27, kind: 'mcq', topic: 'vocab', prompt: 'An excessively talkative person:', promptAr: 'شخص يتكلّم كثيراً جداً:', options: ['carpenter', 'chatterbox', 'pioneer', 'clerk'], answer: 1, explainAr: 'chatterbox = ثرثار، كثير الكلام (كلمة من الوحدة السابعة).' },
        { n: 28, kind: 'mcq', topic: 'vocab', prompt: 'In or to a foreign country:', promptAr: 'في بلد أجنبي أو إليه:', options: ['western', 'external', 'abroad', 'invisible'], answer: 2, explainAr: 'abroad = في الخارج، خارج البلد (كلمة من الوحدتين الثامنة والعاشرة).' },
        { n: 29, kind: 'mcq', topic: 'vocab', prompt: 'The people watching a show are called the ___.', promptAr: 'الناس الذين يشاهدون عرضاً يُسمّون ___.', options: ['audience', 'generation', 'researcher', 'designer'], answer: 0, explainAr: 'audience = الجمهور (كلمة من الوحدة الحادية عشرة).' },
        { n: 30, kind: 'mcq', topic: 'vocab', prompt: 'A creature from outer space:', promptAr: 'مخلوق من الفضاء الخارجي:', options: ['pilot', 'ghost', 'pelican', 'alien'], answer: 3, explainAr: 'alien = كائن فضائي (كلمة من الوحدة الثانية عشرة). أما ghost فهو الشبح، و pelican طائر البجع.' },
      ],
    },
    {
      letter: 'D',
      title: 'Ask about the underline word(s):',
      titleAr: 'اسأل عن الكلمة (الكلمات) التي تحتها خط:',
      marks: 40,
      questions: [
        { n: 31, kind: 'ask', prompt: 'Fashion shows are held {in Paris}.', promptAr: 'تُقام عروض الأزياء في باريس.', options: ['When are fashion shows held?', 'Where do fashion shows held?', 'Where are fashion shows held?', 'Where fashion shows are held?'], answer: 2, explainAr: 'نسأل عن المكان (in Paris) بـ Where، والجملة مبنية للمجهول بـ are فنقدّمها على الفاعل: Where are fashion shows held?' },
        { n: 32, kind: 'ask', prompt: '{The illusionist} made the ball invisible.', promptAr: 'جعل المخادع البصري الكرة تختفي.', options: ['What made the ball invisible?', 'Who made the ball invisible?', 'Who did made the ball invisible?', 'Who the ball made invisible?'], answer: 1, explainAr: 'نسأل عن شخص في موقع الفاعل بـ Who، ويبقى الفعل made كما هو دون did: Who made the ball invisible?' },
        { n: 33, kind: 'ask', prompt: 'Lamar wears a uniform {because she is a nurse}.', promptAr: 'ترتدي لمار زيّاً موحّداً لأنها ممرّضة.', options: ['Why does Lamar wear a uniform?', 'Why Lamar wears a uniform?', 'Why is Lamar wear a uniform?', 'What does Lamar wear?'], answer: 0, explainAr: 'نسأل عن السبب (because ...) بـ Why، والفعل مضارع بسيط مع she فنستخدم does + الفعل المجرد: Why does Lamar wear a uniform?' },
        { n: 34, kind: 'ask', prompt: 'Mouayyad bought {two} cardigans.', promptAr: 'اشترى مؤيّد كنزتين.', options: ['How much cardigans did Mouayyad buy?', 'How many cardigans did Mouayyad bought?', 'How many cardigans Mouayyad bought?', 'How many cardigans did Mouayyad buy?'], answer: 3, explainAr: 'نسأل عن عدد شيء معدود (cardigans) بـ How many، والفعل في الماضي فنستخدم did + الفعل المجرد buy: How many cardigans did Mouayyad buy?' },
      ],
    },
    {
      letter: 'E',
      title: 'Choose the wrong part in each phrase:',
      titleAr: 'اختر الجزء الخاطئ في كل جملة:',
      marks: 20,
      questions: [
        { n: 35, kind: 'wrongpart', prompt: 'Bayan {is} {the} {most tall} girl {in} her class.', promptAr: 'بيان أطول فتاة في صفّها.', answer: 2, explainAr: 'tall صفة قصيرة، وتفضيلها بإضافة -est لا بـ most: most tall ← tallest.' },
        { n: 36, kind: 'wrongpart', prompt: "I {wish} my father {doesn't} {work} {so} late.", promptAr: 'أتمنى لو أن أبي لا يعمل حتى وقت متأخّر.', answer: 1, explainAr: 'بعد wish نرجع خطوة إلى الماضي، فالنفي يكون بـ didn\'t: doesn\'t ← didn\'t.' },
        { n: 37, kind: 'wrongpart', prompt: '{An} university {is} {a} place {for} learning.', promptAr: 'الجامعة مكان للتعلّم.', answer: 0, explainAr: 'university تُلفظ في أولها بصوت ساكن /j/ (يو)، فنستخدم a لا an: An ← A.' },
        { n: 38, kind: 'wrongpart', prompt: "Mulham {has} {got} {a} new bike, {doesn't he}?", promptAr: 'لدى ملهم درّاجة جديدة، أليس كذلك؟', answer: 3, explainAr: 'السؤال الذيلي يستخدم الفعل المساعد نفسه الموجود في الجملة (has got)، فنقول: doesn\'t he ← hasn\'t he.' },
      ],
    },
    {
      letter: 'F',
      title: 'Write a 50-word paragraph about the following topic:',
      titleAr: 'اكتب فقرة من 50 كلمة عن الموضوع التالي:',
      marks: 40,
      writing: {
        topic: 'Your dream and how you will achieve it',
        topicAr: 'حلمك وكيف ستحقّقه',
        words: 50,
        model: "My dream is to become a doctor. I want to help sick people in my town. It isn't easy, because doctors need a lot of study and hard work. First, I will define my goal clearly. Then I will make a plan and split it into small steps. I will review my lessons every day. There will be many obstacles, but I won't give up. I wish I could be a doctor tomorrow!",
        modelAr: 'حلمي أن أصبح طبيباً. أريد أن أساعد المرضى في بلدتي. ليس الأمر سهلاً لأن الأطباء يحتاجون إلى كثير من الدراسة والعمل الجاد. في البداية سأحدّد هدفي بوضوح، ثم سأضع خطة وأقسّمها إلى خطوات صغيرة، وسأراجع دروسي كل يوم. ستكون هناك عقبات كثيرة لكنني لن أستسلم. أتمنى لو أستطيع أن أصبح طبيباً غداً!',
        checklistAr: [
          'كتبت عن الموضوع المطلوب نفسه (حلمي وكيف سأحقّقه).',
          'استخدمت مفردات الوحدتين التاسعة والعاشرة مثل goal, plan, obstacles, give up.',
          'رتّبت الأفكار بكلمات ربط مثل First, Then, because, but، واستخدمت wish بشكل صحيح.',
          'راعيت الإملاء وعلامات الترقيم والحروف الكبيرة.',
        ],
      },
    },
  ],
}
