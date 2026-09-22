import type { Exam } from '../../../engine/types'

// A Term 2 practice paper in the exact format of the real final exam (Units 7–12).
export const term2E: Exam = {
  id: 't2-e',
  term: 2,
  title: 'Term 2 — Test (E)',
  titleAr: 'الفصل الثاني — النموذج (E)',
  minutes: 60,
  totalMarks: 400,
  sourceAr: 'نموذج تدريبي بشكل الامتحان النهائي يغطي الوحدات 7–12 (النصان من الوحدتين 9 و12، والتعبير من الوحدة 8).',
  sections: [
    {
      letter: 'A',
      title: 'Read the following text then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ النص التالي ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 50,
      passage: {
        paragraphs: [
          "Sami was a promising young runner from Homs. When he was fifteen, he won many races at school, and his dream was to run in the final of a big national competition. But one day, he had a road accident on his way home. His knee was badly hurt, and the doctors said that he couldn't run for a long time. Sami felt sad and angry. For weeks, he stayed at home and did nothing. Those were mind-numbing days, and he often thought about quitting. He said, \"I wish I could run again!\" Then his elder brother, {who} was a sports teacher, visited him and said, \"Anything worth having doesn't come easy. Don't give up!\" These words changed Sami's life. He defined his goal clearly and made a plan. He scheduled his training every day, and he split his big goal into small steps. Every month, he reviewed his plan with his brother. The road wasn't easy to navigate. There were many obstacles to overcome, but Sami never stopped trying. After two years, Sami qualified to the final of the national competition. He didn't win first place, but he finished third. He was thrilled. \"This is the greatest achievement of my life,\" he said. \"Dream it, believe it, achieve it!\"",
        ],
        paragraphsAr: [
          'كان سامي عدّاءً شاباً واعداً من حمص. عندما كان في الخامسة عشرة فاز بسباقات كثيرة في المدرسة، وكان حلمه أن يجري في نهائي مسابقة وطنية كبيرة. لكنه تعرّض ذات يوم لحادث سير في طريقه إلى البيت. أُصيبت ركبته إصابة بالغة، وقال الأطباء إنه لن يستطيع الجري لوقت طويل. شعر سامي بالحزن والغضب، وبقي في البيت أسابيع دون أن يفعل شيئاً. كانت تلك أياماً مملّة جداً، وكثيراً ما فكّر في الاستسلام. قال: "أتمنى لو أستطيع الجري من جديد!" ثم زاره أخوه الأكبر، الذي كان مدرّساً للرياضة، وقال له: "كل شيء يستحق الامتلاك لا يأتي بسهولة. لا تستسلم!" غيّرت هذه الكلمات حياة سامي. حدّد هدفه بوضوح ووضع خطة، ونظّم تدريبه كل يوم، وقسّم هدفه الكبير إلى خطوات صغيرة. وكان يراجع خطته مع أخيه كل شهر. لم يكن الطريق سهل العبور، فقد كانت هناك عقبات كثيرة عليه أن يتغلّب عليها، لكن سامي لم يتوقف عن المحاولة أبداً. بعد سنتين تأهّل سامي إلى نهائي المسابقة الوطنية. لم يفز بالمركز الأول، لكنه حلّ ثالثاً، وكان في غاية السعادة. قال: "هذا أعظم إنجاز في حياتي. احلم به، آمن به، حقّقه!"',
        ],
      },
      questions: [
        { n: 1, kind: 'mcq', prompt: "Sami's knee was hurt in ___.", promptAr: 'أُصيبت ركبة سامي في ___.', options: ['a race', 'a sports lesson', 'the final', 'a road accident'], answer: 3, explainAr: 'النص: "he had a road accident on his way home. His knee was badly hurt" — أُصيبت ركبته في حادث سير.' },
        { n: 2, kind: 'mcq', prompt: 'After the accident, Sami ___.', promptAr: 'بعد الحادث، ___ سامي.', options: ['went back to running immediately', 'stayed at home and thought about stopping', 'won the final of the competition', 'became a sports teacher'], answer: 1, explainAr: 'النص: "For weeks, he stayed at home and did nothing ... he often thought about quitting" — والتفكير في quitting يعني التفكير في التوقف.' },
        { n: 3, kind: 'mcq', prompt: 'What does "who" in the text refer to?', promptAr: 'إلامَ تعود كلمة "who" في النص؟', options: ['Sami', 'his elder brother', 'the doctors', 'his friends'], answer: 1, explainAr: 'الجملة: "his elder brother, who was a sports teacher" — فكلمة who تعود على أخيه الأكبر.' },
        { n: 4, kind: 'mcq', prompt: '"Thrilled" is the opposite of:', promptAr: 'كلمة "Thrilled" (مسرور جداً) عكسها:', options: ['happy', 'competitive', 'sad', 'able-bodied'], answer: 2, explainAr: 'thrilled = مسرور جداً (extremely pleased)، وعكسها sad = حزين. أما happy فقريبة من معناها.' },
        { n: 5, kind: 'mcq', prompt: '"Obstacle" means ___.', promptAr: 'كلمة "Obstacle" تعني ___.', options: ['something that makes it difficult to achieve something', 'a detailed idea of how to do something', 'the last race in a competition', 'something done successfully with effort'], answer: 0, explainAr: 'obstacle = عقبة، أي شيء يجعل تحقيق ما تريد صعباً. أما الخيارات الأخرى فهي معاني plan و final و achievement.' },
      ],
    },
    {
      letter: 'B',
      title: 'Read the following text then write if the sentences are True or False:',
      titleAr: 'اقرأ النص التالي ثم اكتب إن كانت الجمل صحيحة أم خاطئة:',
      marks: 50,
      passage: {
        paragraphs: [
          "Last winter, Hala and her family visited her grandmother in an old house in the countryside. On the first night, there was a terrible storm. Hala couldn't sleep, so she went to the kitchen to make a cup of tea. Suddenly, she heard strange sounds outside the window. Then she saw a white shape near the trees. She was very scared and ran back to her room. \"It was a ghost!\" she said. The next morning, Hala told her family about what she had seen. Her cousin Nour laughed and said, \"There are no ghosts, Hala!\" Nour tried to convince her that there was a logical explanation. \"The sounds were made by the wind and the dry leaves,\" she said. \"And the white shape was probably a sheet. It was left on the washing line by Grandma.\" Hala wasn't convinced. So in the afternoon, the two girls went to the garden to look. They found a white sheet on the washing line near the trees. Hala laughed. \"You were right,\" she said. \"It wasn't a ghost after all.\" Many people believe in ghosts, but researchers say that most mysterious things can be explained. Strange sounds, lights and shapes are often caused by the wind, lightning or other natural things.",
        ],
        paragraphsAr: [
          'في الشتاء الماضي زارت هالة وعائلتها جدّتها في بيت قديم في الريف. في الليلة الأولى هبّت عاصفة شديدة، ولم تستطع هالة النوم، فذهبت إلى المطبخ لتعدّ كوباً من الشاي. فجأة سمعت أصواتاً غريبة خارج النافذة، ثم رأت شكلاً أبيض قرب الأشجار. خافت كثيراً وركضت عائدة إلى غرفتها وقالت: "كان شبحاً!" في صباح اليوم التالي أخبرت هالة عائلتها بما رأته. ضحكت ابنة عمّها نور وقالت: "لا توجد أشباح يا هالة!" وحاولت نور أن تقنعها بأن هناك تفسيراً منطقياً، فقالت: "الأصوات صدرت عن الريح والأوراق اليابسة، والشكل الأبيض كان على الأرجح شرشفاً تركته جدّتي على حبل الغسيل." لم تقتنع هالة، لذلك ذهبت الفتاتان بعد الظهر إلى الحديقة لتتحقّقا، فوجدتا شرشفاً أبيض على حبل الغسيل قرب الأشجار. ضحكت هالة وقالت: "كنتِ محقّة. لم يكن شبحاً في النهاية." يؤمن كثير من الناس بالأشباح، لكن الباحثين يقولون إن معظم الأشياء الغامضة يمكن تفسيرها، فالأصوات والأضواء والأشكال الغريبة غالباً ما تسبّبها الريح أو البرق أو أشياء طبيعية أخرى.',
        ],
      },
      questions: [
        { n: 6, kind: 'truefalse', prompt: 'Hala visited her grandmother in summer.', promptAr: 'زارت هالة جدّتها في الصيف.', answer: false, explainAr: 'النص يبدأ بـ "Last winter" — كانت الزيارة في الشتاء لا في الصيف.' },
        { n: 7, kind: 'truefalse', prompt: "Hala went to the kitchen because she couldn't sleep.", promptAr: 'ذهبت هالة إلى المطبخ لأنها لم تستطع النوم.', answer: true, explainAr: 'النص: "Hala couldn\'t sleep, so she went to the kitchen to make a cup of tea."' },
        { n: 8, kind: 'truefalse', prompt: 'Nour believed that Hala had seen a ghost.', promptAr: 'صدّقت نور أن هالة قد رأت شبحاً.', answer: false, explainAr: 'نور ضحكت وقالت "There are no ghosts, Hala!" وحاولت إقناعها بتفسير منطقي.' },
        { n: 9, kind: 'truefalse', prompt: 'The white shape was a sheet on the washing line.', promptAr: 'كان الشكل الأبيض شرشفاً على حبل الغسيل.', answer: true, explainAr: 'النص: "They found a white sheet on the washing line near the trees."' },
        { n: 10, kind: 'truefalse', prompt: 'Researchers say that most mysterious things cannot be explained.', promptAr: 'يقول الباحثون إن معظم الأشياء الغامضة لا يمكن تفسيرها.', answer: false, explainAr: 'النص: "researchers say that most mysterious things can be explained" — يمكن تفسيرها لا العكس.' },
      ],
    },
    {
      letter: 'C',
      title: 'Read the sentences then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ الجمل ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 200,
      questions: [
        { n: 11, kind: 'mcq', topic: 'grammar', prompt: 'Math is ___ than English for me.', promptAr: 'الرياضيات ___ من الإنجليزية بالنسبة لي.', options: ['difficulter', 'the most difficult', 'more difficult', 'more difficulter'], answer: 2, explainAr: 'نقارن بين شيئين ومعنا than، وdifficult صفة طويلة فنستخدم more: more difficult.' },
        { n: 12, kind: 'mcq', topic: 'grammar', prompt: 'My marks this term are ___ than my marks last term.', promptAr: 'علاماتي هذا الفصل ___ من علاماتي في الفصل الماضي.', options: ['better', 'gooder', 'best', 'more good'], answer: 0, explainAr: 'good صفة شاذة، وصيغة المقارنة منها better (مع than).' },
        { n: 13, kind: 'mcq', topic: 'grammar', prompt: 'Summer is ___ season of the year.', promptAr: 'الصيف ___ فصل في السنة.', options: ['the hotest', 'hotter', 'the most hot', 'the hottest'], answer: 3, explainAr: 'نقارن الصيف بكل فصول السنة فنستخدم التفضيل. hot فيها حرف علة واحد + حرف ساكن فنضاعف الأخير: the hottest.' },
        { n: 14, kind: 'mcq', topic: 'grammar', prompt: 'The days before Eid are ___ days at the market.', promptAr: 'الأيام التي تسبق العيد هي ___ الأيام في السوق.', options: ['the busyest', 'the busiest', 'busier', 'the most busy'], answer: 1, explainAr: 'صيغة التفضيل من busy: نقلب y إلى i ونضيف -est مع the: the busiest.' },
        { n: 15, kind: 'mcq', topic: 'grammar', prompt: "I can't swim well. I wish I ___ swim like Natalie.", promptAr: 'لا أستطيع السباحة جيداً. أتمنى لو ___ السباحة مثل ناتالي.', options: ['can', 'will', 'could', 'would'], answer: 2, explainAr: 'نتمنى قدرة لا نملكها الآن، فنستخدم wish + could.' },
        { n: 16, kind: 'mcq', topic: 'grammar', prompt: 'My father smokes a lot. I wish he ___ so much.', promptAr: 'أبي يدخّن كثيراً. أتمنى لو ___ بهذا القدر.', options: ["doesn't smoke", "didn't smoke", "won't smoke", 'not smoke'], answer: 1, explainAr: 'نتمنى عكس واقع حاضر، والنفي بعد wish يكون بالماضي: didn\'t + الفعل المجرد: didn\'t smoke.' },
        { n: 17, kind: 'mcq', topic: 'grammar', prompt: "Mouayyad didn't go to school yesterday, ___?", promptAr: 'لم يذهب مؤيّد إلى المدرسة البارحة، ___؟', options: ["didn't he", 'does he', 'did he', 'was he'], answer: 2, explainAr: 'الجملة منفية (didn\'t) فالذيل مثبت بالفعل المساعد نفسه مع الضمير he: did he?' },
        { n: 18, kind: 'mcq', topic: 'grammar', prompt: 'Lamar can speak French, ___?', promptAr: 'لمار تستطيع التكلّم بالفرنسية، ___؟', options: ["can't she", 'can she', "doesn't she", "isn't she"], answer: 0, explainAr: 'الجملة مثبتة وفيها الفعل الناقص can، فالذيل منفي بـ can نفسه: can\'t she?' },
        { n: 19, kind: 'mcq', topic: 'grammar', prompt: 'Last night, my uncle saw ___ UFO in the sky.', promptAr: 'ليلة البارحة رأى عمّي ___ جسماً طائراً مجهولاً في السماء.', options: ['an', 'a', 'the', 'no article'], answer: 1, explainAr: 'العبرة بالصوت لا بالحرف: UFO تُلفظ /juː-ef-oʊ/ وتبدأ بصوت ساكن (مثل a university)، ونذكره أول مرة: a UFO.' },
        { n: 20, kind: 'mcq', topic: 'grammar', prompt: 'The strange lights ___ by many people last night.', promptAr: 'الأضواء الغريبة ___ من قِبَل كثير من الناس ليلة البارحة.', options: ['saw', 'were seeing', 'were seen', 'are seen'], answer: 2, explainAr: 'الأضواء لا ترى بل تُرى (by many people)، والزمن ماضٍ (last night) والفاعل جمع: were + التصريف الثالث: were seen.' },
        { n: 21, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has three syllables is:', promptAr: 'الكلمة التي تتكون من ثلاثة مقاطع صوتية هي:', options: ['fashion', 'trend', 'remarkable', 'confident'], answer: 3, explainAr: 'con-fi-dent = 3 مقاطع. أما fash-ion فمقطعان، و trend مقطع واحد، و re-mark-a-ble أربعة مقاطع.' },
        { n: 22, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has /tʃ/ sound is:', promptAr: 'الكلمة التي تحتوي على الصوت /tʃ/ هي:', options: ['share', 'cheese', 'sure', 'sheep'], answer: 1, explainAr: 'ch في cheese تُلفظ /tʃ/ (تش). أما share و sheep ففيهما /ʃ/ (ش)، و sure يُلفظ فيها s بصوت /ʃ/.' },
        { n: 23, kind: 'mcq', topic: 'pronunciation', prompt: 'The word "leaves" has ___ sound.', promptAr: 'كلمة "leaves" فيها الصوت ___.', options: ['/f/', '/v/', '/ʃ/', 'both a and b'], answer: 1, explainAr: 'المفرد leaf ينتهي بـ /f/، لكن الجمع leaves يُلفظ بـ /v/ (مثل wife → wives و knife → knives).' },
        { n: 24, kind: 'mcq', topic: 'grammar', prompt: 'We usually have ___ breakfast at seven o\'clock.', promptAr: 'نتناول عادةً ___ الفطور في الساعة السابعة.', options: ['a', 'an', 'the', 'no article'], answer: 3, explainAr: 'لا نستخدم أداة قبل أسماء الوجبات (breakfast, lunch, dinner): have breakfast.' },
        { n: 25, kind: 'mcq', topic: 'grammar', prompt: 'This mystery cannot ___ easily.', promptAr: 'هذا اللغز لا يمكن ___ بسهولة.', options: ['explain', 'explained', 'be explained', 'be explaining'], answer: 2, explainAr: 'المبني للمجهول مع الأفعال الناقصة: cannot + be + التصريف الثالث: cannot be explained.' },
        { n: 26, kind: 'mcq', topic: 'wordform', prompt: 'Hala believes in herself. She is a ___ girl.', promptAr: 'هالة تؤمن بنفسها. إنها فتاة ___.', options: ['confidence', 'confident', 'confidently', 'confide'], answer: 1, explainAr: 'قبل الاسم (girl) نحتاج صفة: confident (واثقة). أما confidence فاسم، و confidently حال.' },
        { n: 27, kind: 'mcq', topic: 'vocab', prompt: 'Physically healthy, fit and strong:', promptAr: 'سليم الجسم ولائق وقوي:', options: ['disabled', 'qualified', 'able-bodied', 'promising'], answer: 2, explainAr: 'able-bodied = سليم الجسم وقوي، وعكسها disabled (الوحدة التاسعة).' },
        { n: 28, kind: 'mcq', topic: 'vocab', prompt: 'Shoes, boots, etc.:', promptAr: 'الأحذية والجزمات وما شابهها:', options: ['footwear', 'accessories', 'cardigan', 'jeans'], answer: 0, explainAr: 'footwear = الأحذية بأنواعها (الوحدة الثامنة). أما accessories فهي الإكسسوارات كالحقائب والأحزمة.' },
        { n: 29, kind: 'mcq', topic: 'vocab', prompt: 'A creature from outer space is called ___.', promptAr: 'المخلوق القادم من الفضاء الخارجي يسمّى ___.', options: ['pilot', 'alien', 'pelican', 'researcher'], answer: 1, explainAr: 'alien = كائن فضائي (الوحدة الثانية عشرة).' },
        { n: 30, kind: 'mcq', topic: 'vocab', prompt: 'The yellow part of an egg is known as ___.', promptAr: 'الجزء الأصفر من البيضة يُعرف بـ ___.', options: ['saucer', 'shelf', 'surface', 'yolk'], answer: 3, explainAr: 'yolk = صفار البيض (الوحدة الحادية عشرة).' },
      ],
    },
    {
      letter: 'D',
      title: 'Ask about the underline word(s):',
      titleAr: 'اسأل عن الكلمة (الكلمات) التي تحتها خط:',
      marks: 40,
      questions: [
        { n: 31, kind: 'ask', prompt: 'Rami stopped running {because he hurt his knee}.', promptAr: 'توقّف رامي عن الجري لأنه آذى ركبته.', options: ['Why Rami stopped running?', 'When did Rami stop running?', 'Why did Rami stop running?', 'Why did Rami stopped running?'], answer: 2, explainAr: 'نسأل عن السبب (because ...) فنستخدم Why، والفعل ماضٍ فنستخدم did + الفعل المجرد: Why did Rami stop running?' },
        { n: 32, kind: 'ask', prompt: 'Kenneth Arnold saw {nine} objects in the sky.', promptAr: 'رأى كينيث أرنولد تسعة أجسام في السماء.', options: ['How many objects did Kenneth Arnold see?', 'How much objects did Kenneth Arnold see?', 'How many objects Kenneth Arnold saw?', 'What did Kenneth Arnold see?'], answer: 0, explainAr: 'نسأل عن عدد شيء معدود (nine objects) فنستخدم How many، ثم did + الفاعل + الفعل المجرد.' },
        { n: 33, kind: 'ask', prompt: 'The strange sounds were heard {in an old house}.', promptAr: 'سُمعت الأصوات الغريبة في بيت قديم.', options: ['When were the strange sounds heard?', 'Where did the strange sounds heard?', 'Where the strange sounds were heard?', 'Where were the strange sounds heard?'], answer: 3, explainAr: 'نسأل عن المكان فنستخدم Where، والجملة مبنية للمجهول فنقدّم were على الفاعل: Where were the strange sounds heard?' },
        { n: 34, kind: 'ask', prompt: 'Bayan {reviewed her plan}.', promptAr: 'راجعت بيان خطّتها.', options: ['Who reviewed her plan?', 'What did Bayan do?', 'What did Bayan review?', 'What Bayan did?'], answer: 1, explainAr: 'المسطّر هو الفعل وما بعده (ما فعلته بيان)، فنسأل بـ What did ... do: What did Bayan do?' },
      ],
    },
    {
      letter: 'E',
      title: 'Choose the wrong part in each phrase:',
      titleAr: 'اختر الجزء الخاطئ في كل جملة:',
      marks: 20,
      questions: [
        { n: 35, kind: 'wrongpart', prompt: '{This} {exam} {was} {more easy} than the last one.', promptAr: 'كان هذا الامتحان أسهل من الامتحان السابق.', answer: 3, explainAr: 'easy تنتهي بـ y، فنقلب y إلى i ونضيف -er ولا نستخدم more: more easy ← easier.' },
        { n: 36, kind: 'wrongpart', prompt: 'Bayan {wishes} she {can} {play} {the} piano.', promptAr: 'تتمنى بيان لو تستطيع العزف على البيانو.', answer: 1, explainAr: 'بعد wish نستخدم الماضي، فالقدرة التي لا نملكها تكون بـ could: can ← could.' },
        { n: 37, kind: 'wrongpart', prompt: 'Lamar {didn\'t} {come} {yesterday}, {didn\'t} she?', promptAr: 'لم تأتِ لمار البارحة، أليس كذلك؟', answer: 3, explainAr: 'الجملة منفية فيجب أن يكون الذيل مثبتاً: didn\'t she ← did she?' },
        { n: 38, kind: 'wrongpart', prompt: '{An} UFO {was} {seen} {in} the sky.', promptAr: 'شوهد جسم طائر مجهول في السماء.', answer: 0, explainAr: 'UFO تبدأ بصوت ساكن /juː/ فنستخدم a لا an: An ← A UFO.' },
      ],
    },
    {
      letter: 'F',
      title: 'Write a 50-word paragraph about the following topic:',
      titleAr: 'اكتب فقرة من 50 كلمة عن الموضوع التالي:',
      marks: 40,
      writing: {
        topic: 'A celebration you went to and the clothes you wore',
        topicAr: 'احتفال ذهبت إليه والملابس التي ارتديتها',
        words: 50,
        model: "Last month, I went to my cousin's wedding. It was the most beautiful celebration I have ever been to. I wanted to look elegant, so I chose a long blue dress and black shoes. I also wore a silver necklace as an accessory. My mother helped me with my hairstyle. The bride wore a white dress and she looked lovelier than a princess. I felt confident and happy all night.",
        modelAr: 'في الشهر الماضي ذهبت إلى عرس ابن عمّي. كان أجمل احتفال حضرته في حياتي. أردت أن أبدو أنيقة، فاخترت فستاناً أزرق طويلاً وحذاءً أسود، وارتديت أيضاً عقداً فضياً كإكسسوار. وساعدتني أمي في تسريحة شعري. ارتدت العروس فستاناً أبيض وبدت أجمل من أميرة. شعرت بالثقة والسعادة طوال الليل.',
        checklistAr: [
          'كتبت عن الموضوع المطلوب نفسه (احتفال ذهبت إليه والملابس التي اخترتها).',
          'وصفت الملابس (النوع واللون) وذكرت سبب اختيارها.',
          'استخدمت صيغتي المقارنة والتفضيل بشكل صحيح (lovelier than / the most beautiful).',
          'راعيت الإملاء وعلامات الترقيم والحروف الكبيرة واستخدمت الماضي البسيط لسرد الأحداث.',
        ],
      },
    },
  ],
}
