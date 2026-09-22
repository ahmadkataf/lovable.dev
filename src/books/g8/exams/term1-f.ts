import type { Exam } from '../../../engine/types'

// Practice paper in the exact format of the real Term 1 final exam (Grade 8, 60 minutes, 400 marks).
export const term1F: Exam = {
  id: 't1-f',
  term: 1,
  title: 'Term 1 — Test (F)',
  titleAr: 'الفصل الأول — النموذج (F)',
  minutes: 60,
  totalMarks: 400,
  sourceAr: 'نموذج تدريبي على نمط الامتحان النهائي يغطّي الوحدات 1–6: القراءة من الوحدتين 6 و3، والكتابة من الوحدة 4، والقواعد والأصوات من الفصل الأول كاملاً.',
  sections: [
    {
      letter: 'A',
      title: 'Read the following text then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ النص التالي ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 50,
      passage: {
        paragraphs: [
          "When Rasha was a little girl, she loved making soap with her grandmother. Her grandmother used a traditional method that her family had followed for many years. Rasha always dreamed of having her own business one day. After she graduated from university, Rasha decided to make her dream come true. She didn't have much money, so she started her project in a small room in her parents' house. With humble help from her family, she made her first soap bars and sold them to her neighbours. Her customers liked them very much and told their friends about them. Of course, it wasn't easy. Some people told her that starting a business was a big risk, and many times she wanted to give up. But Rasha didn't hesitate. She worked hard, learned about marketing and created a page on social media to show her products. Soon, people from other cities were ordering her soap online. Today, Rasha is the founder of a successful company {which} sells soap in many countries. Twenty workers from her town work with her. When young people ask her for advice, she always says, \"If you really believed in your dream, you would never give up. Take small steps, and never stop learning.\"",
        ],
        paragraphsAr: [
          'عندما كانت رشا طفلة صغيرة كانت تحبّ صنع الصابون مع جدّتها. كانت جدّتها تستخدم طريقة تقليدية اتّبعتها عائلتها سنوات كثيرة. وكانت رشا تحلم دائماً بأن يكون لها عملها الخاص يوماً ما. بعد أن تخرّجت في الجامعة قرّرت رشا أن تحقّق حلمها. لم يكن لديها مال كثير، فبدأت مشروعها في غرفة صغيرة في بيت والديها. وبمساعدة بسيطة من عائلتها صنعت أول قطع صابون وباعتها لجيرانها. أعجبت القطع زبائنها كثيراً فأخبروا أصدقاءهم عنها. لم يكن الأمر سهلاً بالطبع. قال لها بعض الناس إن بدء عمل تجاري مخاطرة كبيرة، وأرادت أن تستسلم مرات كثيرة. لكن رشا لم تتردّد. عملت بجدّ وتعلّمت التسويق وأنشأت صفحة على وسائل التواصل الاجتماعي لتعرض منتجاتها. وسرعان ما صار الناس من مدن أخرى يطلبون صابونها عبر الإنترنت. واليوم رشا هي مؤسِّسة شركة ناجحة تبيع الصابون في بلدان كثيرة، ويعمل معها عشرون عاملاً من بلدتها. وعندما يطلب منها الشباب النصيحة تقول دائماً: "لو آمنتم حقاً بحلمكم لما استسلمتم أبداً. خذوا خطوات صغيرة ولا تتوقّفوا عن التعلّم أبداً."',
        ],
      },
      questions: [
        { n: 1, kind: 'mcq', prompt: 'Rasha learned to make soap from her ___.', promptAr: 'تعلّمت رشا صنع الصابون من ___.', options: ['grandmother', 'mother', 'neighbours', 'teachers'], answer: 0, explainAr: 'النص: "she loved making soap with her grandmother. Her grandmother used a traditional method" — تعلّمته من جدّتها.' },
        { n: 2, kind: 'mcq', prompt: 'Rasha started her business ___.', promptAr: 'بدأت رشا عملها ___.', options: ['with a lot of money from a bank', 'with little money and simple help from her family', 'in a big factory in another city', 'before she graduated from university'], answer: 1, explainAr: 'النص: "She didn\'t have much money ... With humble help from her family" — بمال قليل ومساعدة بسيطة من عائلتها. والخيار d خاطئ لأنها بدأت بعد التخرّج (After she graduated).' },
        { n: 3, kind: 'mcq', prompt: 'What does "which" in the text refer to?', promptAr: 'إلامَ تعود كلمة "which" في النص؟', options: ['soap', 'a successful company', 'countries', 'Rasha'], answer: 1, explainAr: 'الجملة: "a successful company which sells soap in many countries"، فكلمة which تعود على a successful company (الشركة هي التي تبيع الصابون).' },
        { n: 4, kind: 'mcq', prompt: '"Risk" is the opposite of:', promptAr: 'كلمة "Risk" (مخاطرة) عكسها:', options: ['danger', 'safety', 'advice', 'dream'], answer: 1, explainAr: 'risk = احتمال حدوث شيء سيّئ (مخاطرة)، وعكسها safety = الأمان والسلامة من الخطر. أما danger فمعناها قريب من risk لا عكسها.' },
        { n: 5, kind: 'mcq', prompt: '"Founder" means ___.', promptAr: 'كلمة "Founder" تعني ___.', options: ['a person who buys goods', 'a person who starts a company', 'a person who gives advice', 'a person who works in a factory'], answer: 1, explainAr: 'founder = مؤسِّس، أي الشخص الذي يبدأ شركة أو مؤسسة. أما a person who buys goods فهو customer.' },
      ],
    },
    {
      letter: 'B',
      title: 'Read the following text then write if the sentences are True or False:',
      titleAr: 'اقرأ النص التالي ثم اكتب إن كانت الجمل صحيحة أم خاطئة:',
      marks: 50,
      passage: {
        paragraphs: [
          "Last spring, Omar and his classmates went on a school trip to the island of Arwad. Their teacher had organized the journey with a tourist company two weeks before, and the company had confirmed the dates and the price. On the morning of the trip, the students met at school at six o'clock. They travelled by bus to Tartous, and the journey took about three hours. While they were driving along the coast, they sang songs and played games. Upon arrival in Tartous, they took a small ferry to the island. It was Omar's first time on a boat, so he felt a little afraid, but the sea was calm. On the island, a guide accompanied them. He showed them the old fortress and told them about the history of the island. After that, they had grilled fish at a small restaurant near the sea. In the afternoon, the students visited the old market and bought souvenirs for their families. In the evening, they went back home tired but happy. Omar told his parents that it had been the best day of the year. He said that he would never forget it.",
        ],
        paragraphsAr: [
          'في الربيع الماضي ذهب عمر وزملاؤه في رحلة مدرسية إلى جزيرة أرواد. كان معلّمهم قد نظّم الرحلة مع شركة سياحية قبل أسبوعين، وكانت الشركة قد أكّدت المواعيد والسعر. في صباح يوم الرحلة التقى الطلاب في المدرسة في الساعة السادسة. سافروا بالحافلة إلى طرطوس، واستغرقت الرحلة نحو ثلاث ساعات. وبينما كانوا يسيرون على طول الساحل غنّوا الأغاني ولعبوا الألعاب. وعند وصولهم إلى طرطوس ركبوا عبّارة صغيرة إلى الجزيرة. كانت تلك أول مرة يركب فيها عمر قارباً، فشعر بقليل من الخوف، لكن البحر كان هادئاً. وعلى الجزيرة رافقهم مرشد، فأراهم القلعة القديمة وحدّثهم عن تاريخ الجزيرة. بعد ذلك تناولوا السمك المشوي في مطعم صغير قرب البحر. وفي فترة ما بعد الظهر زار الطلاب السوق القديمة واشتروا تذكارات لعائلاتهم. وفي المساء عادوا إلى البيت متعبين لكن سعداء. أخبر عمر والديه أنه كان أفضل يوم في السنة، وقال إنه لن ينساه أبداً.',
        ],
      },
      questions: [
        { n: 6, kind: 'truefalse', prompt: 'The teacher organized the trip on the same day.', promptAr: 'نظّم المعلّم الرحلة في اليوم نفسه.', answer: false, explainAr: 'النص: "Their teacher had organized the journey with a tourist company two weeks before" — نظّمها قبل أسبوعين.' },
        { n: 7, kind: 'truefalse', prompt: 'The students travelled to Tartous by train.', promptAr: 'سافر الطلاب إلى طرطوس بالقطار.', answer: false, explainAr: 'النص: "They travelled by bus to Tartous" — سافروا بالحافلة لا بالقطار.' },
        { n: 8, kind: 'truefalse', prompt: 'Omar was on a boat for the first time.', promptAr: 'ركب عمر قارباً لأول مرة.', answer: true, explainAr: 'النص: "It was Omar\'s first time on a boat".' },
        { n: 9, kind: 'truefalse', prompt: 'The students bought souvenirs in the old market.', promptAr: 'اشترى الطلاب تذكارات من السوق القديمة.', answer: true, explainAr: 'النص: "the students visited the old market and bought souvenirs for their families".' },
        { n: 10, kind: 'truefalse', prompt: "Omar didn't enjoy the trip.", promptAr: 'لم يستمتع عمر بالرحلة.', answer: false, explainAr: 'النص: عادوا "tired but happy"، وقال عمر إنه كان "the best day of the year" وإنه لن ينساه أبداً.' },
      ],
    },
    {
      letter: 'C',
      title: 'Read the sentences then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ الجمل ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 200,
      questions: [
        { n: 11, kind: 'mcq', topic: 'tense', prompt: 'My mother ___ dinner at the moment.', promptAr: 'أمي ___ العشاء في هذه اللحظة.', options: ['cooks', 'is cooking', 'cooked', 'was cooking'], answer: 1, explainAr: 'at the moment تدلّ على حدث يجري الآن، فنستخدم المضارع المستمر: is cooking.' },
        { n: 12, kind: 'mcq', topic: 'tense', prompt: 'The sun ___ in the east.', promptAr: 'الشمس ___ من الشرق.', options: ['rises', 'is rising', 'rise', 'rose'], answer: 0, explainAr: 'حقيقة ثابتة فنستخدم المضارع البسيط، ومع The sun (مفرد) نضيف s: rises.' },
        { n: 13, kind: 'mcq', topic: 'tense', prompt: '"The phone is ringing." "OK, I ___ it."', promptAr: '"الهاتف يرنّ." "حسناً، ___ عليه."', options: ['answer', 'will answer', 'am going to answer', 'answered'], answer: 1, explainAr: 'قرار نتّخذه في لحظة الكلام (لم نخطّط له من قبل)، فنستخدم will: will answer.' },
        { n: 14, kind: 'mcq', topic: 'tense', prompt: 'Bayan ___ to Damascus two years ago.', promptAr: 'بيان ___ إلى دمشق قبل سنتين.', options: ['moves', 'moved', 'has moved', 'is moving'], answer: 1, explainAr: 'two years ago تدلّ على حدث انتهى في الماضي، فنستخدم الماضي البسيط: moved.' },
        { n: 15, kind: 'mcq', topic: 'tense', prompt: 'At eight o\'clock last night, we ___ TV.', promptAr: 'في الساعة الثامنة من مساء أمس ___ التلفاز.', options: ['watch', 'are watching', 'were watching', 'have watched'], answer: 2, explainAr: 'حدث كان مستمراً في لحظة معيّنة من الماضي (at eight o\'clock last night)، فنستخدم الماضي المستمر: were watching.' },
        { n: 16, kind: 'mcq', topic: 'tense', prompt: 'Mouayyad ___ to France twice.', promptAr: 'مؤيّد ___ إلى فرنسا مرتين.', options: ['has been', 'have been', 'is going', 'was being'], answer: 0, explainAr: 'المضارع التام للتجارب حتى الآن (twice): has + التصريف الثالث، ومع المفرد نستخدم has: has been.' },
        { n: 17, kind: 'mcq', topic: 'reported', prompt: '"I can swim very well." Basel said that ___.', promptAr: '"أستطيع أن أسبح جيداً جداً." قال باسل إنه ___.', options: ['I can swim very well', 'he could swim very well', 'he can swam very well', 'he could swam very well'], answer: 1, explainAr: 'في الكلام المنقول: I ← he، و can ← could، ويبقى الفعل بعد could مجرّداً: he could swim.' },
        { n: 18, kind: 'mcq', topic: 'reported', prompt: '"We are waiting for the bus now." They said that ___.', promptAr: '"نحن ننتظر الحافلة الآن." قالوا إنهم ___.', options: ['they are waiting for the bus now', 'they were waiting for the bus then', 'they waited for the bus now', 'they had waited for the bus then'], answer: 1, explainAr: 'في الكلام المنقول: we ← they، والمضارع المستمر are waiting ← الماضي المستمر were waiting، و now ← then.' },
        { n: 19, kind: 'mcq', topic: 'tense', prompt: 'Lamar was hungry because she ___ breakfast.', promptAr: 'كانت لمار جائعة لأنها ___ الفطور.', options: ["hadn't had", "doesn't have", "hasn't had", "won't have"], answer: 0, explainAr: 'عدم تناول الفطور حدث قبل أن تجوع في الماضي، فنستخدم الماضي التام المنفي: hadn\'t + التصريف الثالث: hadn\'t had.' },
        { n: 20, kind: 'mcq', topic: 'conditional', prompt: 'If Rami ___ harder, he would get better marks.', promptAr: 'لو ___ رامي بجدّ أكبر لحصل على علامات أفضل.', options: ['studies', 'studied', 'will study', 'would study'], answer: 1, explainAr: 'الشرط الثاني: If + الماضي البسيط، ثم would + الفعل. لذلك: If Rami studied.' },
        { n: 21, kind: 'mcq', topic: 'conditional', prompt: 'What ___ you do if you saw a bully at school?', promptAr: 'ماذا ___ لو رأيت متنمّراً في المدرسة؟', options: ['will', 'would', 'did', 'do'], answer: 1, explainAr: 'سؤال الشرط الثاني: What would you do if + ماضٍ بسيط (saw)؟ فنستخدم would.' },
        { n: 22, kind: 'mcq', topic: 'grammar', prompt: '___ is this souvenir? — It\'s 500 pounds.', promptAr: '___ هذا التذكار؟ — إنه بـ 500 ليرة.', options: ['How many', 'How much', 'What', 'Which'], answer: 1, explainAr: 'نسأل عن السعر بـ How much. أما How many فنستخدمها للعدد مع الأسماء المعدودة بالجمع.' },
        { n: 23, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has silent "gh" is:', promptAr: 'الكلمة التي فيها "gh" صامتة هي:', options: ['enough', 'straight', 'ghost', 'laugh'], answer: 1, explainAr: 'في straight لا تُلفظ gh. أما في enough و laugh فتُلفظ gh مثل f، وفي ghost يُلفظ g.' },
        { n: 24, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that doesn\'t have /k/ sound is:', promptAr: 'الكلمة التي لا تحتوي على الصوت /k/ هي:', options: ['cake', 'duck', 'cinema', 'cloud'], answer: 2, explainAr: 'في cinema يأتي بعد c الحرف i فيُلفظ /s/. أما cake و cloud ففيها c = /k/، و duck فيها ck = /k/.' },
        { n: 25, kind: 'mcq', topic: 'pronunciation', prompt: 'The word "should" has ___ sound.', promptAr: 'كلمة "should" فيها الصوت ___.', options: ['/u:/', '/u/', '"l"', 'both a and b'], answer: 1, explainAr: 'should تُلفظ /ʃʊd/ بالصوت القصير /u/، والحرف l فيها صامت.' },
        { n: 26, kind: 'mcq', topic: 'wordform', prompt: 'The goalkeeper played ___ in the final match.', promptAr: 'لعب حارس المرمى ___ في المباراة النهائية.', options: ['brilliant', 'brilliantly', 'brilliance', 'more brilliant'], answer: 1, explainAr: 'نحتاج ظرفاً يصف الفعل played (كيف لعب؟)، والظرف يُصاغ بإضافة -ly إلى الصفة: brilliantly.' },
        { n: 27, kind: 'mcq', topic: 'vocab', prompt: 'The place you are travelling to:', promptAr: 'المكان الذي تسافر إليه:', options: ['destination', 'arrival', 'journey', 'passport'], answer: 0, explainAr: 'destination = وجهة السفر، المكان الذي نسافر إليه (كلمة من الوحدة الثالثة).' },
        { n: 28, kind: 'mcq', topic: 'vocab', prompt: 'To say that you will not do something:', promptAr: 'أن تقول إنك لن تفعل شيئاً ما:', options: ['accept', 'refuse', 'confirm', 'allow'], answer: 1, explainAr: 'refuse = يرفض، أي يقول إنه لن يفعل الشيء (كلمة من الوحدة الثانية).' },
        { n: 29, kind: 'mcq', topic: 'vocab', prompt: 'A person who buys goods or services is called ___.', promptAr: 'الشخص الذي يشتري البضائع أو الخدمات يسمّى ___.', options: ['founder', 'expert', 'customer', 'supervisor'], answer: 2, explainAr: 'customer = زبون، الشخص الذي يشتري البضائع أو الخدمات (كلمة من الوحدة السادسة).' },
        { n: 30, kind: 'mcq', topic: 'vocab', prompt: 'Very important:', promptAr: 'مهمّ جداً:', options: ['flexible', 'humble', 'major', 'cheap'], answer: 2, explainAr: 'major = رئيسي / كبير الأهمية، أي مهمّ جداً (كلمة من الوحدة الأولى).' },
      ],
    },
    {
      letter: 'D',
      title: 'Ask about the underline word(s):',
      titleAr: 'اسأل عن الكلمة (الكلمات) التي تحتها خط:',
      marks: 40,
      questions: [
        { n: 31, kind: 'ask', prompt: 'Lamar stayed at home {because she was ill}.', promptAr: 'بقيت لمار في البيت لأنها كانت مريضة.', options: ['Why Lamar stayed at home?', 'When did Lamar stay at home?', 'Why did Lamar stay at home?', 'Why did Lamar stayed at home?'], answer: 2, explainAr: 'نسأل عن السبب (because) بـ Why، والجملة في الماضي فنستخدم did + الفاعل + الفعل المجرّد: Why did Lamar stay at home?' },
        { n: 32, kind: 'ask', prompt: '{Yes, I have been to Palmyra.}', promptAr: 'نعم، لقد زرت تدمر.', options: ['Have you been to Palmyra?', 'Did you have been to Palmyra?', 'Where have you been?', 'Has you been to Palmyra?'], answer: 0, explainAr: 'الجواب يبدأ بـ Yes فهو جواب سؤال بنعم/لا. الفعل مضارع تام (have been) فنقدّم have على الفاعل you: Have you been to Palmyra?' },
        { n: 33, kind: 'ask', prompt: 'The children are playing {in the garden}.', promptAr: 'الأطفال يلعبون في الحديقة.', options: ['Where the children are playing?', 'Where are the children playing?', 'What are the children playing?', 'Where do the children playing?'], answer: 1, explainAr: 'نسأل عن المكان بـ Where، والفعل مضارع مستمر فنقدّم are على الفاعل: Where are the children playing?' },
        { n: 34, kind: 'ask', prompt: '{Mr. Kamal} teaches us English.', promptAr: 'الأستاذ كمال يدرّسنا الإنجليزية.', options: ['Who does teach you English?', 'What teaches you English?', 'Who do you teach English?', 'Who teaches you English?'], answer: 3, explainAr: 'نسأل عن الفاعل (شخص) بـ Who، وعندما تكون Who هي الفاعل لا نستخدم does ويبقى الفعل مع s: Who teaches you English?' },
      ],
    },
    {
      letter: 'E',
      title: 'Choose the wrong part in each phrase:',
      titleAr: 'اختر الجزء الخاطئ في كل جملة:',
      marks: 20,
      questions: [
        { n: 35, kind: 'wrongpart', prompt: 'Basel {told} me that he {will} {visit} his relatives {the following day}.', promptAr: 'أخبرني باسل أنه سيزور أقاربه في اليوم التالي.', answer: 1, explainAr: 'في الكلام المنقول بعد told يتغيّر will إلى would: will ← would.' },
        { n: 36, kind: 'wrongpart', prompt: 'If Layan {were} here, she {would} {helps} {us}.', promptAr: 'لو كانت ليان هنا لساعدتنا.', answer: 2, explainAr: 'بعد would يأتي الفعل في صيغته المجرّدة دون s: helps ← help.' },
        { n: 37, kind: 'wrongpart', prompt: '{Was} the tourists {tired} {after} the long {journey}?', promptAr: 'هل كان السيّاح متعبين بعد الرحلة الطويلة؟', answer: 0, explainAr: 'the tourists جمع، فنستخدم were لا was في الماضي: Was ← Were.' },
        { n: 38, kind: 'wrongpart', prompt: 'The students {were} {writing} {when} the bell {ring}.', promptAr: 'كان الطلاب يكتبون عندما رنّ الجرس.', answer: 3, explainAr: 'الحدث القصير الذي قطع الحدث الطويل (were writing) يكون بالماضي البسيط: ring ← rang.' },
      ],
    },
    {
      letter: 'F',
      title: 'Write a 50-word paragraph about the following topic:',
      titleAr: 'اكتب فقرة من 50 كلمة عن الموضوع التالي:',
      marks: 40,
      writing: {
        topic: 'A place in Syria you would like to visit',
        topicAr: 'مكان في سوريا تحبّ أن تزوره',
        words: 50,
        model: 'I would really like to visit Palmyra in the middle of Syria. It is located in the desert and it has many ancient monuments. I have seen pictures of its magnificent columns and the old castle on the hill. If I went there, I would take a lot of photos and learn about its history. I would also buy some souvenirs for my family. It would be an unforgettable adventure.',
        modelAr: 'أودّ حقاً أن أزور تدمر في وسط سوريا. تقع تدمر في الصحراء وفيها كثير من المعالم الأثرية القديمة. لقد رأيت صوراً لأعمدتها الرائعة وللقلعة القديمة على التلّ. لو ذهبت إلى هناك لالتقطت كثيراً من الصور وتعلّمت عن تاريخها. وكنت سأشتري أيضاً بعض التذكارات لعائلتي. ستكون مغامرة لا تُنسى.',
        checklistAr: [
          'كتبت عن الموضوع المطلوب نفسه (مكان في سوريا تحبّ أن تزوره) وذكرت أين يقع.',
          'استخدمت الشرط الثاني (If I went ..., I would ...) و would بشكل صحيح.',
          'استخدمت كلمات من الوحدة الرابعة مثل located, magnificent, monument, unforgettable.',
          'راعيت الإملاء وعلامات الترقيم والحروف الكبيرة.',
        ],
      },
    },
  ],
}
