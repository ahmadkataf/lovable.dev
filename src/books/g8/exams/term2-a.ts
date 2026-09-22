import type { Exam } from '../../../engine/types'

// Term 2 practice paper A, written on the pattern of the real final exam (Grade 8, 60 minutes, 400 marks).
export const term2A: Exam = {
  id: 't2-a',
  term: 2,
  title: 'Term 2 — Test (A)',
  titleAr: 'الفصل الثاني — النموذج (A)',
  minutes: 60,
  totalMarks: 400,
  sourceAr: 'نموذج تدريبي للفصل الثاني على نمط الامتحان النهائي، يغطي الوحدات 7–12 (نصّا القراءة من الوحدتين 7 و9).',
  sections: [
    {
      letter: 'A',
      title: 'Read the following text then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ النص التالي ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 50,
      passage: {
        paragraphs: [
          "I have two cousins, Rama and Reem. They are twins, and they are eleven years old. They look like each other so much that most people can't tell {them} apart. Both girls have got fair straight hair with a fringe, bright brown eyes and round faces. But if you look carefully, you will notice some small differences. Rama is a little taller than Reem, and her hair is longer. Their appearance is almost the same, but their personalities are very different. Rama is shy and quiet. She doesn't talk much with people she doesn't know. Reem is more talkative than her sister, and her teachers say she is a real chatterbox. She has a great sense of humor and she always tells funny jokes. When she is with her friends, they laugh at the top of their voices. Rama is more elegant than Reem. She usually wears long skirts and nice cardigans, but Reem prefers jeans and T-shirts. However, both girls are generous and helpful. Rama helps her mother in the kitchen, and Reem helps her little brother with his homework. My aunt says they are the best daughters in the world, and I think she is right.",
        ],
        paragraphsAr: [
          'لديّ ابنتا عمّ هما راما وريم. إنهما توأم وعمرهما إحدى عشرة سنة. تشبه إحداهما الأخرى كثيراً لدرجة أن معظم الناس لا يستطيعون التمييز بينهما. لكلتا الفتاتين شعر أشقر أملس مع غُرّة، وعينان بنّيتان لامعتان، ووجه مستدير. لكن إن نظرت بتمعّن فستلاحظ بعض الفروق الصغيرة. راما أطول قليلاً من ريم، وشعرها أطول. مظهرهما متشابه تقريباً، لكن شخصيتيهما مختلفتان جداً. راما خجولة وهادئة، ولا تتكلّم كثيراً مع من لا تعرفهم. أما ريم فهي أكثر كلاماً من أختها، ويقول معلّموها إنها ثرثارة حقاً. لديها حسّ فكاهة رائع وتروي دائماً نكاتاً مضحكة. وعندما تكون مع صديقاتها يضحكن بأعلى أصواتهن. راما أكثر أناقة من ريم؛ فهي ترتدي عادةً تنانير طويلة وكنزات جميلة، بينما تفضّل ريم الجينز والقمصان القطنية. ومع ذلك فكلتا الفتاتين كريمة وتحبّ المساعدة: راما تساعد أمها في المطبخ، وريم تساعد أخاها الصغير في واجباته. تقول عمّتي إنهما أفضل ابنتين في العالم، وأظنّ أنها على حق.',
        ],
      },
      questions: [
        { n: 1, kind: 'mcq', prompt: "Reem's teachers say she is ___.", promptAr: 'يقول معلّمو ريم إنها ___.', options: ['shy and quiet', 'more elegant than her sister', 'taller than Rama', 'a real chatterbox'], answer: 3, explainAr: 'النص: "her teachers say she is a real chatterbox" — أي ثرثارة حقاً. أما الخجل والهدوء والأناقة والطول فهي صفات راما.' },
        { n: 2, kind: 'mcq', prompt: 'Reem is ___ Rama.', promptAr: 'ريم ___ راما.', options: ['taller than', 'more elegant than', 'shorter than', 'as tall as'], answer: 2, explainAr: 'النص يقول "Rama is a little taller than Reem" (راما أطول من ريم)، وهذا يعني بصياغة أخرى أن ريم أقصر من راما: shorter than.' },
        { n: 3, kind: 'mcq', prompt: 'What does "them" in the text refer to?', promptAr: 'إلامَ تعود كلمة "them" في النص؟', options: ['brown eyes', 'Rama and Reem', 'most people', 'round faces'], answer: 1, explainAr: 'الجملة: "They look like each other so much that most people can\'t tell them apart" — الناس لا يميّزون بين التوأمين، فكلمة them تعود على راما وريم.' },
        { n: 4, kind: 'mcq', prompt: '"Shy" is the opposite of:', promptAr: 'كلمة "Shy" (خجول) عكسها:', options: ['talkative', 'fair', 'generous', 'quiet'], answer: 0, explainAr: 'shy = خجول قليل الكلام مع الناس، وعكسها talkative (كثير الكلام) — والنص نفسه يقابل بين راما الخجولة وريم الأكثر كلاماً. أما quiet فمعناها قريب من shy.' },
        { n: 5, kind: 'mcq', prompt: '"Generous" means ___.', promptAr: 'كلمة "Generous" تعني ___.', options: ['nervous and quiet with other people', 'light in colour', 'willing to give and share', 'attractive and pleasant to look at'], answer: 2, explainAr: 'generous = كريم، أي مستعد للعطاء والمشاركة (willing to give and share). الخيار «attractive and pleasant to look at» معنى good-looking، و «nervous and quiet with other people» معنى shy، و «light in colour» معنى fair.' },
      ],
    },
    {
      letter: 'B',
      title: 'Read the following text then write if the sentences are True or False:',
      titleAr: 'اقرأ النص التالي ثم اكتب إن كانت الجمل صحيحة أم خاطئة:',
      marks: 50,
      passage: {
        paragraphs: [
          "Karam is a young swimmer from Latakia. When he was fourteen, he had a bad road accident and hurt his knee. The doctors said that he couldn't swim for a long time. Karam was very sad because swimming was his dream. \"I wish I could swim again,\" he said. But Karam didn't give up. First, he defined his goal: he wanted to swim in the national championship. Then he made a plan. He split his big goal into small steps, and he scheduled his training every day. Every week, he reviewed his plan to see how he was doing. The road to his dream wasn't easy. There were many obstacles to overcome. Some days his knee hurt, and training was mind-numbing. Sometimes he felt like quitting, but his coach always told him, \"Anything worth having doesn't come easy.\" Two years later, Karam qualified for the final. He didn't win the gold medal, but he came third, and he was thrilled. \"This achievement is only the first step,\" he said. \"My next goal is to swim faster than I did before the accident.\" Today, Karam visits schools and talks to students about his story. He tells them, \"Dreams are important, but plans and hard work are more important.\"",
        ],
        paragraphsAr: [
          'كرم سبّاح شاب من اللاذقية. عندما كان في الرابعة عشرة تعرّض لحادث سير سيّئ وأُصيبت ركبته. قال الأطباء إنه لن يستطيع السباحة مدة طويلة. حزن كرم كثيراً لأن السباحة كانت حلمه، وقال: "أتمنى لو أستطيع السباحة من جديد". لكن كرم لم يستسلم. في البداية حدّد هدفه: أراد أن يسبح في البطولة الوطنية. ثم وضع خطة، فقسّم هدفه الكبير إلى خطوات صغيرة، وحدّد مواعيد تدريبه كل يوم. وكان يراجع خطته كل أسبوع ليرى كيف يتقدّم. لم يكن الطريق إلى حلمه سهلاً؛ فقد كانت هناك عقبات كثيرة عليه أن يتغلّب عليها. في بعض الأيام كانت ركبته تؤلمه، وكان التدريب مملّاً جداً. وأحياناً شعر برغبة في الاستسلام، لكن مدرّبه كان يقول له دائماً: "كل شيء يستحق الحصول عليه لا يأتي بسهولة". بعد سنتين تأهّل كرم إلى النهائي. لم يفز بالميدالية الذهبية لكنه جاء ثالثاً، وكان سعيداً جداً. قال: "هذا الإنجاز هو الخطوة الأولى فقط. هدفي التالي أن أسبح أسرع مما كنت أسبح قبل الحادث". واليوم يزور كرم المدارس ويحدّث الطلاب عن قصته، ويقول لهم: "الأحلام مهمة، لكن الخطط والعمل الجاد أهم".',
        ],
      },
      questions: [
        { n: 6, kind: 'truefalse', prompt: 'Karam hurt his knee in a road accident.', promptAr: 'أُصيبت ركبة كرم في حادث سير.', answer: true, explainAr: 'النص: "he had a bad road accident and hurt his knee".' },
        { n: 7, kind: 'truefalse', prompt: 'Karam gave up swimming after the accident.', promptAr: 'ترك كرم السباحة بعد الحادث.', answer: false, explainAr: 'النص: "But Karam didn\'t give up" — لم يستسلم، بل وضع خطة وتدرّب.' },
        { n: 8, kind: 'truefalse', prompt: 'Karam made a plan to achieve his goal.', promptAr: 'وضع كرم خطة ليحقّق هدفه.', answer: true, explainAr: 'النص: "Then he made a plan. He split his big goal into small steps".' },
        { n: 9, kind: 'truefalse', prompt: 'Karam won the gold medal in the final.', promptAr: 'فاز كرم بالميدالية الذهبية في النهائي.', answer: false, explainAr: 'النص: "He didn\'t win the gold medal, but he came third" — جاء ثالثاً.' },
        { n: 10, kind: 'truefalse', prompt: 'Karam talks to students about his story.', promptAr: 'يتحدّث كرم إلى الطلاب عن قصته.', answer: true, explainAr: 'النص: "Today, Karam visits schools and talks to students about his story".' },
      ],
    },
    {
      letter: 'C',
      title: 'Read the sentences then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ الجمل ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 200,
      questions: [
        { n: 11, kind: 'mcq', topic: 'grammar', prompt: 'This exam was ___ than the last one.', promptAr: 'كان هذا الامتحان ___ من الامتحان السابق.', options: ['difficulter', 'difficult', 'the most difficult', 'more difficult'], answer: 3, explainAr: 'نقارن بين شيئين (than) والصفة طويلة (difficult) فنستخدم more + الصفة: more difficult. لا نضيف -er للصفات الطويلة، و the most للتفضيل لا للمقارنة.' },
        { n: 12, kind: 'mcq', topic: 'grammar', prompt: 'Lamar is ___ girl in our class.', promptAr: 'لمار هي ___ فتاة في صفّنا.', options: ['funniest', 'the funniest', 'the funnyest', 'funnier'], answer: 1, explainAr: 'نقارن لمار بكل فتيات الصف (in our class) فنستخدم صيغة التفضيل مع the. والصفة المنتهية بـ y تتحوّل y إلى i ثم نضيف -est: the funniest.' },
        { n: 13, kind: 'mcq', topic: 'grammar', prompt: "Bayan hasn't got a bike. She wishes she ___ a bike.", promptAr: 'ليس لدى بيان درّاجة. تتمنى لو أن لديها درّاجة.', options: ['had', 'have', 'will have', 'has'], answer: 0, explainAr: 'نتمنى شيئاً غير حقيقي في الحاضر فنستخدم wish + الماضي البسيط: had.' },
        { n: 14, kind: 'mcq', topic: 'grammar', prompt: 'Layan is from Homs, ___?', promptAr: 'ليان من حمص، أليس كذلك؟', options: ["isn't Layan", "isn't she", "doesn't she", 'is she'], answer: 1, explainAr: 'الجملة مثبتة فيكون السؤال الذيلي منفياً، بالفعل المساعد نفسه (is)، وفاعل السؤال ضمير لا اسم: isn\'t she.' },
        { n: 15, kind: 'mcq', topic: 'grammar', prompt: 'Basel is ___ university student.', promptAr: 'باسل طالب جامعي.', options: ['(no article)', 'the', 'an', 'a'], answer: 3, explainAr: 'university تبدأ بحرف u لكن تُلفظ بصوت ساكن /j/ (يو)، والعبرة بالصوت لا بالحرف، فنستخدم a: a university student.' },
        { n: 16, kind: 'mcq', topic: 'grammar', prompt: 'Arabic ___ in many countries.', promptAr: 'تُتكلَّم اللغة العربية في بلدان كثيرة.', options: ['is spoken', 'speaks', 'spoke', 'is speaking'], answer: 0, explainAr: 'اللغة لا تتكلّم بنفسها بل يتكلّمها الناس، فنستخدم المبني للمجهول في المضارع البسيط: is + التصريف الثالث: is spoken.' },
        { n: 17, kind: 'mcq', topic: 'grammar', prompt: 'Your handwriting is ___ than mine.', promptAr: 'خطّك ___ من خطّي.', options: ['best', 'good', 'better', 'more good'], answer: 2, explainAr: 'good صفة شاذة، ومقارنتها better (ثم the best للتفضيل). ومعنا than فنحتاج صيغة المقارنة: better.' },
        { n: 18, kind: 'mcq', topic: 'grammar', prompt: "I can't speak French. I wish I ___ speak French.", promptAr: 'لا أستطيع التكلّم بالفرنسية. أتمنى لو أستطيع التكلّم بالفرنسية.', options: ['can', 'will', 'could', 'am'], answer: 2, explainAr: 'لنتمنى قدرة لا نملكها الآن نستخدم wish + could: I wish I could speak French.' },
        { n: 19, kind: 'mcq', topic: 'grammar', prompt: "They didn't visit the exhibition, ___?", promptAr: 'لم يزوروا المعرض، أليس كذلك؟', options: ["didn't they", 'did they', 'were they', 'do they'], answer: 1, explainAr: 'الجملة منفية بالفعل المساعد didn\'t (ماضٍ) فيكون السؤال الذيلي مثبتاً بالفعل نفسه: did they.' },
        { n: 20, kind: 'mcq', topic: 'grammar', prompt: 'The old castle ___ hundreds of years ago.', promptAr: 'بُنيت القلعة القديمة منذ مئات السنين.', options: ['built', 'was building', 'is built', 'was built'], answer: 3, explainAr: 'القلعة لم تبنِ نفسها (مبني للمجهول)، والحدث في الماضي (ago)، فنستخدم was + التصريف الثالث: was built.' },
        { n: 21, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has three syllables is:', promptAr: 'الكلمة المؤلفة من ثلاثة مقاطع صوتية هي:', options: ['elegant', 'trend', 'fashion', 'exhibition'], answer: 0, explainAr: 'el-e-gant ثلاثة مقاطع. أما fash-ion فمقطعان، و trend مقطع واحد، و ex-hi-bi-tion أربعة مقاطع.' },
        { n: 22, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has /v/ sound is:', promptAr: 'الكلمة التي فيها الصوت /v/ هي:', options: ['of', 'safe', 'life', 'off'], answer: 0, explainAr: 'حرف f في كلمة of يُلفظ /v/ (/əv/). أما safe و off و life فتُلفظ بالصوت /f/.' },
        { n: 23, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has /ʃ/ sound is:', promptAr: 'الكلمة التي فيها الصوت /ʃ/ (ش) هي:', options: ['chair', 'cheese', 'sugar', 'church'], answer: 2, explainAr: 'حرف s في sugar يُلفظ /ʃ/ (ش) مثل sure. أما ch في chair و cheese و church فيُلفظ /tʃ/ (تش).' },
        { n: 24, kind: 'mcq', topic: 'grammar', prompt: 'This is ___ sofa in our house.', promptAr: 'هذه ___ أريكة في بيتنا.', options: ['more comfortable', 'the most comfortable', 'the comfortablest', 'most comfortable'], answer: 1, explainAr: 'نقارن الأريكة بكل أرائك البيت فنستخدم التفضيل، والصفة طويلة فنقول the most + الصفة: the most comfortable (ولا بد من the).' },
        { n: 25, kind: 'mcq', topic: 'grammar', prompt: '___ sun rises in the east.', promptAr: 'تشرق الشمس من الشرق.', options: ['An', '(no article)', 'A', 'The'], answer: 3, explainAr: 'نستخدم the مع الأشياء الوحيدة من نوعها مثل the sun و the world.' },
        { n: 26, kind: 'mcq', topic: 'wordform', prompt: 'Rama is ___ about drawing; she draws every day.', promptAr: 'راما شغوفة بالرسم؛ فهي ترسم كل يوم.', options: ['passionately', 'passions', 'passion', 'passionate'], answer: 3, explainAr: 'بعد فعل الكون is نحتاج صفة: passionate (شغوف). أما passion فاسم، و passionately ظرف.' },
        { n: 27, kind: 'mcq', topic: 'vocab', prompt: 'The daughter of your brother or sister:', promptAr: 'ابنة أخيك أو أختك:', options: ['niece', 'clerk', 'cardigan', 'bride'], answer: 0, explainAr: 'niece = ابنة الأخ أو ابنة الأخت (كلمة من الوحدة السابعة).' },
        { n: 28, kind: 'mcq', topic: 'vocab', prompt: 'An event that makes it difficult for you to achieve something:', promptAr: 'حدث يجعل من الصعب عليك تحقيق شيء ما:', options: ['trend', 'obstacle', 'passion', 'goal'], answer: 1, explainAr: 'obstacle = عقبة (كلمة من الوحدة التاسعة).' },
        { n: 29, kind: 'mcq', topic: 'vocab', prompt: 'A person who makes things from wood is called ___.', promptAr: 'الشخص الذي يصنع الأشياء من الخشب يُسمّى ___.', options: ['pilot', 'designer', 'carpenter', 'blacksmith'], answer: 2, explainAr: 'carpenter = النجّار. أما blacksmith فهو الحدّاد الذي يصنع الأشياء من الحديد (كلمتان من الوحدة السابعة).' },
        { n: 30, kind: 'mcq', topic: 'vocab', prompt: 'The ability to move objects without touching them is known as ___.', promptAr: 'القدرة على تحريك الأشياء دون لمسها تُعرف بـ ___.', options: ['healing', 'telekinesis', 'observation', 'telepathy'], answer: 1, explainAr: 'telekinesis = التحريك الذهني (كلمة من الوحدة الحادية عشرة). أما telepathy فهي قراءة أفكار الآخرين.' },
      ],
    },
    {
      letter: 'D',
      title: 'Ask about the underline word(s):',
      titleAr: 'اسأل عن الكلمة (الكلمات) التي تحتها خط:',
      marks: 40,
      questions: [
        { n: 31, kind: 'ask', prompt: '{Rama} is taller than Reem.', promptAr: 'راما أطول من ريم.', options: ['What is taller than Reem?', 'Who taller is than Reem?', 'Who is taller than Reem?', 'Who does taller than Reem?'], answer: 2, explainAr: 'نسأل عن شخص في موقع الفاعل فنستخدم Who دون تغيير ترتيب الجملة: Who is taller than Reem?' },
        { n: 32, kind: 'ask', prompt: 'The exhibition was held {last week}.', promptAr: 'أُقيم المعرض الأسبوع الماضي.', options: ['Where was the exhibition held?', 'When the exhibition was held?', 'When did the exhibition held?', 'When was the exhibition held?'], answer: 3, explainAr: 'نسأل عن الزمن (last week) بـ When، والجملة مبنية للمجهول في الماضي فنقدّم was على الفاعل: When was the exhibition held?' },
        { n: 33, kind: 'ask', prompt: 'Karam swims {three times} a week.', promptAr: 'يسبح كرم ثلاث مرات في الأسبوع.', options: ['How many times does Karam swim a week?', 'How many times Karam swims a week?', 'How many times is Karam swim a week?', 'How much times does Karam swim a week?'], answer: 0, explainAr: 'نسأل عن عدد (three times) بـ How many، والفعل مضارع بسيط مع he فنستخدم does + الفعل المجرد: How many times does Karam swim a week?' },
        { n: 34, kind: 'ask', prompt: '{Yes, she wishes she were taller.}', promptAr: 'نعم، هي تتمنى لو كانت أطول.', options: ['What does she wish?', 'Does she wish she were taller?', 'Did she wish she were taller?', 'Is she wish she were taller?'], answer: 1, explainAr: 'الجواب يبدأ بـ Yes فهو جواب سؤال نعم/لا. الفعل wishes مضارع بسيط مع she فنسأل بـ Does + الفعل المجرد: Does she wish she were taller?' },
      ],
    },
    {
      letter: 'E',
      title: 'Choose the wrong part in each phrase:',
      titleAr: 'اختر الجزء الخاطئ في كل جملة:',
      marks: 20,
      questions: [
        { n: 35, kind: 'wrongpart', prompt: 'My brother {is} {more taller} {than} {me}.', promptAr: 'أخي أطول مني.', answer: 1, explainAr: 'tall صفة قصيرة نضيف لها -er فقط، ولا نجمع بين more و -er: more taller ← taller.' },
        { n: 36, kind: 'wrongpart', prompt: 'Your father {works} {in} {a} factory, {doesn\'t she}?', promptAr: 'والدك يعمل في مصنع، أليس كذلك؟', answer: 3, explainAr: 'فاعل السؤال الذيلي ضمير يعود على الفاعل (your father مذكّر): doesn\'t she ← doesn\'t he.' },
        { n: 37, kind: 'wrongpart', prompt: 'The {museum} {was} {build} {in} 1950.', promptAr: 'بُني المتحف عام 1950.', answer: 2, explainAr: 'المبني للمجهول = was/were + التصريف الثالث للفعل: build ← built.' },
        { n: 38, kind: 'wrongpart', prompt: '{A} sun {is} {bigger} {than} the Earth.', promptAr: 'الشمس أكبر من الأرض.', answer: 0, explainAr: 'الشمس شيء وحيد من نوعه فنستخدم the لا a: A sun ← The sun.' },
      ],
    },
    {
      letter: 'F',
      title: 'Write a 50-word paragraph about the following topic:',
      titleAr: 'اكتب فقرة من 50 كلمة عن الموضوع التالي:',
      marks: 40,
      writing: {
        topic: 'Describe a member of your family',
        topicAr: 'صِف أحد أفراد عائلتك',
        words: 50,
        model: 'My brother Basel is sixteen years old. He is tall and good-looking. He has got short straight black hair and bright brown eyes. He is taller than my father and stronger than me. Basel is generous and helpful. He always helps me with my homework. He also has a great sense of humor and tells funny jokes. I think he is the kindest brother in the world.',
        modelAr: 'أخي باسل عمره ست عشرة سنة. هو طويل وحسن المظهر. لديه شعر أسود قصير أملس وعينان بنّيتان لامعتان. هو أطول من أبي وأقوى مني. باسل كريم ويحبّ المساعدة، ويساعدني دائماً في واجباتي. ولديه أيضاً حسّ فكاهة رائع ويروي نكاتاً مضحكة. أظنّ أنه ألطف أخ في العالم.',
        checklistAr: [
          'كتبت عن الموضوع المطلوب نفسه (وصف أحد أفراد العائلة).',
          'وصفت المظهر (الطول، الشعر، العينان) والشخصية بمفردات الوحدة السابعة.',
          'استخدمت صيغة المقارنة (taller than) وصيغة التفضيل (the kindest) بشكل صحيح.',
          'راعيت الإملاء وعلامات الترقيم والحروف الكبيرة.',
        ],
      },
    },
  ],
}
