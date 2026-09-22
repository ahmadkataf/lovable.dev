import type { Exam } from '../../../engine/types'

// Term 2 practice paper C, written on the pattern of the real final exam (Grade 8, 60 minutes, 400 marks).
export const term2C: Exam = {
  id: 't2-c',
  term: 2,
  title: 'Term 2 — Test (C)',
  titleAr: 'الفصل الثاني — النموذج (C)',
  minutes: 60,
  totalMarks: 400,
  sourceAr: 'نموذج تدريبي للفصل الثاني على نمط الامتحان النهائي، يغطي الوحدات 7–12 (نصّا القراءة من الوحدتين 12 و10).',
  sections: [
    {
      letter: 'A',
      title: 'Read the following text then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ النص التالي ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 50,
      passage: {
        paragraphs: [
          "Last year, some people in a small village near Tartous reported seeing a strange light in the sky. It was round like a saucer, and it moved very fast. Some villagers were sure that it was a UFO and that aliens were coming from another planet. Photos of the light were taken by a young farmer, and they were shared on the internet. The next day, the story was read by thousands of people. Many of them believed that the light was a spaceship. Others said that it was a mystery, and that nobody could explain it. However, the photos were studied by a researcher from the university. {He} said that the light was not a spaceship at all. He explained that it was probably a kind of lightning, which is sometimes seen during storms when the humidity in the air is high. He also said that a \"V\" shape in one of the photos was made by a flock of birds that were migrating to Africa. Some villagers were convinced by his explanation, but others still deny it. They say that the government knows the truth and keeps it secret. Until today, the mysterious light is remembered by everyone in the village. Is it really a mystery, or is there a simple explanation? What do you think?",
        ],
        paragraphsAr: [
          'في العام الماضي أفاد بعض سكان قرية صغيرة قرب طرطوس أنهم رأوا ضوءاً غريباً في السماء. كان مستديراً مثل الصحن الصغير، وكان يتحرّك بسرعة كبيرة. كان بعض القرويين متأكّدين أنه جسم طائر مجهول وأن كائنات فضائية قادمة من كوكب آخر. التقط مزارع شاب صوراً للضوء ونُشرت على الإنترنت. وفي اليوم التالي قرأ القصةَ آلافُ الناس، واعتقد كثير منهم أن الضوء كان سفينة فضاء، بينما قال آخرون إنه لغز لا يستطيع أحد تفسيره. لكنّ باحثاً من الجامعة درس الصور، وقال إن الضوء لم يكن سفينة فضاء على الإطلاق. وشرح أنه على الأرجح نوع من البرق الذي يُرى أحياناً أثناء العواصف عندما تكون الرطوبة في الهواء مرتفعة. وقال أيضاً إن شكل حرف "V" في إحدى الصور صنعه سرب من الطيور كان يهاجر إلى أفريقيا. اقتنع بعض القرويين بتفسيره، لكن آخرين ما زالوا ينكرونه، ويقولون إن الحكومة تعرف الحقيقة وتبقيها سرّاً. وحتى اليوم ما زال الجميع في القرية يتذكّرون الضوء الغامض. هل هو لغز حقاً، أم أن هناك تفسيراً بسيطاً؟ ما رأيك؟',
        ],
      },
      questions: [
        { n: 1, kind: 'mcq', prompt: 'The photos of the light were taken by ___.', promptAr: 'التُقطت صور الضوء من قِبَل ___.', options: ['a young farmer', 'a pilot', 'a researcher', 'the government'], answer: 0, explainAr: 'النص: "Photos of the light were taken by a young farmer".' },
        { n: 2, kind: 'mcq', prompt: 'The researcher thought that ___.', promptAr: 'اعتقد الباحث أن ___.', options: ['nobody could explain the light', 'the light was an alien spaceship', 'the light was not a UFO but a natural thing', 'the government kept the truth secret'], answer: 2, explainAr: 'قال الباحث إن الضوء "was not a spaceship at all" وإنه على الأرجح نوع من البرق، أي شيء طبيعي لا جسم طائر مجهول. أما الخياران «the light was an alien spaceship» و «nobody could explain the light» فهما رأي القرويين، و «the government kept the truth secret» رأي من ينكرون تفسيره.' },
        { n: 3, kind: 'mcq', prompt: 'What does "He" in the text refer to?', promptAr: 'إلامَ تعود كلمة "He" في النص؟', options: ['an alien', 'the researcher', 'the young farmer', 'the pilot'], answer: 1, explainAr: 'الجملة السابقة: "the photos were studied by a researcher from the university. He said that ..." — فكلمة He تعود على الباحث (the researcher).' },
        { n: 4, kind: 'mcq', prompt: '"Secret" is the opposite of:', promptAr: 'كلمة "Secret" (سرّي) عكسها:', options: ['mysterious', 'hidden', 'unknown', 'public'], answer: 3, explainAr: 'secret = سرّي مخفيّ عن الآخرين، وعكسها public (علني يعرفه الجميع). أما hidden فمعناها قريب من secret.' },
        { n: 5, kind: 'mcq', prompt: '"Deny" means ___.', promptAr: 'كلمة "Deny" تعني ___.', options: ['to make something clear', 'to move to another place', 'to look like', 'to say that something is not true'], answer: 3, explainAr: 'deny = يُنكر، أي يقول إن شيئاً ما غير صحيح. الخيار «to make something clear» معنى clarify، و «to move to another place» معنى migrate، و «to look like» معنى resemble.' },
      ],
    },
    {
      letter: 'B',
      title: 'Read the following text then write if the sentences are True or False:',
      titleAr: 'اقرأ النص التالي ثم اكتب إن كانت الجمل صحيحة أم خاطئة:',
      marks: 50,
      passage: {
        paragraphs: [
          "Bayan is fifteen years old, and she has a big dream: she wants to be a well-known writer. Her passion for stories started in her childhood. When she was six, her grandmother told her a story every night, and Bayan used her imagination to see the pictures in her mind. Last year, Bayan wrote her first short story and sent it to a competition. She didn't win, and she was very sad. \"Maybe I don't have the skill,\" she said. But her teacher told her, \"Every writer fails at the beginning. A setback isn't the end of the road. It's a challenge, isn't it?\" Bayan didn't quit. She decided to invest two hours every day in reading and writing. She read stories by famous writers and learned a lot from them. She also stopped making excuses like \"I'm tired\" or \"I have no time\". Her purpose was clear, and her passion kept her focused and on track. This year, she sent a new story to the same competition, and it won the first prize. Her family was very proud of her. Now Bayan tells her friends, \"If you are passionate about your dream, you will go after it regardless of the obstacles.\"",
        ],
        paragraphsAr: [
          'بيان عمرها خمس عشرة سنة، ولديها حلم كبير: تريد أن تصبح كاتبة مشهورة. بدأ شغفها بالقصص في طفولتها؛ فعندما كانت في السادسة كانت جدّتها تحكي لها قصة كل ليلة، وكانت بيان تستخدم خيالها لترى الصور في ذهنها. في العام الماضي كتبت بيان أول قصة قصيرة لها وأرسلتها إلى مسابقة، لكنها لم تفز وحزنت كثيراً، وقالت: "ربما لا أملك المهارة". لكن معلّمتها قالت لها: "كل كاتب يفشل في البداية. العثرة ليست نهاية الطريق، إنها تحدٍّ، أليس كذلك؟" لم تستسلم بيان، وقرّرت أن تخصّص ساعتين كل يوم للقراءة والكتابة. قرأت قصصاً لكتّاب مشهورين وتعلّمت منها الكثير. وتوقّفت أيضاً عن اختلاق الأعذار مثل "أنا متعبة" أو "ليس لديّ وقت". كان هدفها واضحاً، وأبقاها شغفها مركّزة وعلى الطريق الصحيح. وفي هذا العام أرسلت قصة جديدة إلى المسابقة نفسها ففازت بالجائزة الأولى، وكانت عائلتها فخورة بها جداً. والآن تقول بيان لصديقاتها: "إن كنتِ شغوفة بحلمك فستسعين وراءه مهما كانت العقبات".',
        ],
      },
      questions: [
        { n: 6, kind: 'truefalse', prompt: "Bayan's passion for stories started when she was a child.", promptAr: 'بدأ شغف بيان بالقصص عندما كانت طفلة.', answer: true, explainAr: 'النص: "Her passion for stories started in her childhood".' },
        { n: 7, kind: 'truefalse', prompt: 'Bayan won the competition the first time.', promptAr: 'فازت بيان بالمسابقة في المرة الأولى.', answer: false, explainAr: 'النص عن قصتها الأولى: "She didn\'t win, and she was very sad".' },
        { n: 8, kind: 'truefalse', prompt: "Bayan's teacher told her to stop writing.", promptAr: 'طلبت المعلّمة من بيان أن تتوقّف عن الكتابة.', answer: false, explainAr: 'المعلّمة شجّعتها وقالت إن العثرة ليست نهاية الطريق بل تحدٍّ: "A setback isn\'t the end of the road".' },
        { n: 9, kind: 'truefalse', prompt: 'Bayan spent two hours every day reading and writing.', promptAr: 'قضت بيان ساعتين كل يوم في القراءة والكتابة.', answer: true, explainAr: 'النص: "She decided to invest two hours every day in reading and writing".' },
        { n: 10, kind: 'truefalse', prompt: "Bayan's new story won the second prize.", promptAr: 'فازت قصة بيان الجديدة بالجائزة الثانية.', answer: false, explainAr: 'النص: "it won the first prize" — الجائزة الأولى لا الثانية.' },
      ],
    },
    {
      letter: 'C',
      title: 'Read the sentences then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ الجمل ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 200,
      questions: [
        { n: 11, kind: 'mcq', topic: 'grammar', prompt: 'My new school is ___ from my house than my old school.', promptAr: 'مدرستي الجديدة ___ عن بيتي من مدرستي القديمة.', options: ['more far', 'far', 'farther', 'farthest'], answer: 2, explainAr: 'far صفة شاذة: far → farther → the farthest. ومعنا than فنحتاج صيغة المقارنة: farther.' },
        { n: 12, kind: 'mcq', topic: 'grammar', prompt: 'Mulham is ___ player in the team.', promptAr: 'ملهم هو ___ لاعب في الفريق.', options: ['the best', 'the better', 'better', 'the goodest'], answer: 0, explainAr: 'نقارن ملهم بكل لاعبي الفريق (in the team) فنستخدم التفضيل. good صفة شاذة: good → better → the best.' },
        { n: 13, kind: 'mcq', topic: 'grammar', prompt: 'My father smokes a lot. I wish he ___ smoke.', promptAr: 'أبي يدخّن كثيراً. أتمنى لو أنه لا يدخّن.', options: ["won't", "didn't", "doesn't", "isn't"], answer: 1, explainAr: 'نتمنى عكس حقيقة في الحاضر فنرجع بعد wish خطوة إلى الماضي: I wish he didn\'t smoke.' },
        { n: 14, kind: 'mcq', topic: 'grammar', prompt: "Lamar and Layan aren't at school today, ___?", promptAr: 'لمار وليان ليستا في المدرسة اليوم، أليس كذلك؟', options: ['are they', 'do they', "aren't they", 'is she'], answer: 0, explainAr: 'الجملة منفية بـ aren\'t فيكون السؤال الذيلي مثبتاً بالفعل نفسه، والفاعل جمع فنستخدم they: are they.' },
        { n: 15, kind: 'mcq', topic: 'grammar', prompt: 'Damascus is one of the oldest cities in ___ world.', promptAr: 'دمشق من أقدم المدن في العالم.', options: ['a', 'an', 'the', '(no article)'], answer: 2, explainAr: 'العالم شيء وحيد من نوعه فنستخدم the: in the world.' },
        { n: 16, kind: 'mcq', topic: 'grammar', prompt: 'Many ancient remains ___ in Syria every year.', promptAr: 'تُكتشف آثار قديمة كثيرة في سوريا كل عام.', options: ['are discovering', 'discover', 'discovered', 'are discovered'], answer: 3, explainAr: 'الآثار لا تكتشف نفسها بل يكتشفها الناس، فنستخدم المبني للمجهول في المضارع البسيط (every year) مع فاعل جمع: are + التصريف الثالث: are discovered.' },
        { n: 17, kind: 'mcq', topic: 'grammar', prompt: 'Hala is ___ than her brother.', promptAr: 'هالة ___ من أخيها.', options: ['funnyer', 'funnier', 'the funniest', 'more funny'], answer: 1, explainAr: 'الصفة funny تنتهي بـ y فتتحوّل y إلى i ثم نضيف -er: funnier. ومعنا than فنحتاج المقارنة لا التفضيل.' },
        { n: 18, kind: 'mcq', topic: 'grammar', prompt: "I'm not a good swimmer. I wish I ___ a good swimmer.", promptAr: 'لست سبّاحاً جيداً. أتمنى لو كنت سبّاحاً جيداً.', options: ['were', 'be', 'will be', 'am'], answer: 0, explainAr: 'بعد wish نرجع خطوة إلى الماضي، ومع فعل الكون نستخدم were مع كل الضمائر: I wish I were ...' },
        { n: 19, kind: 'mcq', topic: 'grammar', prompt: 'Basel will come to the party, ___?', promptAr: 'سيأتي باسل إلى الحفلة، أليس كذلك؟', options: ['will he', "won't he", "doesn't he", "isn't he"], answer: 1, explainAr: 'الجملة مثبتة بالفعل will فيكون السؤال الذيلي منفياً بالفعل نفسه: won\'t he.' },
        { n: 20, kind: 'mcq', topic: 'grammar', prompt: 'This photo ___ by my uncle in 2010.', promptAr: 'التُقطت هذه الصورة من قِبَل عمّي عام 2010.', options: ['took', 'was took', 'was taken', 'is taking'], answer: 2, explainAr: 'الصورة لا تلتقط نفسها، ومعنا by و 2010 (ماضٍ)، فنستخدم المبني للمجهول: was + التصريف الثالث taken (لا took).' },
        { n: 21, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has one syllable is:', promptAr: 'الكلمة المؤلفة من مقطع صوتي واحد هي:', options: ['makeup', 'rabbit', 'hotel', 'twist'], answer: 3, explainAr: 'twist مقطع واحد. أما make-up و ho-tel و rab-bit فكل منها مقطعان.' },
        { n: 22, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has both /f/ and /v/ sounds is:', promptAr: 'الكلمة التي فيها الصوتان /f/ و /v/ معاً هي:', options: ['five', 'feet', 'off', 'vet'], answer: 0, explainAr: 'five تبدأ بـ /f/ وتنتهي بـ /v/. أما feet و off ففيهما /f/ فقط، و vet فيها /v/ فقط.' },
        { n: 23, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has /tʃ/ sound is:', promptAr: 'الكلمة التي فيها الصوت /tʃ/ (تش) هي:', options: ['sure', 'ship', 'chin', 'share'], answer: 2, explainAr: 'ch في chin تُلفظ /tʃ/ (تش). أما sh في share و ship، و s في sure فتُلفظ /ʃ/ (ش).' },
        { n: 24, kind: 'mcq', topic: 'grammar', prompt: 'Maths is ___ subject for me.', promptAr: 'الرياضيات هي ___ مادة بالنسبة لي.', options: ['the difficultest', 'the most difficult', 'more difficult', 'most difficult'], answer: 1, explainAr: 'نقارن الرياضيات بكل المواد فنستخدم التفضيل، والصفة طويلة فنقول the most + الصفة: the most difficult.' },
        { n: 25, kind: 'mcq', topic: 'grammar', prompt: 'Mouayyad wants to be ___ pilot.', promptAr: 'يريد مؤيّد أن يصبح طياراً.', options: ['the', 'an', '(no article)', 'a'], answer: 3, explainAr: 'نستخدم a قبل الاسم المفرد المعدود الذي يبدأ بصوت ساكن، ومنها أسماء المهن: a pilot.' },
        { n: 26, kind: 'mcq', topic: 'wordform', prompt: 'The light in the sky was very ___.', promptAr: 'كان الضوء في السماء غامضاً جداً.', options: ['mysteriously', 'mysteries', 'mystery', 'mysterious'], answer: 3, explainAr: 'بعد was very نحتاج صفة تصف الضوء: mysterious (غامض). أما mystery فاسم (لغز)، و mysteriously ظرف.' },
        { n: 27, kind: 'mcq', topic: 'vocab', prompt: 'A strong wish to achieve something:', promptAr: 'رغبة قوية في تحقيق شيء ما:', options: ['ambition', 'existence', 'setback', 'excuse'], answer: 0, explainAr: 'ambition = طموح (كلمة من الوحدة العاشرة).' },
        { n: 28, kind: 'mcq', topic: 'vocab', prompt: 'A person who studies something carefully to find out facts:', promptAr: 'شخص يدرس شيئاً بعناية ليكتشف الحقائق:', options: ['clerk', 'pilot', 'researcher', 'housewife'], answer: 2, explainAr: 'researcher = باحث (كلمة من الوحدة الثانية عشرة).' },
        { n: 29, kind: 'mcq', topic: 'vocab', prompt: 'Light in colour (hair or skin):', promptAr: 'فاتح اللون (للشعر أو البشرة):', options: ['straight', 'fair', 'round', 'bright'], answer: 1, explainAr: 'fair = أشقر أو فاتح اللون (كلمة من الوحدة السابعة). أما straight فتعني أملس غير مجعّد، و bright لامع.' },
        { n: 30, kind: 'mcq', topic: 'vocab', prompt: 'The yellow part of an egg is called the ___.', promptAr: 'الجزء الأصفر من البيضة يُسمّى ___.', options: ['shelf', 'saucer', 'yolk', 'wing'], answer: 2, explainAr: 'yolk = صفار البيض (كلمة من الوحدة الحادية عشرة).' },
      ],
    },
    {
      letter: 'D',
      title: 'Ask about the underline word(s):',
      titleAr: 'اسأل عن الكلمة (الكلمات) التي تحتها خط:',
      marks: 40,
      questions: [
        { n: 31, kind: 'ask', prompt: 'The farmer saw {three} strange lights in the sky.', promptAr: 'رأى المزارع ثلاثة أضواء غريبة في السماء.', options: ['How many strange lights did the farmer see in the sky?', 'How much strange lights did the farmer see in the sky?', 'How many strange lights did the farmer saw in the sky?', 'How many strange lights the farmer saw in the sky?'], answer: 0, explainAr: 'نسأل عن عدد شيء معدود بـ How many، والفعل في الماضي فنستخدم did + الفعل المجرد see: How many strange lights did the farmer see in the sky?' },
        { n: 32, kind: 'ask', prompt: "Bayan's story won {the first prize}.", promptAr: 'فازت قصة بيان بالجائزة الأولى.', options: ["Who did Bayan's story win?", "What did Bayan's story win?", "What does Bayan's story win?", "What Bayan's story won?"], answer: 1, explainAr: 'نسأل عن شيء (the first prize) في موقع المفعول به بـ What، والفعل في الماضي فنستخدم did + الفعل المجرد: What did Bayan\'s story win?' },
        { n: 33, kind: 'ask', prompt: 'The photos were taken {by a young farmer}.', promptAr: 'التُقطت الصور من قِبَل مزارع شاب.', options: ['Who did the photos taken by?', 'Who the photos were taken by?', 'What were the photos taken by?', 'Who were the photos taken by?'], answer: 3, explainAr: 'نسأل عن الشخص الذي قام بالفعل (by a young farmer) بـ Who ... by، والجملة مبنية للمجهول بـ were فنقدّمها على الفاعل: Who were the photos taken by?' },
        { n: 34, kind: 'ask', prompt: 'Mulham went to the doctor {yesterday}.', promptAr: 'ذهب ملهم إلى الطبيب البارحة.', options: ['When did Mulham went to the doctor?', 'Where did Mulham go?', 'When did Mulham go to the doctor?', 'When Mulham went to the doctor?'], answer: 2, explainAr: 'نسأل عن الزمن (yesterday) بـ When، والفعل في الماضي فنستخدم did + الفعل المجرد go: When did Mulham go to the doctor?' },
      ],
    },
    {
      letter: 'E',
      title: 'Choose the wrong part in each phrase:',
      titleAr: 'اختر الجزء الخاطئ في كل جملة:',
      marks: 20,
      questions: [
        { n: 35, kind: 'wrongpart', prompt: 'Many UFO {stories} {are} {tell} {in} movies.', promptAr: 'تُروى قصص كثيرة عن الأجسام الطائرة المجهولة في الأفلام.', answer: 2, explainAr: 'المبني للمجهول = are + التصريف الثالث للفعل: tell ← told.' },
        { n: 36, kind: 'wrongpart', prompt: '{A} Nile {is} {the} longest river {in} Africa.', promptAr: 'النيل أطول نهر في أفريقيا.', answer: 0, explainAr: 'نستخدم the مع أسماء الأنهار ومع الأشياء الوحيدة من نوعها: A Nile ← The Nile.' },
        { n: 37, kind: 'wrongpart', prompt: 'She {wishes} she {has} {long} hair {like} her sister.', promptAr: 'تتمنى لو كان لديها شعر طويل مثل أختها.', answer: 1, explainAr: 'بعد wish نرجع خطوة إلى الماضي البسيط: has ← had.' },
        { n: 38, kind: 'wrongpart', prompt: "Layan {didn't} {see} {the} ghost, {didn't she}?", promptAr: 'لم ترَ ليان الشبح، أليس كذلك؟', answer: 3, explainAr: 'الجملة منفية (didn\'t see) فيكون السؤال الذيلي مثبتاً: didn\'t she ← did she.' },
      ],
    },
    {
      letter: 'F',
      title: 'Write a 50-word paragraph about the following topic:',
      titleAr: 'اكتب فقرة من 50 كلمة عن الموضوع التالي:',
      marks: 40,
      writing: {
        topic: 'Your favourite superhero',
        topicAr: 'بطلك الخارق المفضّل',
        words: 50,
        model: "My favourite superhero is Superman. He wears a blue uniform with a red cape and a big 'S' on his chest. He is stronger than a hundred men, and he can fly faster than a plane. He can also see through walls. I like him because he uses his power to help people, and he never gives up. I think he is the bravest superhero in the world.",
        modelAr: 'بطلي الخارق المفضّل هو سوبرمان. يرتدي زيّاً أزرق مع رداء أحمر وحرف "S" كبير على صدره. هو أقوى من مئة رجل، ويستطيع أن يطير أسرع من الطائرة، ويستطيع أيضاً أن يرى عبر الجدران. أحبّه لأنه يستخدم قوته لمساعدة الناس ولا يستسلم أبداً. أظنّ أنه أشجع بطل خارق في العالم.',
        checklistAr: [
          'كتبت عن الموضوع المطلوب نفسه (بطلي الخارق المفضّل).',
          'وصفت زيّه (uniform) وقوته الخارقة (power) وسبب إعجابي به (because).',
          'استخدمت صيغة المقارنة (stronger than) والتفضيل (the bravest) وأدوات a / an / the بشكل صحيح.',
          'راعيت الإملاء وعلامات الترقيم والحروف الكبيرة.',
        ],
      },
    },
  ],
}
