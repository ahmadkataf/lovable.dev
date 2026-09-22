import type { Exam } from '../../../engine/types'

// Practice paper in the exact format of the real Term 1 final exam (Grade 8, 60 minutes, 400 marks).
export const term1E: Exam = {
  id: 't1-e',
  term: 1,
  title: 'Term 1 — Test (E)',
  titleAr: 'الفصل الأول — النموذج (E)',
  minutes: 60,
  totalMarks: 400,
  sourceAr: 'نموذج تدريبي على نمط الامتحان النهائي يغطّي الوحدات 1–6: القراءة من الوحدتين 1 و5، والكتابة من الوحدة 2، والقواعد والأصوات من الفصل الأول كاملاً.',
  sections: [
    {
      letter: 'A',
      title: 'Read the following text then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ النص التالي ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 50,
      passage: {
        paragraphs: [
          "My grandfather often tells me about his school days. Sixty years ago, his school was a small building with one blackboard and some old desks. Teachers used traditional methods, and students had to learn everything from books. There were no computers, so pupils relied on their teachers for all their knowledge. Nowadays, things are very different. Modern technology is playing a major role in education. In my school, we are using laptops, tablets and the Internet in most of our lessons. Our science teacher often takes us to the laboratory, where we do practical experiments instead of just reading about them. Last month, we visited an ancient city through virtual reality without leaving our classroom! Educators believe that schools will continue to change. In the future, lessons will be more flexible, and each student will learn in a personalized format that suits his or her interests. Some people think robotic teachers will help human teachers, and flying vehicles may take students to school. However, I don't think computers will ever replace good teachers completely. A computer can provide information, but a teacher {who} really cares about students can make them love learning. I believe the best school of the future will combine modern innovations with kind and effective teachers.",
        ],
        paragraphsAr: [
          'كثيراً ما يحدّثني جدّي عن أيام دراسته. قبل ستين عاماً كانت مدرسته بناءً صغيراً فيه سبّورة واحدة وبعض المقاعد القديمة. كان المعلمون يستخدمون الطرق التقليدية، وكان على الطلاب أن يتعلّموا كل شيء من الكتب. لم تكن هناك حواسيب، لذلك كان التلاميذ يعتمدون على معلّميهم في كل معارفهم. أما اليوم فالأمور مختلفة جداً. تؤدّي التكنولوجيا الحديثة دوراً كبيراً في التعليم. في مدرستي نستخدم الحواسيب المحمولة والأجهزة اللوحية والإنترنت في معظم دروسنا. وكثيراً ما يأخذنا معلّم العلوم إلى المختبر حيث نجري تجارب عملية بدلاً من مجرّد القراءة عنها. وفي الشهر الماضي زرنا مدينة أثرية قديمة بالواقع الافتراضي من دون أن نغادر صفّنا! يعتقد المربّون أن المدارس ستستمر في التغيّر. في المستقبل ستكون الدروس أكثر مرونة، وسيتعلّم كل طالب بصيغة شخصية تناسب اهتماماته. ويظنّ بعض الناس أن معلمين آليين سيساعدون المعلمين البشر، وأن مركبات طائرة قد تنقل الطلاب إلى المدرسة. لكنني لا أظنّ أن الحواسيب ستحلّ محلّ المعلمين الجيدين تماماً في يوم من الأيام. يستطيع الحاسوب أن يقدّم المعلومات، لكن المعلّم الذي يهتمّ حقاً بطلابه يستطيع أن يجعلهم يحبّون التعلّم. أعتقد أن أفضل مدرسة في المستقبل ستجمع بين الابتكارات الحديثة والمعلمين اللطفاء الأكفاء.',
        ],
      },
      questions: [
        { n: 1, kind: 'mcq', prompt: 'Sixty years ago, pupils relied on ___ for their knowledge.', promptAr: 'قبل ستين عاماً كان التلاميذ يعتمدون على ___ في معارفهم.', options: ['their teachers', 'computers', 'the Internet', 'virtual reality'], answer: 0, explainAr: 'النص: "There were no computers, so pupils relied on their teachers for all their knowledge" — لم تكن هناك حواسيب فاعتمدوا على معلّميهم.' },
        { n: 2, kind: 'mcq', prompt: 'According to the writer, ___.', promptAr: 'بحسب الكاتب، ___.', options: ['computers will completely replace teachers in the future', 'good teachers will always be important, even with modern technology', 'students now learn everything from books', 'robotic teachers are teaching in his school now'], answer: 1, explainAr: 'الكاتب يقول: "I don\'t think computers will ever replace good teachers completely" وإن أفضل مدرسة ستجمع بين الابتكارات والمعلمين الأكفاء، أي أن المعلم الجيد سيبقى مهماً. الخيار a عكس رأيه، و c كان في الماضي، و d مجرّد توقّع للمستقبل.' },
        { n: 3, kind: 'mcq', prompt: 'What does "who" in the text refer to?', promptAr: 'إلامَ تعود كلمة "who" في النص؟', options: ['a computer', 'a teacher', 'students', 'information'], answer: 1, explainAr: 'الجملة: "a teacher who really cares about students"، فكلمة who تعود على a teacher (المعلّم). وwho تُستخدم للأشخاص لا للأشياء مثل a computer.' },
        { n: 4, kind: 'mcq', prompt: '"Traditional" is the opposite of:', promptAr: 'كلمة "Traditional" (تقليدي) عكسها:', options: ['major', 'modern', 'practical', 'effective'], answer: 1, explainAr: 'traditional = تقليدي يتبع الطرق القديمة، وعكسها modern = حديث. والنص نفسه يقابل بين طرق الماضي التقليدية والتكنولوجيا الحديثة.' },
        { n: 5, kind: 'mcq', prompt: '"Provide" means ___.', promptAr: 'كلمة "Provide" تعني ___.', options: ['to give something to be used', 'to depend on', 'to put two things together', 'to make something better'], answer: 0, explainAr: 'provide = يزوّد / يوفّر، أي يعطي شيئاً ليُستخدم. أما to depend on فهي معنى rely، و to put two things together معنى combine، و to make something better معنى improve.' },
      ],
    },
    {
      letter: 'B',
      title: 'Read the following text then write if the sentences are True or False:',
      titleAr: 'اقرأ النص التالي ثم اكتب إن كانت الجمل صحيحة أم خاطئة:',
      marks: 50,
      passage: {
        paragraphs: [
          "Millions of teenagers surf the net every day. They use social media to chat with friends, share photos and follow famous people. The Internet is a wonderful place, but it can also be dangerous if we don't use it carefully. Last year, a thirteen-year-old girl called Rana had a bad experience. She was chatting online when a stranger sent her a message. He said that he was a student at her school and asked for her address. Rana didn't know him, so she didn't answer. Then the stranger started to post unkind comments about her appearance. Rana felt upset and lonely for a few days, but she didn't blame herself. She talked to her mother and the school counselor, and they helped her to block the stranger and report him. Experts give young people some simple advice. Never share your password, address or phone number with anyone online. Think twice before you post a photo, because it can stay on the Internet forever. If someone annoys or threatens you, don't answer. Keep the messages and tell a trusted adult. Finally, remember that people online are not always who they say they are. If we all followed these rules, the Internet would be a much safer place.",
        ],
        paragraphsAr: [
          'يتصفّح ملايين المراهقين الإنترنت كل يوم. يستخدمون وسائل التواصل الاجتماعي للدردشة مع أصدقائهم ومشاركة الصور ومتابعة المشاهير. الإنترنت مكان رائع، لكنه قد يكون خطيراً أيضاً إذا لم نستخدمه بحذر. في العام الماضي مرّت فتاة في الثالثة عشرة اسمها رنا بتجربة سيئة. كانت تدردش على الإنترنت عندما أرسل لها شخص غريب رسالة. قال إنه طالب في مدرستها وطلب عنوانها. لم تكن رنا تعرفه، لذلك لم تُجبه. ثم بدأ الغريب ينشر تعليقات مسيئة عن مظهرها. شعرت رنا بالانزعاج والوحدة بضعة أيام، لكنها لم تلُم نفسها. تحدّثت إلى أمها وإلى المرشدة في المدرسة، فساعدتاها على حظر الغريب والإبلاغ عنه. يقدّم الخبراء للشباب بعض النصائح البسيطة: لا تشارك أبداً كلمة المرور أو العنوان أو رقم الهاتف مع أي أحد على الإنترنت. فكّر مرتين قبل أن تنشر صورة، لأنها قد تبقى على الإنترنت إلى الأبد. إذا أزعجك أحد أو هدّدك فلا تردّ عليه، واحتفظ بالرسائل وأخبر شخصاً بالغاً تثق به. وأخيراً تذكّر أن الناس على الإنترنت ليسوا دائماً من يقولون إنهم هم. لو اتّبعنا جميعاً هذه القواعد لكان الإنترنت مكاناً أكثر أماناً بكثير.',
        ],
      },
      questions: [
        { n: 6, kind: 'truefalse', prompt: 'Teenagers use social media only to follow famous people.', promptAr: 'يستخدم المراهقون وسائل التواصل الاجتماعي لمتابعة المشاهير فقط.', answer: false, explainAr: 'النص: "They use social media to chat with friends, share photos and follow famous people" — ليس فقط لمتابعة المشاهير.' },
        { n: 7, kind: 'truefalse', prompt: 'Rana knew the person who sent her the message.', promptAr: 'كانت رنا تعرف الشخص الذي أرسل لها الرسالة.', answer: false, explainAr: 'النص: "Rana didn\'t know him" — لم تكن تعرفه، فقد كان غريباً (a stranger).' },
        { n: 8, kind: 'truefalse', prompt: 'Rana asked her mother and the school counselor for help.', promptAr: 'طلبت رنا المساعدة من أمها ومن المرشدة في المدرسة.', answer: true, explainAr: 'النص: "She talked to her mother and the school counselor, and they helped her to block the stranger".' },
        { n: 9, kind: 'truefalse', prompt: 'Experts say we can share our password with our online friends.', promptAr: 'يقول الخبراء إنه يمكننا مشاركة كلمة المرور مع أصدقائنا على الإنترنت.', answer: false, explainAr: 'النص: "Never share your password, address or phone number with anyone online" — لا تشاركها مع أي أحد أبداً.' },
        { n: 10, kind: 'truefalse', prompt: 'We should keep unkind messages and tell an adult we trust.', promptAr: 'يجب أن نحتفظ بالرسائل المسيئة ونخبر شخصاً بالغاً نثق به.', answer: true, explainAr: 'النص: "Keep the messages and tell a trusted adult".' },
      ],
    },
    {
      letter: 'C',
      title: 'Read the sentences then choose the correct answer a, b, c or d:',
      titleAr: 'اقرأ الجمل ثم اختر الإجابة الصحيحة a أو b أو c أو d:',
      marks: 200,
      questions: [
        { n: 11, kind: 'mcq', topic: 'tense', prompt: 'Listen! Somebody ___ at the door.', promptAr: 'اسمع! أحدهم ___ الباب.', options: ['knocks', 'is knocking', 'knocked', 'will knock'], answer: 1, explainAr: 'Listen! تدلّ على حدث يجري الآن فنستخدم المضارع المستمر: is knocking.' },
        { n: 12, kind: 'mcq', topic: 'tense', prompt: 'Hala usually ___ to school by bus.', promptAr: 'تذهب هالة عادةً ___ إلى المدرسة بالحافلة.', options: ['goes', 'is going', 'go', 'went'], answer: 0, explainAr: 'usually تدلّ على عادة فنستخدم المضارع البسيط، ومع Hala (هي) نضيف es: goes.' },
        { n: 13, kind: 'mcq', topic: 'tense', prompt: 'Basel has bought the tickets. He ___ his relatives in Aleppo next week.', promptAr: 'اشترى باسل التذاكر. ___ أقاربه في حلب الأسبوع القادم.', options: ['visits', 'is going to visit', 'visited', 'was visiting'], answer: 1, explainAr: 'خطة قرّرها مسبقاً (اشترى التذاكر) للمستقبل (next week) فنستخدم be going to: is going to visit.' },
        { n: 14, kind: 'mcq', topic: 'tense', prompt: 'While Layan ___ her homework, the lights went out.', promptAr: 'بينما كانت ليان ___ واجبها انقطعت الكهرباء.', options: ['did', 'was doing', 'is doing', 'has done'], answer: 1, explainAr: 'While + الماضي المستمر لحدث طويل كان جارياً، ثم الماضي البسيط (went out) للحدث القصير الذي قطعه: was doing.' },
        { n: 15, kind: 'mcq', topic: 'tense', prompt: 'Mouayyad ___ his leg while he was playing football yesterday.', promptAr: 'مؤيّد ___ ساقه بينما كان يلعب كرة القدم البارحة.', options: ['hurts', 'was hurting', 'hurt', 'has hurt'], answer: 2, explainAr: 'حدث قصير انتهى في الماضي (yesterday) وقع أثناء حدث طويل (was playing)، فنستخدم الماضي البسيط: hurt (فعل شاذ: hurt – hurt – hurt).' },
        { n: 16, kind: 'mcq', topic: 'tense', prompt: 'Have you ever ___ in a hot-air balloon?', promptAr: 'هل سبق أن ___ في منطاد هوائي؟', options: ['flew', 'flown', 'fly', 'flying'], answer: 1, explainAr: 'المضارع التام للتجارب حتى الآن: have + التصريف الثالث. تصريف fly هو fly – flew – flown، فنقول: Have you ever flown.' },
        { n: 17, kind: 'mcq', topic: 'reported', prompt: '"I will call you tomorrow." Basel told me that he ___ me the following day.', promptAr: '"سأتصل بك غداً." أخبرني باسل أنه ___ بي في اليوم التالي.', options: ['will call', 'would call', 'calls', 'called'], answer: 1, explainAr: 'في الكلام المنقول يتغيّر will إلى would، و tomorrow إلى the following day: he would call me.' },
        { n: 18, kind: 'mcq', topic: 'reported', prompt: '"We have visited the ancient citadel." The tourists said that they ___ the ancient citadel.', promptAr: '"لقد زرنا القلعة القديمة." قال السيّاح إنهم ___ القلعة القديمة.', options: ['have visited', 'had visited', 'visit', 'were visiting'], answer: 1, explainAr: 'في الكلام المنقول يرجع المضارع التام (have visited) إلى الماضي التام: had visited، و we تصبح they.' },
        { n: 19, kind: 'mcq', topic: 'tense', prompt: 'When we arrived at the station, the train ___.', promptAr: 'عندما وصلنا إلى المحطة كان القطار ___.', options: ['has already left', 'had already left', 'already leaves', 'is leaving'], answer: 1, explainAr: 'مغادرة القطار حدثت قبل وصولنا (وهو حدث ماضٍ)، فالحدث الأسبق يكون بالماضي التام: had already left.' },
        { n: 20, kind: 'mcq', topic: 'conditional', prompt: 'If I ___ a lot of money, I would build a new school in my village.', promptAr: 'لو ___ الكثير من المال لبنيت مدرسة جديدة في قريتي.', options: ['have', 'had', 'will have', 'would have'], answer: 1, explainAr: 'الشرط الثاني (موقف خيالي): If + الماضي البسيط، ثم would + الفعل. لذلك: If I had.' },
        { n: 21, kind: 'mcq', topic: 'conditional', prompt: 'If Bayan knew the answer, she ___ you.', promptAr: 'لو كانت بيان تعرف الجواب ___ لك.', options: ['will tell', 'would tell', 'tells', 'told'], answer: 1, explainAr: 'الشرط الثاني: جملة If بالماضي (knew)، والجواب would + الفعل المجرّد: would tell.' },
        { n: 22, kind: 'mcq', topic: 'grammar', prompt: '___ did you go to Lattakia? — By train.', promptAr: '___ ذهبت إلى اللاذقية؟ — بالقطار.', options: ['When', 'How', 'Where', 'Why'], answer: 1, explainAr: 'الجواب By train يدلّ على الطريقة (وسيلة النقل)، ونسأل عن الطريقة بـ How.' },
        { n: 23, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has silent "h" is:', promptAr: 'الكلمة التي فيها حرف "h" صامت هي:', options: ['hotel', 'hour', 'house', 'happy'], answer: 1, explainAr: 'hour تُلفظ /aʊə/ ولا يُلفظ فيها h، أما hotel و house و happy فيُلفظ فيها h.' },
        { n: 24, kind: 'mcq', topic: 'pronunciation', prompt: 'The letter "c" is pronounced /s/ in:', promptAr: 'الحرف "c" يُلفظ /s/ في:', options: ['cake', 'city', 'clock', 'cup'], answer: 1, explainAr: 'يُلفظ c صوت /s/ إذا جاء بعده i أو e أو y كما في city. وفي cake و clock و cup يُلفظ /k/.' },
        { n: 25, kind: 'mcq', topic: 'pronunciation', prompt: 'The word that has the short /u/ sound is:', promptAr: 'الكلمة التي فيها الصوت القصير /u/ هي:', options: ['pool', 'spoon', 'foot', 'tooth'], answer: 2, explainAr: 'foot تُلفظ بالصوت القصير /u/، أما pool و spoon و tooth فبالصوت الطويل /u:/.' },
        { n: 26, kind: 'mcq', topic: 'wordform', prompt: 'Rami is very ___ in science, so he reads a lot about it.', promptAr: 'رامي ___ جداً بالعلوم، لذلك يقرأ عنها كثيراً.', options: ['interesting', 'interested', 'interest', 'interestingly'], answer: 1, explainAr: 'رامي هو الذي يشعر بالاهتمام، فنستخدم الصفة المنتهية بـ -ed: interested in. أما interesting فتصف الشيء الذي يثير الاهتمام.' },
        { n: 27, kind: 'mcq', topic: 'vocab', prompt: 'A thing that you buy to remind yourself of a place:', promptAr: 'شيء تشتريه ليذكّرك بمكان ما:', options: ['passport', 'souvenir', 'suitcase', 'parcel'], answer: 1, explainAr: 'souvenir = تذكار، وهو شيء نشتريه ليذكّرنا بمكان زرناه (كلمة من الوحدة الثالثة).' },
        { n: 28, kind: 'mcq', topic: 'vocab', prompt: 'Very sad and without hope:', promptAr: 'حزين جداً وبلا أمل:', options: ['motivated', 'depressed', 'satisfied', 'honest'], answer: 1, explainAr: 'depressed = مكتئب، حزين جداً وبلا أمل (كلمة من الوحدة الثانية).' },
        { n: 29, kind: 'mcq', topic: 'vocab', prompt: 'A person trained to give advice is called ___.', promptAr: 'الشخص المدرَّب على تقديم النصيحة يسمّى ___.', options: ['customer', 'counselor', 'founder', 'bully'], answer: 1, explainAr: 'counselor = مرشد / مستشار، شخص مدرَّب على تقديم النصح (كلمة من الوحدة الخامسة).' },
        { n: 30, kind: 'mcq', topic: 'vocab', prompt: 'Something done successfully is known as ___.', promptAr: 'الشيء الذي يُنجَز بنجاح يُعرف بـ ___.', options: ['achievement', 'risk', 'strategy', 'profile'], answer: 0, explainAr: 'achievement = إنجاز، أي شيء أُنجز بنجاح (كلمة من الوحدة السادسة).' },
      ],
    },
    {
      letter: 'D',
      title: 'Ask about the underline word(s):',
      titleAr: 'اسأل عن الكلمة (الكلمات) التي تحتها خط:',
      marks: 40,
      questions: [
        { n: 31, kind: 'ask', prompt: 'Hala lives {in Homs}.', promptAr: 'تعيش هالة في حمص.', options: ['Where does Hala live?', 'Where Hala lives?', 'Where does Hala lives?', 'What does Hala live?'], answer: 0, explainAr: 'نسأل عن المكان بـ Where، والفعل مضارع بسيط مع هي، فنستخدم does + الفعل المجرّد: Where does Hala live?' },
        { n: 32, kind: 'ask', prompt: '{Basel} won the first prize.', promptAr: 'فاز باسل بالجائزة الأولى.', options: ['Who did win the first prize?', 'Who won the first prize?', 'What won the first prize?', 'Who did Basel win?'], answer: 1, explainAr: 'نسأل عن الفاعل (شخص) بـ Who، وعندما تكون Who هي الفاعل لا نستخدم did ويبقى الفعل بالماضي: Who won the first prize?' },
        { n: 33, kind: 'ask', prompt: 'The students visited the museum {last Friday}.', promptAr: 'زار الطلاب المتحف يوم الجمعة الماضي.', options: ['When the students visited the museum?', 'Where did the students visit?', 'When did the students visit the museum?', 'When did the students visited the museum?'], answer: 2, explainAr: 'نسأل عن الزمن بـ When، والجملة في الماضي فنستخدم did + الفعل المجرّد (visit لا visited): When did the students visit the museum?' },
        { n: 34, kind: 'ask', prompt: 'Layan bought {three} souvenirs.', promptAr: 'اشترت ليان ثلاثة تذكارات.', options: ['How much souvenirs did Layan buy?', 'How many souvenirs Layan bought?', 'What did Layan buy?', 'How many souvenirs did Layan buy?'], answer: 3, explainAr: 'نسأل عن العدد مع اسم معدود بالجمع بـ How many، ثم did + الفاعل + الفعل المجرّد: How many souvenirs did Layan buy?' },
      ],
    },
    {
      letter: 'E',
      title: 'Choose the wrong part in each phrase:',
      titleAr: 'اختر الجزء الخاطئ في كل جملة:',
      marks: 20,
      questions: [
        { n: 35, kind: 'wrongpart', prompt: '{Lamar} {said} that she {has} finished her {homework}.', promptAr: 'قالت لمار إنها كانت قد أنهت واجبها.', answer: 2, explainAr: 'في الكلام المنقول بعد said يرجع المضارع التام (has finished) إلى الماضي التام: has ← had.' },
        { n: 36, kind: 'wrongpart', prompt: 'If I {had} a car, I {will} {drive} to {the} coast.', promptAr: 'لو كانت عندي سيارة لقُدتها إلى الساحل.', answer: 1, explainAr: 'الشرط الثاني: If + ماضٍ (had) ثم would + الفعل، فالصحيح: will ← would.' },
        { n: 37, kind: 'wrongpart', prompt: 'Rami {were} reading a book {when} his {friend} {called}.', promptAr: 'كان رامي يقرأ كتاباً عندما اتصل صديقه.', answer: 0, explainAr: 'في الماضي المستمر نستخدم was مع المفرد (Rami = he)، و were مع الجمع: were ← was.' },
        { n: 38, kind: 'wrongpart', prompt: 'Look! The children {are} {playing} in the garden {and} their mother {watch} them.', promptAr: 'انظر! الأطفال يلعبون في الحديقة وأمهم تراقبهم.', answer: 3, explainAr: 'Look! تدلّ على حدث يجري الآن، فنستخدم المضارع المستمر: watch ← is watching.' },
      ],
    },
    {
      letter: 'F',
      title: 'Write a 50-word paragraph about the following topic:',
      titleAr: 'اكتب فقرة من 50 كلمة عن الموضوع التالي:',
      marks: 40,
      writing: {
        topic: 'A problem you faced at school and how you overcame it',
        topicAr: 'مشكلة واجهتك في المدرسة وكيف تغلّبت عليها',
        words: 50,
        model: "Last year, I faced a big challenge at school. I found maths very difficult and my marks were low. I felt depressed and I didn't want to go to school. One day, while I was sitting alone in the classroom, my teacher came and talked to me. She gave me extra lessons and my friends helped me too. Finally, I overcame the problem and got good results.",
        modelAr: 'في العام الماضي واجهت تحدّياً كبيراً في المدرسة. وجدت الرياضيات صعبة جداً وكانت علاماتي منخفضة. شعرت بالإحباط ولم أعد أرغب في الذهاب إلى المدرسة. وذات يوم، بينما كنت جالساً وحدي في الصف، جاءت معلّمتي وتحدّثت معي. أعطتني دروساً إضافية وساعدني أصدقائي أيضاً. وفي النهاية تغلّبت على المشكلة وحصلت على نتائج جيدة.',
        checklistAr: [
          'كتبت عن الموضوع المطلوب نفسه (مشكلة في المدرسة وكيف تغلّبت عليها).',
          'استخدمت الماضي البسيط والماضي المستمر بشكل صحيح.',
          'استخدمت كلمات من الوحدة الثانية مثل challenge, depressed, marks, overcome.',
          'رتّبت الأحداث بكلمات ربط مثل One day, while, Finally وراعيت الإملاء والترقيم.',
        ],
      },
    },
  ],
}
