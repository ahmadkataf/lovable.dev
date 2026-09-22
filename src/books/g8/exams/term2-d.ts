import type { Exam } from '../../../engine/types'

// A Term 2 practice paper in the exact format of the real final exam (Units 7–12).
export const term2D: Exam = {
  id: 't2-d',
  term: 2,
  title: 'Term 2 — Test (D)',
  titleAr: 'الفصل الثاني — النموذج (D)',
  minutes: 60,
  totalMarks: 400,
  sourceAr: 'نموذج تدريبي بشكل الامتحان النهائي يغطي الوحدات 7–12 (النصان من الوحدتين 7 و11، والتعبير من الوحدة 9).',
  sections: [
    {
      letter: 'A',
      title: 'Read the following text then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ النص التالي ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 50,
      passage: {
        paragraphs: [
          "My uncle has two daughters, Rasha and Rana. They are twins and they are fifteen years old. They look like each other so much that most people can't tell them apart. Both girls have fair straight hair, bright green eyes and round faces. However, if you look carefully, you will notice some small differences. Rasha is a little taller than Rana, and her hair is longer. Rana has a fringe, but Rasha doesn't. The twins look alike, but their personalities are very different. Rasha is shy and quiet. She doesn't talk much with people she doesn't know. She likes reading and drawing, and she is more careful than her sister. Rana is a real chatterbox. She talks at the top of her voice and she loves telling jokes. She has a great sense of humor, so her friends never stop laughing when they are with her. Both girls are generous and helpful. They always share their things with their friends and help their mother at home. Rasha is smart and elegant. She usually wears long skirts and cardigans. Rana prefers jeans and T-shirts because she thinks {they} are more comfortable. People say that Rana is funnier than her sister, but Rasha is calmer. I love them both because they are lovely girls.",
        ],
        paragraphsAr: [
          'لعمّي ابنتان، رشا ورنا. إنهما توأمان وعمرهما خمسة عشر عاماً. تشبه إحداهما الأخرى كثيراً لدرجة أن معظم الناس لا يستطيعون التمييز بينهما. لكلتا الفتاتين شعر أشقر أملس وعينان خضراوان لامعتان ووجه مستدير. لكن إذا نظرت بتمعّن فستلاحظ بعض الفروق الصغيرة. رشا أطول قليلاً من رنا، وشعرها أطول. لرنا غُرّة، أما رشا فلا. تتشابه التوأمان في الشكل، لكن شخصيتيهما مختلفتان جداً. رشا خجولة وهادئة، ولا تتكلم كثيراً مع من لا تعرفهم. تحب القراءة والرسم، وهي أكثر حذراً من أختها. أما رنا فثرثارة حقاً، تتكلم بأعلى صوتها وتحب إلقاء النكات. لديها حسّ فكاهة رائع، لذلك لا يتوقف أصدقاؤها عن الضحك عندما يكونون معها. كلتا الفتاتين كريمة ومتعاونة، فهما تشاركان أصدقاءهما أشياءهما دائماً وتساعدان أمهما في البيت. رشا ذكية وأنيقة، وترتدي عادةً تنانير طويلة وكنزات صوفية. أما رنا فتفضّل الجينز والقمصان القطنية لأنها تظن أنها أكثر راحة. يقول الناس إن رنا أظرف من أختها، لكن رشا أهدأ. أحبهما كلتيهما لأنهما فتاتان لطيفتان.',
        ],
      },
      questions: [
        { n: 1, kind: 'mcq', prompt: "Rasha and Rana are the writer's ___.", promptAr: 'رشا ورنا هما ___ الكاتب.', options: ['aunts', 'sisters', 'nieces', 'cousins'], answer: 3, explainAr: 'النص يبدأ بـ "My uncle has two daughters, Rasha and Rana" — بنتا العمّ هما ابنتا عمّ الكاتب، أي cousins.' },
        { n: 2, kind: 'mcq', prompt: 'Rana ___.', promptAr: 'رنا ___.', options: ['always wears long skirts and cardigans', 'is taller than Rasha', 'talks a lot and likes telling jokes', 'is quieter than her sister'], answer: 2, explainAr: 'النص: "Rana is a real chatterbox ... she loves telling jokes" أي أنها كثيرة الكلام وتحب النكات. أما الهدوء والتنانير والطول فهي صفات رشا.' },
        { n: 3, kind: 'mcq', prompt: 'What does "they" in the text refer to?', promptAr: 'إلامَ تعود كلمة "they" في النص؟', options: ['jeans and T-shirts', 'her friends', 'the twins', 'skirts and cardigans'], answer: 0, explainAr: 'الجملة: "Rana prefers jeans and T-shirts because she thinks they are more comfortable" — فالأشياء المريحة هي الجينز والقمصان القطنية.' },
        { n: 4, kind: 'mcq', prompt: '"Shy" is the opposite of:', promptAr: 'كلمة "Shy" (خجول) عكسها:', options: ['generous', 'confident', 'quiet', 'elegant'], answer: 1, explainAr: 'shy = خجول ومتوتر مع الآخرين، وعكسها confident = واثق من نفسه. أما quiet (هادئ) فقريبة من معناها وليست عكسها.' },
        { n: 5, kind: 'mcq', prompt: '"Generous" means ___.', promptAr: 'كلمة "Generous" تعني ___.', options: ['nervous and quiet', 'graceful and stylish', 'willing to give and share', 'very talkative'], answer: 2, explainAr: 'generous = كريم، أي مستعد للعطاء والمشاركة (willing to give and share)، والنص يؤكد ذلك: "They always share their things".' },
      ],
    },
    {
      letter: 'B',
      title: 'Read the following text then write if the sentences are True or False:',
      titleAr: 'اقرأ النص التالي ثم اكتب إن كانت الجمل صحيحة أم خاطئة:',
      marks: 50,
      passage: {
        paragraphs: [
          "Last summer, a famous illusionist performed a strange trick in front of a big audience in a city near the sea. He walked on the water of a river from one side to the other! People couldn't believe their eyes. Some of them thought that the man had a supernatural power. Others took photos and videos with their mobile phones. After the show, the man didn't swim back. He got into a police boat, and the boat took him back to the other side. Later, the videos were watched by millions of people on the internet. Scientists and reporters tried to find a logical explanation for this phenomenon. Some people said that there were invisible cables which held the man and stopped him from sinking. Others said that he was wearing special shoes. The most logical explanation was that there was a platform under the water. The platform was made of glass, so the audience couldn't see it. In fact, an illusionist doesn't have special powers. He is an entertainer who performs tricks that seem impossible. He practises his tricks for a long time before he shows them to people. So the next time you see a strange trick, don't believe it immediately. Think about it logically!",
        ],
        paragraphsAr: [
          'في الصيف الماضي قدّم ساحر أوهام مشهور خدعة غريبة أمام جمهور كبير في مدينة قرب البحر. لقد مشى على ماء نهر من ضفة إلى الضفة الأخرى! لم يصدّق الناس أعينهم. ظنّ بعضهم أن الرجل يملك قوة خارقة، والتقط آخرون الصور ومقاطع الفيديو بهواتفهم المحمولة. بعد العرض لم يعد الرجل سباحةً، بل ركب قارباً للشرطة أعاده إلى الضفة الأخرى. وفي وقت لاحق شاهد ملايين الناس مقاطع الفيديو على الإنترنت. حاول العلماء والصحفيون أن يجدوا تفسيراً منطقياً لهذه الظاهرة. قال بعض الناس إنه كانت هناك أسلاك غير مرئية تحمل الرجل وتمنعه من الغرق، وقال آخرون إنه كان يرتدي حذاءً خاصاً. وكان التفسير الأكثر منطقية أنه كانت هناك منصّة تحت الماء، وكانت المنصّة مصنوعة من الزجاج لذلك لم يستطع الجمهور رؤيتها. في الحقيقة، ساحر الأوهام لا يملك قوى خاصة، بل هو فنّان يقدّم خدعاً تبدو مستحيلة، ويتدرّب على خدعه وقتاً طويلاً قبل أن يعرضها على الناس. لذلك في المرة القادمة التي ترى فيها خدعة غريبة لا تصدّقها فوراً، بل فكّر فيها بشكل منطقي!',
        ],
      },
      questions: [
        { n: 6, kind: 'truefalse', prompt: 'The illusionist walked on the water of a river.', promptAr: 'مشى ساحر الأوهام على ماء نهر.', answer: true, explainAr: 'النص: "He walked on the water of a river from one side to the other!"' },
        { n: 7, kind: 'truefalse', prompt: 'All the people in the audience believed that the man had a supernatural power.', promptAr: 'صدّق كل الناس في الجمهور أن الرجل يملك قوة خارقة.', answer: false, explainAr: 'النص يقول "Some of them thought ..." — بعضهم فقط ظنّ ذلك، لا كلهم.' },
        { n: 8, kind: 'truefalse', prompt: 'The man swam back to the other side after the show.', promptAr: 'عاد الرجل سباحةً إلى الضفة الأخرى بعد العرض.', answer: false, explainAr: 'النص: "the man didn\'t swim back. He got into a police boat" — ركب قارب الشرطة ولم يسبح.' },
        { n: 9, kind: 'truefalse', prompt: "The audience couldn't see the platform because it was made of glass.", promptAr: 'لم يستطع الجمهور رؤية المنصّة لأنها كانت مصنوعة من الزجاج.', answer: true, explainAr: 'النص: "The platform was made of glass, so the audience couldn\'t see it."' },
        { n: 10, kind: 'truefalse', prompt: 'An illusionist practises his tricks for a long time.', promptAr: 'يتدرّب ساحر الأوهام على خدعه وقتاً طويلاً.', answer: true, explainAr: 'النص: "He practises his tricks for a long time before he shows them to people."' },
      ],
    },
    {
      letter: 'C',
      title: 'Read the sentences then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ الجمل ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 200,
      questions: [
        { n: 11, kind: 'mcq', topic: 'grammar', prompt: 'Basel is ___ than his brother Mouayyad.', promptAr: 'باسل ___ من أخيه مؤيّد.', options: ['the tallest', 'taller', 'more tall', 'tall'], answer: 1, explainAr: 'نقارن بين شخصين ومعنا than، فنستخدم صيغة المقارنة. tall صفة قصيرة (مقطع واحد) فنضيف -er: taller.' },
        { n: 12, kind: 'mcq', topic: 'grammar', prompt: 'This bag is ___ than that one.', promptAr: 'هذه الحقيبة ___ من تلك.', options: ['heavier', 'more heavier', 'the heaviest', 'heavyer'], answer: 0, explainAr: 'الصفة heavy تنتهي بـ y، فنقلب y إلى i ونضيف -er: heavier. ولا نجمع more مع -er.' },
        { n: 13, kind: 'mcq', topic: 'grammar', prompt: 'Lamar is ___ girl in our class.', promptAr: 'لمار ___ فتاة في صفّنا.', options: ['more elegant', 'most elegant', 'the elegantest', 'the most elegant'], answer: 3, explainAr: 'نقارن لمار بكل فتيات الصف (in our class) فنستخدم صيغة التفضيل. elegant صفة طويلة فنقول: the most elegant، ولا ننسى the.' },
        { n: 14, kind: 'mcq', topic: 'grammar', prompt: 'Yesterday was ___ day of my life. I lost my bag and missed the bus.', promptAr: 'كان البارحة ___ يوم في حياتي. أضعت حقيبتي وفاتتني الحافلة.', options: ['the worst', 'the baddest', 'worse', 'the worse'], answer: 0, explainAr: 'صيغة التفضيل (of my life) من الصفة الشاذة bad هي the worst. أما worse فهي صيغة المقارنة.' },
        { n: 15, kind: 'mcq', topic: 'grammar', prompt: "I don't have a new cardigan. I wish I ___ one.", promptAr: 'ليس لديّ كنزة صوفية جديدة. أتمنى لو ___ واحدة.', options: ['am having', 'had', 'have', 'will have'], answer: 1, explainAr: 'نتمنى عكس الواقع في الحاضر، فنستخدم wish + الماضي البسيط: I wish I had.' },
        { n: 16, kind: 'mcq', topic: 'grammar', prompt: 'Layan is short. She wishes she ___ taller.', promptAr: 'ليان قصيرة. تتمنى لو ___ أطول.', options: ['will be', 'be', 'were', 'is'], answer: 2, explainAr: 'بعد wish نستخدم الماضي، ومع فعل الكون نستخدم were لكل الأشخاص: She wishes she were taller.' },
        { n: 17, kind: 'mcq', topic: 'grammar', prompt: 'Bayan is a real chatterbox, ___?', promptAr: 'بيان ثرثارة حقاً، ___؟', options: ['is she', "wasn't she", "doesn't she", "isn't she"], answer: 3, explainAr: 'الجملة مثبتة فالذيل منفي، ونكرر الفعل المساعد نفسه (is) مع ضمير الفاعل (she): isn\'t she?' },
        { n: 18, kind: 'mcq', topic: 'grammar', prompt: 'Your cousins live in Hama, ___?', promptAr: 'أولاد عمّك يعيشون في حماة، ___؟', options: ['do they', "don't they", "didn't they", "aren't they"], answer: 1, explainAr: 'لا يوجد فعل مساعد والفعل live مضارع بسيط، فنستخدم do، والجملة مثبتة فالذيل منفي: don\'t they?' },
        { n: 19, kind: 'mcq', topic: 'grammar', prompt: 'My uncle is ___ engineer.', promptAr: 'عمّي ___ مهندس.', options: ['a', 'the', 'an', 'no article'], answer: 2, explainAr: 'engineer تبدأ بصوت حرف علة (e)، فنستخدم an مع الاسم المفرد المعدود: an engineer.' },
        { n: 20, kind: 'mcq', topic: 'grammar', prompt: 'Arabic ___ in many countries.', promptAr: 'العربية ___ في دول كثيرة.', options: ['speaks', 'is speaking', 'spoke', 'is spoken'], answer: 3, explainAr: 'اللغة لا تتكلم بنفسها، فنستخدم المبني للمجهول في المضارع البسيط: is + التصريف الثالث: is spoken.' },
        { n: 21, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has four syllables is:', promptAr: 'الكلمة التي تتكون من أربعة مقاطع صوتية هي:', options: ['exhibition', 'beautiful', 'generous', 'notebook'], answer: 0, explainAr: 'ex-hi-bi-tion = 4 مقاطع. أما beau-ti-ful و ge-ne-rous فثلاثة مقاطع، و note-book مقطعان.' },
        { n: 22, kind: 'mcq', topic: 'pronunciation', prompt: "The word that doesn't have /v/ sound is:", promptAr: 'الكلمة التي لا تحتوي على الصوت /v/ هي:', options: ['safe', 'of', 'five', 'save'], answer: 0, explainAr: 'safe تُلفظ بالصوت /f/. أما five و save ففيهما /v/، وكذلك of التي تُكتب بـ f لكنها تُلفظ /v/.' },
        { n: 23, kind: 'mcq', topic: 'pronunciation', prompt: 'The word "sugar" has ___ sound.', promptAr: 'كلمة "sugar" فيها الصوت ___.', options: ['/tʃ/', '/ʃ/', '/s/', 'both a and c'], answer: 1, explainAr: 'في sugar يُلفظ حرف s وحده /ʃ/ (ش)، مثل sure و pressure.' },
        { n: 24, kind: 'mcq', topic: 'grammar', prompt: 'We can see ___ moon at night.', promptAr: 'نستطيع أن نرى ___ قمر ليلاً.', options: ['no article', 'an', 'a', 'the'], answer: 3, explainAr: 'القمر شيء واحد لا يوجد غيره (مثل the sun و the world)، فنستخدم the: the moon.' },
        { n: 25, kind: 'mcq', topic: 'grammar', prompt: 'This old house ___ by my grandfather in 1950.', promptAr: 'هذا البيت القديم ___ على يد جدّي عام 1950.', options: ['is built', 'was building', 'was built', 'built'], answer: 2, explainAr: 'البيت لا يبني نفسه (by my grandfather) والحدث في الماضي (in 1950)، فنستخدم المبني للمجهول الماضي: was + التصريف الثالث: was built.' },
        { n: 26, kind: 'mcq', topic: 'wordform', prompt: 'Mouayyad was ___ when he heard the good news.', promptAr: 'كان مؤيّد ___ عندما سمع الخبر السار.', options: ['thrill', 'thrills', 'thrilled', 'thrilling'], answer: 2, explainAr: 'نصف شعور مؤيّد (هو المسرور جداً)، فنستخدم الصفة المنتهية بـ -ed: thrilled. أما thrilling فتصف الشيء المثير.' },
        { n: 27, kind: 'mcq', topic: 'vocab', prompt: 'The daughter of your brother or sister:', promptAr: 'ابنة أخيك أو أختك:', options: ['bride', 'clerk', 'housewife', 'niece'], answer: 3, explainAr: 'niece = ابنة الأخ أو ابنة الأخت (كلمة من الوحدة السابعة).' },
        { n: 28, kind: 'mcq', topic: 'vocab', prompt: 'A person who makes things from wood:', promptAr: 'شخص يصنع الأشياء من الخشب:', options: ['designer', 'carpenter', 'pilot', 'blacksmith'], answer: 1, explainAr: 'carpenter = النجّار. أما blacksmith فهو الحدّاد الذي يصنع الأشياء من الحديد (الوحدة السابعة).' },
        { n: 29, kind: 'mcq', topic: 'vocab', prompt: 'A problem that delays progress is called ___.', promptAr: 'المشكلة التي تؤخّر التقدّم تسمّى ___.', options: ['setback', 'fulfillment', 'purpose', 'passion'], answer: 0, explainAr: 'setback = عقبة أو انتكاسة تؤخّر التقدّم (كلمة من الوحدة العاشرة).' },
        { n: 30, kind: 'mcq', topic: 'vocab', prompt: 'The ability to read the minds of other people is known as ___.', promptAr: 'القدرة على قراءة أفكار الآخرين تُعرف بـ ___.', options: ['healing', 'imagination', 'telepathy', 'telekinesis'], answer: 2, explainAr: 'telepathy = التخاطر، أي قراءة أفكار الآخرين. أما telekinesis فهي تحريك الأشياء دون لمسها (الوحدة الحادية عشرة).' },
      ],
    },
    {
      letter: 'D',
      title: 'Ask about the underline word(s):',
      titleAr: 'اسأل عن الكلمة (الكلمات) التي تحتها خط:',
      marks: 40,
      questions: [
        { n: 31, kind: 'ask', prompt: '{Doris} is taller than her sister.', promptAr: 'دوريس أطول من أختها.', options: ['Who is taller than her sister?', 'Who taller is than her sister?', 'Whose is taller than her sister?', 'What is taller than her sister?'], answer: 0, explainAr: 'نسأل عن شخص (Doris) هو الفاعل، فنستخدم Who مع ترتيب الجملة نفسه: Who is taller than her sister?' },
        { n: 32, kind: 'ask', prompt: 'The exhibition was held {last week}.', promptAr: 'أُقيم المعرض الأسبوع الماضي.', options: ['Where was the exhibition held?', 'When the exhibition was held?', 'When did the exhibition held?', 'When was the exhibition held?'], answer: 3, explainAr: 'نسأل عن الزمن (last week) فنستخدم When، والجملة مبنية للمجهول فنقدّم was على الفاعل: When was the exhibition held?' },
        { n: 33, kind: 'ask', prompt: 'My niece is {eight} years old.', promptAr: 'ابنة أختي عمرها ثماني سنوات.', options: ['How many is your niece?', 'How old is your niece?', 'How old your niece is?', 'How old does your niece?'], answer: 1, explainAr: 'نسأل عن العمر فنستخدم How old، ونقدّم is على الفاعل: How old is your niece?' },
        { n: 34, kind: 'ask', prompt: '{Yes, she tells a lot of jokes.}', promptAr: 'نعم، إنها تلقي الكثير من النكات.', options: ['Does she tell a lot of jokes?', 'What does she tell?', 'Did she tells a lot of jokes?', 'Is she tell a lot of jokes?'], answer: 0, explainAr: 'الجواب يبدأ بـ Yes فهو جواب سؤال نعم/لا. الفعل tells مضارع بسيط مع she، فنسأل بـ Does + الفعل المجرد: Does she tell a lot of jokes?' },
      ],
    },
    {
      letter: 'E',
      title: 'Choose the wrong part in each phrase:',
      titleAr: 'اختر الجزء الخاطئ في كل جملة:',
      marks: 20,
      questions: [
        { n: 35, kind: 'wrongpart', prompt: '{My} sister {is} {more tall} than {me}.', promptAr: 'أختي أطول مني.', answer: 2, explainAr: 'tall صفة قصيرة من مقطع واحد، فمقارنتها بإضافة -er لا بـ more: more tall ← taller.' },
        { n: 36, kind: 'wrongpart', prompt: 'I {wish} I {can} fly {like} {a} bird.', promptAr: 'أتمنى لو أستطيع الطيران مثل الطائر.', answer: 1, explainAr: 'بعد wish نستخدم الماضي، فللتعبير عن قدرة لا نملكها نقول could لا can: can ← could.' },
        { n: 37, kind: 'wrongpart', prompt: '{My} uncle {has} bought {a} old {car}.', promptAr: 'اشترى عمّي سيارة قديمة.', answer: 2, explainAr: 'old تبدأ بصوت حرف علة (o)، فنستخدم an لا a: a ← an old car.' },
        { n: 38, kind: 'wrongpart', prompt: 'Arabic {speaks} {in} {many} {countries}.', promptAr: 'تُتكلَّم العربية في دول كثيرة.', answer: 0, explainAr: 'اللغة لا تتكلم بنفسها، فنحتاج المبني للمجهول (is + التصريف الثالث): speaks ← is spoken.' },
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
        model: "My dream is to become a doctor because I want to help sick people. I know that the road to my dream isn't easy. I have to study hard and get good marks, especially in science. I set clear goals, schedule my time and review my plan every week. Sometimes I face obstacles, but I never give up. I wish I were a doctor now! Anything worth having doesn't come easy.",
        modelAr: 'حلمي أن أصبح طبيباً لأنني أريد أن أساعد المرضى. أعرف أن الطريق إلى حلمي ليس سهلاً، فعليّ أن أدرس بجدّ وأحصل على علامات جيدة، خاصة في العلوم. أضع أهدافاً واضحة، وأنظّم وقتي، وأراجع خطتي كل أسبوع. أحياناً تواجهني عقبات، لكنني لا أستسلم أبداً. أتمنى لو كنت طبيباً الآن! فكل شيء يستحق الامتلاك لا يأتي بسهولة.',
        checklistAr: [
          'كتبت عن الموضوع المطلوب نفسه (حلمي وكيف سأحقّقه).',
          'استخدمت مفردات الوحدة: dream, goal, achieve, obstacle, give up, plan.',
          'استخدمت wish بشكل صحيح (I wish I were / had / could ...).',
          'راعيت الإملاء وعلامات الترقيم والحروف الكبيرة ووصلت الجمل بـ because, but, and.',
        ],
      },
    },
  ],
}
