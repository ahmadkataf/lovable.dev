import type { Exam } from '../../../engine/types'

// A past Term 1 paper, typed in exactly as printed (Grade 8, Test A, 60 minutes, 400 marks).
export const term1A: Exam = {
  id: 't1-a',
  term: 1,
  title: 'Term 1 — Test (A)',
  titleAr: 'الفصل الأول — النموذج (A)',
  minutes: 60,
  totalMarks: 400,
  real: true,
  sourceAr: 'نموذج امتحان سابق للفصل الأول كما طُبع، مع الحلّ وشرح كل إجابة.',
  sections: [
    {
      letter: 'A',
      title: 'Read the following text then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ النص التالي ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 50,
      passage: {
        paragraphs: [
          "Schools are good places for socializing, but everyone worries about things that happen at school from time to time. No single person passed through school without experiencing some problems or events. The stresses of school life that we are exposed to make us sometimes feel unhappy, depressed, out of control and have low self-esteem. We may feel less motivated in our classrooms or careless about doing homework so that our marks may become low and we don't get good results. Sometimes we find it hard to get up and get ready for school. Some people may hesitate to go to school, or even refuse to go at all. School problems we may worry about are, for example, finding school work difficult, having problems in classrooms especially if others are noisy, not getting on with teachers, problems at home, and bullies {who} often cause complicated problems, etc. In this situation, the most important thing is to recognize that there's a problem to be solved and ask for help as soon as possible.",
        ],
        paragraphsAr: [
          'المدارس أماكن جيدة للتواصل الاجتماعي، لكن الجميع يقلقون بين حين وآخر من أشياء تحدث في المدرسة. لم يمرّ أحد بالمدرسة دون أن يواجه بعض المشكلات أو الأحداث. إن ضغوط الحياة المدرسية التي نتعرّض لها تجعلنا أحياناً نشعر بالتعاسة والاكتئاب وفقدان السيطرة وضعف الثقة بالنفس. قد نشعر بحماس أقل في صفوفنا أو بعدم الاهتمام بأداء الواجبات، فتنخفض علاماتنا ولا نحصل على نتائج جيدة. أحياناً يصعب علينا الاستيقاظ والاستعداد للمدرسة. وقد يتردّد بعض الناس في الذهاب إلى المدرسة، بل قد يرفضون الذهاب نهائياً. ومن المشكلات المدرسية التي قد تقلقنا مثلاً: صعوبة العمل المدرسي، والمشكلات داخل الصف خاصة إذا كان الآخرون مزعجين، وعدم التفاهم مع المعلمين، والمشكلات في البيت، والمتنمّرون الذين يسبّبون غالباً مشكلات معقّدة، وغير ذلك. في هذه الحالة، أهم شيء هو أن ندرك أن هناك مشكلة يجب حلّها وأن نطلب المساعدة في أقرب وقت ممكن.',
        ],
      },
      questions: [
        { n: 1, kind: 'mcq', prompt: 'Schools are a great place for ___.', promptAr: 'المدارس مكان رائع لـ ___.', options: ['making friends', 'worries', 'everyone', 'wasting time'], answer: 0, explainAr: 'النص يبدأ بـ "Schools are good places for socializing"، والتواصل الاجتماعي يعني تكوين الصداقات (making friends).' },
        { n: 2, kind: 'mcq', prompt: 'The stresses of school life ___.', promptAr: 'ضغوط الحياة المدرسية ___.', options: ['always make us unhappy and depressed', 'sometimes make us depressed, unhappy and have low self-esteem', 'are exposed to make us sometimes less motivated', 'sometimes make us bullies'], answer: 1, explainAr: 'النص: "The stresses of school life ... make us sometimes feel unhappy, depressed ... and have low self-esteem". الخيار «always make us unhappy and depressed» خاطئ لأن النص يقول sometimes لا always.' },
        { n: 3, kind: 'mcq', prompt: 'What does "who" in the 20th line refer to?', promptAr: 'إلامَ تعود كلمة "who" في السطر العشرين؟', options: ['home', 'bullies', 'teachers', 'problems'], answer: 1, explainAr: 'الجملة: "bullies who often cause complicated problems"، فكلمة who تعود على bullies (المتنمّرون).' },
        { n: 4, kind: 'mcq', prompt: '"Motivated" is the opposite of:', promptAr: 'كلمة "Motivated" (متحمّس) عكسها:', options: ['unhappy', 'recognized', 'depressed', 'exposed'], answer: 2, explainAr: 'motivated تعني متحمّس ولديه دافع، وأقرب عكس لها بين الخيارات depressed (محبَط يفتقد الحماس والطاقة).' },
        { n: 5, kind: 'mcq', prompt: '"Hesitate" means ___.', promptAr: 'كلمة "Hesitate" تعني ___.', options: ['unable to make a decision', 'good results', 'complicate', 'depressed'], answer: 0, explainAr: 'hesitate = يتردّد، أي لا يستطيع أن يقرّر بسرعة (unable to make a decision).' },
      ],
    },
    {
      letter: 'B',
      title: 'Read the following text then write if the sentences are True or False:',
      titleAr: 'اقرأ النص التالي ثم اكتب إن كانت الجمل صحيحة أم خاطئة:',
      marks: 50,
      passage: {
        paragraphs: [
          "People bully by many ways like name-calling, saying or writing unpleasant things about other people, keeping them apart from activities on purpose to harm them and hurt their feelings, leaving them alone and not talking to them to do something they really don't want to do. Hitting, kicking, knocking things out of their hands, pushing, etc. are also bullying. In fact some bullies don't even know that they're bullying or how the person they bully actually feels. People bully for many reasons. Some of these reasons are because they may feel it makes them popular, or they think it's not just for an entertainment. Sometimes people bully because that's the only way they can be the center of attention or because they are jealous of the person they're bullying. Therefore, we need to be strong and self-confident. We should always keep in mind, if we don't have anything nice to say to someone, it's better to keep silent. And remember the golden rule: \"Treat others the way you would want them to treat you\".",
        ],
        paragraphsAr: [
          'يتنمّر الناس بطرق كثيرة مثل الشتم بالألقاب، وقول أو كتابة أشياء مسيئة عن الآخرين، وإبعادهم عن الأنشطة عمداً لإيذائهم وجرح مشاعرهم، وتركهم وحدهم وعدم التحدث معهم لدفعهم إلى فعل شيء لا يريدونه حقاً. والضرب والركل وإسقاط الأشياء من أيديهم والدفع وغيرها هي أيضاً تنمّر. في الحقيقة، بعض المتنمّرين لا يعرفون حتى أنهم يتنمّرون ولا كيف يشعر الشخص الذي يتنمّرون عليه. يتنمّر الناس لأسباب كثيرة، منها أنهم قد يشعرون أن ذلك يجعلهم مشهورين، أو يظنّون أنه ليس مجرّد تسلية. وأحياناً يتنمّر الناس لأنها الطريقة الوحيدة ليكونوا محطّ الاهتمام، أو لأنهم يغارون من الشخص الذي يتنمّرون عليه. لذلك علينا أن نكون أقوياء وواثقين بأنفسنا. ويجب أن نتذكّر دائماً: إن لم يكن لدينا شيء لطيف نقوله لأحد، فمن الأفضل أن نصمت. وتذكّر القاعدة الذهبية: "عامِل الآخرين كما تحبّ أن يعاملوك".',
        ],
      },
      questions: [
        { n: 6, kind: 'truefalse', prompt: 'People bully for one reason.', promptAr: 'يتنمّر الناس لسبب واحد.', answer: false, explainAr: 'النص يقول "People bully for many reasons" — لأسباب كثيرة، لا لسبب واحد.' },
        { n: 7, kind: 'truefalse', prompt: 'There are many kinds of bullying.', promptAr: 'هناك أنواع كثيرة من التنمّر.', answer: true, explainAr: 'النص يعدّد أنواعاً كثيرة: الشتم بالألقاب، الكتابة المسيئة، الإبعاد عن الأنشطة، الضرب، الركل، الدفع.' },
        { n: 8, kind: 'truefalse', prompt: 'Bullies always know what they do.', promptAr: 'المتنمّرون يعرفون دائماً ما يفعلون.', answer: false, explainAr: 'النص: "some bullies don\'t even know that they\'re bullying" — بعضهم لا يعرف أنه يتنمّر.' },
        { n: 9, kind: 'truefalse', prompt: 'Bullying makes us feel popular and famous.', promptAr: 'التنمّر يجعلنا نشعر بالشهرة والشعبية.', answer: false, explainAr: 'النص يقول إن المتنمّرين قد "يشعرون" أن التنمّر يجعلهم مشهورين، لا أنه يجعلنا كذلك فعلاً.' },
        { n: 10, kind: 'truefalse', prompt: 'We should either speak well or not.', promptAr: 'يجب أن نتكلّم بلطف أو لا نتكلّم.', answer: true, explainAr: 'النص: "if we don\'t have anything nice to say to someone, it\'s better to keep silent".' },
      ],
    },
    {
      letter: 'C',
      title: 'Read the sentences then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ الجمل ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 200,
      questions: [
        { n: 11, kind: 'mcq', prompt: 'Lamar ___ science now.', promptAr: 'لمار ___ العلوم الآن.', options: ['likes', 'is liking', 'studies', 'is studying'], answer: 3, explainAr: 'now تدلّ على حدث يجري الآن فنستخدم المضارع المستمر: is studying. (like لا يأتي عادة بصيغة -ing).' },
        { n: 12, kind: 'mcq', prompt: 'We ___ our vacation in Lebanon next summer.', promptAr: 'نحن ___ عطلتنا في لبنان الصيف القادم.', options: ['will spend', 'are going to spend', 'are spending', 'spend'], answer: 1, explainAr: 'خطة قرّرناها مسبقاً للمستقبل (next summer) فنستخدم be going to: are going to spend.' },
        { n: 13, kind: 'mcq', prompt: 'Mouayyad and Mulham are coming. I ___ something for them to eat.', promptAr: 'مؤيّد وملهم قادمان. ___ شيئاً ليأكلاه.', options: ['make', 'will make', 'am making', 'am going to make'], answer: 1, explainAr: 'قرار نتخذه في لحظة الكلام (عرفنا الآن أنهما قادمان) فنستخدم will: will make.' },
        { n: 14, kind: 'mcq', prompt: "Layan won't forget what happened before she ___ to live here.", promptAr: 'لن تنسى ليان ما حدث قبل أن ___ لتعيش هنا.', options: ['come', 'is coming', 'came', 'will come'], answer: 2, explainAr: 'الحدث في الماضي (ما حدث قبل مجيئها) فنستخدم الماضي البسيط: came.' },
        { n: 15, kind: 'mcq', prompt: 'Basel ___ when the telephone rang.', promptAr: 'كان باسل ___ عندما رنّ الهاتف.', options: ['was sleeping', 'sleeps', 'slept', 'is sleeping'], answer: 0, explainAr: 'حدث طويل كان مستمراً (الماضي المستمر) قطعه حدث قصير (الماضي البسيط rang): was sleeping.' },
        { n: 16, kind: 'mcq', prompt: 'The weather ___ terrible at the weekend.', promptAr: 'الطقس ___ سيئاً في عطلة نهاية الأسبوع.', options: ['is', 'had', 'was', 'did'], answer: 2, explainAr: 'نتحدّث عن عطلة نهاية أسبوع مضت، ومع الصفة terrible نحتاج فعل الكون في الماضي: was.' },
        { n: 17, kind: 'mcq', prompt: '"I\'m studying English now". Bayan said that ___.', promptAr: '"أنا أدرس الإنجليزية الآن". قالت بيان إنها ___.', options: ['she studies for English now', 'she was studying English then', 'she had studied English then', 'she had studied English now'], answer: 1, explainAr: 'في الكلام المنقول: I → she، am studying → was studying، now → then.' },
        { n: 18, kind: 'mcq', prompt: '"I often have a big dinner". Basel said ___.', promptAr: '"أنا غالباً أتناول عشاءً كبيراً". قال باسل ___.', options: ['he often has a big dinner', 'she often had a big dinner', 'he often had a big dinner', 'he was having a big dinner'], answer: 2, explainAr: 'في الكلام المنقول: I → he (باسل مذكّر)، والمضارع البسيط have → الماضي البسيط had.' },
        { n: 19, kind: 'mcq', prompt: 'These days I ___ a lot of coffee.', promptAr: 'في هذه الأيام ___ الكثير من القهوة.', options: ['am drinking', 'was drinking', 'drink', 'am'], answer: 0, explainAr: 'These days تدلّ على وضع مؤقت يحدث في هذه الفترة، فنستخدم المضارع المستمر: am drinking.' },
        { n: 20, kind: 'mcq', prompt: 'Water ___ at 100 degrees.', promptAr: 'الماء ___ عند 100 درجة.', options: ['boil', 'is boiling', 'boils', 'boiled'], answer: 2, explainAr: 'حقيقة علمية ثابتة فنستخدم المضارع البسيط، ومع Water (مفرد) نضيف s: boils.' },
        { n: 21, kind: 'mcq', prompt: "The word that doesn't have /u:/ sound is:", promptAr: 'الكلمة التي لا تحتوي على الصوت /u:/ هي:', options: ['cool', 'took', 'fool', 'goose'], answer: 1, explainAr: 'took تُلفظ بالصوت القصير /u/، أما cool و fool و goose فبالصوت الطويل /u:/.' },
        { n: 22, kind: 'mcq', prompt: 'The word that has silent "gh" is:', promptAr: 'الكلمة التي فيها "gh" صامتة هي:', options: ['ghost', 'daughter', 'tough', 'both a and c'], answer: 1, explainAr: 'في daughter لا تُلفظ gh. في ghost يُلفظ g، وفي tough تُلفظ gh مثل f.' },
        { n: 23, kind: 'mcq', prompt: 'The word "could" has ___ sound.', promptAr: 'كلمة "could" فيها الصوت ___.', options: ['"k"', '/u:/', '/u/', 'both a and c'], answer: 3, explainAr: 'could تُلفظ /kʊd/: فيها صوت k وصوت /u/ القصير (وحرف l صامت).' },
        { n: 24, kind: 'mcq', prompt: 'Ali ___ his teeth twice a day.', promptAr: 'علي ___ أسنانه مرتين في اليوم.', options: ['brush', 'brushed', 'is brushing', 'brushes'], answer: 3, explainAr: 'عادة متكرّرة (twice a day) فنستخدم المضارع البسيط، ومع he نضيف es: brushes.' },
        { n: 25, kind: 'mcq', prompt: 'If there were no internet, life ___.', promptAr: 'لو لم يكن هناك إنترنت، لـ ___ الحياة.', options: ['will be boring', 'would be bored', 'would be boring', 'will be bored'], answer: 2, explainAr: 'الشرطية الثانية: If + ماضٍ (were) ثم would + فعل. والحياة "مملّة" (boring) لا "تشعر بالملل" (bored).' },
        { n: 26, kind: 'mcq', prompt: 'The children quickly got ___ with staying indoors.', promptAr: 'سرعان ما ___ الأطفال من البقاء في المنزل.', options: ['bores', 'bored', 'boring', 'boredom'], answer: 1, explainAr: 'الأطفال يشعرون بالملل، فنستخدم الصفة المنتهية بـ -ed: got bored.' },
        { n: 27, kind: 'mcq', prompt: 'A nearby area of a town or city:', promptAr: 'منطقة قريبة من بلدة أو مدينة:', options: ['fortress', 'citadel', 'neighborhood', 'ski'], answer: 2, explainAr: 'neighborhood = الحيّ، المنطقة المجاورة من المدينة.' },
        { n: 28, kind: 'mcq', prompt: 'Not very great in amount:', promptAr: 'ليس كبيراً في الكمية:', options: ['vary', 'limited', 'process', 'concept'], answer: 1, explainAr: 'limited = محدود، أي قليل وليس كبيراً في الكمية.' },
        { n: 29, kind: 'mcq', prompt: 'Communication or dealing with other people is called ___.', promptAr: 'التواصل أو التعامل مع الآخرين يسمّى ___.', options: ['amusement', 'interaction', 'arrival', 'confirmation'], answer: 1, explainAr: 'interaction = التفاعل مع الآخرين والتواصل معهم (كلمة من الوحدة الثالثة).' },
        { n: 30, kind: 'mcq', prompt: 'The feeling of fun and pleasure is known as ___.', promptAr: 'الشعور بالمرح والمتعة يُعرف بـ ___.', options: ['confirmation', 'amusement', 'souvenir', 'interaction'], answer: 1, explainAr: 'amusement = التسلية والمتعة (كلمة من الوحدة الثالثة).' },
      ],
    },
    {
      letter: 'D',
      title: 'Ask about the underline word(s):',
      titleAr: 'اسأل عن الكلمة (الكلمات) التي تحتها خط:',
      marks: 40,
      questions: [
        { n: 31, kind: 'ask', prompt: '{Kindergarten} is a school for little children.', promptAr: 'روضة الأطفال هي مدرسة للأطفال الصغار.', options: ['What is a school for little children?', 'Who is a school for little children?', 'Where is a school for little children?', 'What a school is for little children?'], answer: 0, explainAr: 'نسأل عن اسم شيء (Kindergarten) فنستخدم What، ونضع الفعل is قبل الفاعل.' },
        { n: 32, kind: 'ask', prompt: 'I can see {three cats under the tree}.', promptAr: 'أستطيع أن أرى ثلاث قطط تحت الشجرة.', options: ['How many cats can you see?', 'What can you see?', 'Where can you see three cats?', 'What you can see?'], answer: 1, explainAr: 'الجزء المسطّر هو كل ما نراه، فنسأل عنه بـ What، ونقدّم can على الفاعل: What can you see?' },
        { n: 33, kind: 'ask', prompt: "{No, we didn't go home.}", promptAr: 'لا، لم نذهب إلى البيت.', options: ['Where did you go?', 'Did you go home?', "Didn't you went home?", 'Do you go home?'], answer: 1, explainAr: 'الجواب يبدأ بـ No فهو جواب سؤال بـ نعم/لا. الفعل في الماضي (didn\'t go) فنسأل بـ Did + الفعل المجرد.' },
        { n: 34, kind: 'ask', prompt: 'Mouayyad {broke the table}.', promptAr: 'كسر مؤيّد الطاولة.', options: ['Who broke the table?', 'What did Mouayyad break?', 'What did Mouayyad do?', 'What Mouayyad did?'], answer: 2, explainAr: 'المسطّر هو الفعل وما بعده (ما فعله مؤيّد)، فنسأل: What did Mouayyad do?' },
      ],
    },
    {
      letter: 'E',
      title: 'Choose the wrong part in each phrase:',
      titleAr: 'اختر الجزء الخاطئ في كل جملة:',
      marks: 20,
      questions: [
        { n: 35, kind: 'wrongpart', prompt: 'Huda {told} {hers} mother that {she} {felt} ill.', promptAr: 'أخبرت هدى أمها أنها شعرت بالمرض.', answer: 1, explainAr: 'قبل الاسم (mother) نستخدم صفة الملكية her لا ضمير الملكية hers: her mother.' },
        { n: 36, kind: 'wrongpart', prompt: 'Peter {said} that he {speaks} {Chinese} {and} English.', promptAr: 'قال بيتر إنه يتكلّم الصينية والإنجليزية.', answer: 1, explainAr: 'في الكلام المنقول بعد said يرجع الفعل خطوة إلى الماضي: speaks ← spoke.' },
        { n: 37, kind: 'wrongpart', prompt: '{Our} teacher {comes} in {while} we {were} shouting.', promptAr: 'دخل معلّمنا بينما كنّا نصرخ.', answer: 1, explainAr: 'الجملة في الماضي (we were shouting)، فالحدث القصير يكون ماضياً بسيطاً: comes ← came.' },
        { n: 38, kind: 'wrongpart', prompt: '{Our} new school {makes} {many} {desks} now.', promptAr: 'مدرستنا الجديدة تصنع الكثير من المقاعد الآن.', answer: 1, explainAr: 'now تدلّ على حدث يجري الآن، فنستخدم المضارع المستمر: makes ← is making.' },
      ],
    },
    {
      letter: 'F',
      title: 'Write a 50-word paragraph about the following topic:',
      titleAr: 'اكتب فقرة من 50 كلمة عن الموضوع التالي:',
      marks: 40,
      writing: {
        topic: 'A journey you had',
        topicAr: 'رحلة قمت بها',
        words: 50,
        model: 'Last summer, I went on an amazing journey to Latakia with my family. First, we travelled by bus and the trip took four hours. Then we stayed in a small hotel near the sea. While we were swimming, my father was taking photos. We also visited some old places and bought nice souvenirs for our friends. It was a wonderful trip and I will never forget it.',
        modelAr: 'في الصيف الماضي ذهبت في رحلة رائعة إلى اللاذقية مع عائلتي. في البداية سافرنا بالحافلة واستغرقت الرحلة أربع ساعات. ثم أقمنا في فندق صغير قرب البحر. وبينما كنّا نسبح، كان أبي يلتقط الصور. وزرنا أيضاً بعض الأماكن القديمة واشترينا تذكارات جميلة لأصدقائنا. كانت رحلة رائعة ولن أنساها أبداً.',
        checklistAr: [
          'كتبت عن الموضوع المطلوب نفسه (رحلة قمت بها).',
          'استخدمت الماضي البسيط والماضي المستمر بشكل صحيح.',
          'رتّبت الأحداث بكلمات ربط مثل First, Then, While, Finally.',
          'راعيت الإملاء وعلامات الترقيم والحروف الكبيرة.',
        ],
      },
    },
  ],
}
