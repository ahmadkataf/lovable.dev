import type { GrammarExercise } from '../../../engine/types'
import type { ModuleExtras } from './merge'

// Module 1 — Activity Book pages 5–21: Unit 1 (5–7), Unit 2 (8–10), Unit 3 (11–13), Unit 4 (14–16),
// Unit 5 (17–19) and Revision 1 (20–21). Items that need the recording, a drawing or a personal answer
// are left out, or turned into solvable items with the page's own words (pictures are described in Arabic).

const fill = (prompt: string, promptAr: string, promptArFull: string, options: string[], answer: number, explainAr: string): GrammarExercise =>
  ({ type: 'fill', prompt, promptAr, promptArFull, options, answer, explainAr })
const mcq = (prompt: string, promptAr: string, options: string[], answer: number, explainAr: string): GrammarExercise =>
  ({ type: 'mcq', prompt, promptAr, options, answer, explainAr })
const build = (answer: string, prompt: string): GrammarExercise => ({ type: 'build', answer, prompt })

/** The right option and the others, with the right one put at position `at` so answers do not always sit first. */
function place(right: string, others: string[], at: number): { options: string[]; answer: number } {
  const options = [...others]
  const i = at % (others.length + 1)
  options.splice(i, 0, right)
  return { options, answer: i }
}

/** "Read and match" with pictures: the pupil picks the picture (described in Arabic) that shows the phrase. */
function pictureMatch(phrase: string, phraseAr: string, pics: string[], right: number, others: number[], at: number): GrammarExercise {
  const { options, answer } = place(pics[right], others.map(i => pics[i]), at)
  return mcq(`Read and match: "${phrase}"`, `اختر الصورة التي تناسب الجملة: «${phrase}»`, options, answer,
    `«${phrase}» تعني: ${phraseAr}. لذلك تناسبها صورة: ${pics[right]}.`)
}

// ---------- Unit 1, page 5 ex. 2: the classroom rules and their pictures ----------
const u1Pics = [
  'بنت تجلس إلى مقعدها وترفع يدها',
  'ولد يرمي الورق في سلّة المهملات',
  'هاتف محمول عليه إشارة منع',
  'بنت تضع إصبعها على فمها وتقول: شششش',
  'ساعة',
  'ولد يقول please و thank you',
]
const u1Rules: [string, string, number][] = [
  ['I have to leave my mobile phone at home.', 'يجب أن أترك هاتفي المحمول في البيت', 2],
  ['I have to raise my hand before speaking.', 'يجب أن أرفع يدي قبل أن أتكلّم', 0],
  ['I have to arrive on time.', 'يجب أن أصل في الوقت المحدّد', 4],
  ['I have to be quiet in the classroom.', 'يجب أن أكون هادئاً في الصف', 3],
  ['I have to keep my classroom clean.', 'يجب أن أحافظ على نظافة صفّي', 1],
  ['I have to say "please" and "thank you".', 'يجب أن أقول «من فضلك» و«شكراً»', 5],
]
const u1RuleItems = u1Rules.map(([en, ar, pic], k) =>
  pictureMatch(en, ar, u1Pics, pic, [0, 1, 2, 3, 4, 5].filter(i => i !== pic).filter((_, j) => (j + k) % 5 < 3), k + 1))

// ---------- Unit 3, page 11 ex. 1: daily routines and their pictures ----------
const u3Pics = [
  'ولد يتمطّى بجانب سريره بعد النوم',
  'دُشّ وحوض استحمام',
  'ولد يضع أغراضه في حقيبته',
  'شخص يدخل إلى سريره لينام',
  'شاشة فيها رسائل بين صديقين',
  'ولد يلبس قميصه',
  'صحن وشوكة وسكّين على الطاولة',
]
const u3Routines: [string, string][] = [
  ['Get up', 'ينهض من السرير'],
  ['Have a shower', 'يستحمّ تحت الدُّش'],
  ['Pack a bag', 'يجهّز حقيبته'],
  ['Go to bed', 'يذهب إلى السرير لينام'],
  ['Chat online', 'يدردش على الإنترنت'],
  ['Get dressed', 'يلبس ثيابه'],
  ['Set the table', 'يجهّز المائدة للطعام'],
]
const u3RoutineItems = u3Routines.map(([en, ar], k) =>
  pictureMatch(en, ar, u3Pics, k, [(k + 2) % 7, (k + 4) % 7, (k + 5) % 7], k + 2))

// ---------- Unit 3, page 11 ex. 2: Dalia's day in the right order (c, a, f, b, e, d) ----------
const u3Order: [string, string][] = [
  ['Dalia always wakes up early.', 'داليا تستيقظ دائماً باكراً.'],
  ['She usually has breakfast and makes her bed.', 'عادةً تتناول فطورها وترتّب سريرها.'],
  ['She goes to school.', 'تذهب إلى المدرسة.'],
  ['In the afternoon, she studies and sometimes she plays the piano.', 'في فترة بعد الظهر تدرس، وأحياناً تعزف على البيانو.'],
  ['In the evening, she sometimes chats with her friends online.', 'في المساء تدردش أحياناً مع صديقاتها على الإنترنت.'],
  ['She never goes to bed late.', 'لا تنام متأخرة أبداً.'],
]
const u3OrderWhy = [
  'تبدأ القصة بالاسم «Dalia» وبأول شيء نفعله في اليوم: الاستيقاظ.',
  'بعد أن تستيقظ تتناول الفطور وترتّب سريرها.',
  'بعد الفطور تذهب إلى المدرسة.',
  'بعد المدرسة يأتي وقت بعد الظهر: In the afternoon.',
  'بعد الظهر يأتي المساء: In the evening.',
  'آخر شيء في اليوم هو النوم، فهذه الجملة الأخيرة.',
]
function u3OrderItems(): GrammarExercise[] {
  return u3Order.map(([en, ar], n) => {
    const others = [1, 2, 3, 4, 5].map(d => (n + d) % 6).filter(i => i !== n).slice(0, 3).map(i => u3Order[i][0])
    const { options, answer } = place(en, others, n + 1)
    if (n === 0) return mcq('Reorder the sentences. Which sentence comes first?', 'رتّب الجمل: أيّ جملة تأتي أولاً؟', options, answer, `${u3OrderWhy[n]} (${ar})`)
    return mcq(`Reorder the sentences. Which sentence comes after "${u3Order[n - 1][0]}"?`,
      `رتّب الجمل: أيّ جملة تأتي بعد «${u3Order[n - 1][1]}»؟`, options, answer, `${u3OrderWhy[n]} (${ar})`)
  })
}

// ---------- Unit 3, page 12 ex. 3: What time is it? ----------
const u3Times: [string, string, string, string[], string][] = [
  // [digital time, the words, Arabic time, wrong options, why]
  ['5:00', "It's five o'clock.", 'الخامسة تماماً', ['half past five', 'five past five'], 'العقرب الكبير على 12، فنقول o’clock (تماماً).'],
  ['5:05', "It's five past five.", 'الخامسة وخمس دقائق', ['five to five', 'ten past five'], 'العقرب الكبير على 1: مرّت خمس دقائق، فنقول five past.'],
  ['5:10', "It's ten past five.", 'الخامسة وعشر دقائق', ['ten to five', 'twenty past five'], 'العقرب الكبير على 2: مرّت عشر دقائق، فنقول ten past.'],
  ['5:15', "It's quarter past five.", 'الخامسة والربع', ['quarter to five', 'half past five'], 'العقرب الكبير على 3: مرّ ربع ساعة، فنقول quarter past.'],
  ['5:20', "It's twenty past five.", 'الخامسة والثلث', ['twenty to five', 'twenty-five past five'], 'العقرب الكبير على 4: مرّت عشرون دقيقة، فنقول twenty past.'],
  ['5:25', "It's twenty-five past five.", 'الخامسة وخمس وعشرون دقيقة', ['twenty-five to five', 'twenty past five'], 'العقرب الكبير على 5: مرّت خمس وعشرون دقيقة، فنقول twenty-five past.'],
  ['5:30', "It's half past five.", 'الخامسة والنصف', ['quarter past five', 'half to six'], 'العقرب الكبير على 6: مرّ نصف ساعة، فنقول half past.'],
  ['5:35', "It's twenty-five to six.", 'السادسة إلا خمساً وعشرين دقيقة', ['twenty-five past six', 'twenty to six'], 'بعد النصف نعدّ الدقائق الباقية إلى الساعة التالية: بقيت 25 دقيقة على السادسة، فنقول twenty-five to six.'],
  ['5:40', "It's twenty to six.", 'السادسة إلا ثلثاً', ['twenty past six', 'ten to six'], 'بقيت 20 دقيقة على السادسة، فنقول twenty to six.'],
  ['5:45', "It's quarter to six.", 'السادسة إلا ربعاً', ['quarter past six', 'half past five'], 'بقي ربع ساعة على السادسة، فنقول quarter to six.'],
  ['5:50', "It's ten to six.", 'السادسة إلا عشر دقائق', ['ten past six', 'five to six'], 'بقيت 10 دقائق على السادسة، فنقول ten to six.'],
  ['5:55', "It's five to six.", 'السادسة إلا خمس دقائق', ['five past six', 'ten to six'], 'بقيت 5 دقائق على السادسة، فنقول five to six.'],
]
const u3TimeItems = u3Times.map(([clock, words, ar, wrong, why], k) => {
  const right = words.replace("It's ", '').replace('.', '')
  const { options, answer } = place(right, wrong, k)
  return fill(`What time is it? (${clock}) It's ___.`, `كم الساعة؟ (${clock}) إنها ___.`, `كم الساعة؟ (${clock}) إنها ${ar}.`, options, answer, why)
})

// ---------- Revision 1, page 21 ex. 4: the word search ----------
const groups = ['In the school', 'Family', 'Senses', 'Clothes']
const groupsAr = ['في المدرسة', 'العائلة', 'الحواس', 'الملابس']
const found: [string, number, string][] = [
  ['classroom', 0, 'الصف'], ['library', 0, 'المكتبة'],
  ['nephew', 1, 'ابن الأخ أو ابن الأخت'], ['cousin', 1, 'ابن العمّ أو الخال'], ['son', 1, 'الابن'],
  ['touch', 2, 'اللمس'], ['smell', 2, 'الشمّ'], ['eye', 2, 'العين'],
  ['scarf', 3, 'الوشاح'], ['gloves', 3, 'القفّازات'],
]
const wordSearchItems = found.map(([w, g, ar], k) => {
  const others = [0, 1, 2, 3].filter(i => i !== g).map(i => { const m = found.filter(f => f[1] === i); return m[k % m.length][0] })
  const { options, answer } = place(w, others, k)
  return mcq(`Find the words. Which word goes in the group "${groups[g]}"?`, `ابحث عن الكلمات: أيّ كلمة تناسب مجموعة «${groupsAr[g]}»؟`, options, answer,
    `${w} تعني «${ar}»، فهي من مجموعة ${groups[g]} (${groupsAr[g]}). وهي مخبّأة في شبكة الحروف.`)
})

export const extras: ModuleExtras = {
  units: {
    // ===================== UNIT 1 — At School (Activity Book pages 5–7) =====================
    u1: {
      workbook: {
        pages: '5–7',
        readings: [
          {
            title: "Ameer's New School",
            paragraphs: [
              "Hi! I am Ameer. My new school is very big. It has a big playground, a big library, three computer labs, twenty classrooms, three science labs, four bathrooms and a canteen. It's my first day. Our teacher have to read the roll call and tells us that we has to wear our school uniform. We have to arrives at school on time. We can play in the playground, but we have walk in the corridors. We don't has to do our homework at school. We can read books in the library but we have to keeps quiet there. What about you, what does you have to do in your classroom?",
            ],
            paragraphsAr: [
              'مرحباً! أنا أمير. مدرستي الجديدة كبيرة جداً. فيها ملعب كبير، ومكتبة كبيرة، وثلاثة مخابر حاسوب، وعشرون صفّاً، وثلاثة مخابر علوم، وأربعة حمّامات، ومقصف. هذا يومي الأول. على معلّمنا أن يقرأ أسماء التلاميذ ويخبرنا أنه يجب علينا أن نلبس الزيّ المدرسي. يجب أن نصل إلى المدرسة في الوقت المحدّد. نستطيع أن نلعب في الملعب، لكن يجب أن نمشي في الممرّات. ليس علينا أن نكتب وظائفنا في المدرسة. نستطيع أن نقرأ الكتب في المكتبة، لكن يجب أن نبقى هادئين هناك. وأنت، ماذا يجب عليك أن تفعل في صفّك؟ (في هذا النص 8 أخطاء تحتها خط في الكتاب، ستصحّحها في التمارين.)',
            ],
            questions: [
              {
                q: "Write two things they don't have to do: They don't have to …", qAr: 'اكتب شيئاً ليس عليهم أن يفعلوه: ليس عليهم أن …',
                options: ['do their homework at school', 'wear their school uniform', 'arrive at school on time', 'keep quiet in the library'],
                answer: 0, explainAr: 'يقول النص: We don’t have to do our homework at school. أمّا الأشياء الأخرى فهي قواعد يجب فعلها.',
              },
              {
                q: 'Write the classroom rules from the text: They have to walk …', qAr: 'اكتب القواعد من النص: يجب عليهم أن يمشوا …',
                options: ['in the corridors', 'in the library', 'in the canteen', 'in the computer labs'],
                answer: 0, explainAr: 'يقول النص: we have to walk in the corridors، أي يجب أن نمشي في الممرّات ولا نركض.',
              },
              {
                q: "How many science labs are there in Ameer's school?", qAr: 'كم مخبرَ علومٍ في مدرسة أمير؟',
                options: ['two', 'three', 'four', 'twenty'],
                answer: 1, explainAr: 'يقول النص: three science labs، أي ثلاثة مخابر علوم.',
              },
              {
                q: 'Where can they eat at school?', qAr: 'أين يستطيعون أن يأكلوا في المدرسة؟',
                options: ['in the canteen', 'in the library', 'in the bathroom', 'in the computer lab'],
                answer: 0, explainAr: 'في المدرسة مقصف canteen، وهو مكان نشتري فيه الطعام ونأكل.',
              },
            ],
            trueFalse: [
              { statement: 'There is a place to eat in.', answer: true },
              { statement: 'There are only two science labs.', answer: false },
              { statement: 'They can read in the library.', answer: true },
              { statement: 'They can run in the classroom.', answer: false },
              { statement: 'They have to keep quiet in the library.', answer: true },
            ],
          },
        ],
        exercises: [
          // ex. 1 — fill in the spaces with the words in the box
          fill('I wash my hands in the ___.', 'أغسل يديّ في ___.', 'أغسل يديّ في الحمّام.', ['bathroom', 'library', 'playground', 'classroom'], 0,
            'نغسل أيدينا في الحمّام: bathroom.'),
          fill('We do chemical experiments in the ___.', 'نقوم بتجارب كيميائية في ___.', 'نقوم بتجارب كيميائية في مخبر العلوم.', ['classroom', 'science lab', 'computer lab', 'library'], 1,
            'التجارب الكيميائية تكون في مخبر العلوم: science lab.'),
          fill('I borrow books from the ___.', 'أستعير الكتب من ___.', 'أستعير الكتب من المكتبة.', ['bathroom', 'playground', 'library', 'science lab'], 2,
            'نستعير الكتب (borrow books) من المكتبة: library.'),
          fill('There are sixteen desks in our ___.', 'في ___ ستة عشر مقعداً.', 'في صفّنا ستة عشر مقعداً.', ['playground', 'classroom', 'bathroom'], 1,
            'المقاعد (desks) نجلس عليها في الصف: classroom.'),
          fill('They work on computers in the ___.', 'يعملون على الحواسيب في ___.', 'يعملون على الحواسيب في مخبر الحاسوب.', ['science lab', 'library', 'computer lab', 'bathroom'], 2,
            'الحواسيب (computers) نجدها في مخبر الحاسوب: computer lab.'),
          fill('We play games in the ___.', 'نلعب الألعاب في ___.', 'نلعب الألعاب في الملعب.', ['library', 'playground', 'bathroom', 'science lab'], 1,
            'نلعب في ساحة اللعب: playground.'),
          // ex. 2 — read and match the rules with the pictures
          ...u1RuleItems,
          // ex. 4 — match
          fill('When you have a question, ___.', 'عندما يكون عندك سؤال، ___.', 'عندما يكون عندك سؤال، يجب أن ترفع يدك.',
            ['you have to say please and thank you', 'you have to raise your hand', "you don't have to bring a sandwich with you"], 1,
            'قبل أن نسأل في الصف نرفع أيدينا: you have to raise your hand.'),
          fill('When you need something, ___.', 'عندما تحتاج شيئاً، ___.', 'عندما تحتاج شيئاً، يجب أن تقول من فضلك وشكراً.',
            ['you have to say please and thank you', 'you have to raise your hand', "you don't have to bring a sandwich with you"], 0,
            'عندما نطلب شيئاً نقول please، وعندما نأخذه نقول thank you.'),
          fill("There's a canteen in the school, ___.", 'يوجد مقصف في المدرسة، ___.', 'يوجد مقصف في المدرسة، فليس عليك أن تُحضر معك شطيرة.',
            ['you have to raise your hand', "you don't have to bring a sandwich with you", 'you have to say please and thank you'], 1,
            'في المقصف طعام، فلا داعي لإحضار شطيرة: you don’t have to bring a sandwich.'),
          fill("Don't be late. ___", 'لا تتأخّر. ___', 'لا تتأخّر. يجب أن تأتي إلى الصف في الوقت المحدّد.',
            ['You have to raise your hand.', 'You have to come to class on time.', "You don't have to bring a sandwich with you."], 1,
            'لا تتأخّر = يجب أن تأتي في الوقت المحدّد: on time.'),
          // ex. 5 — put the stages in the right order
          fill('Put the stages in the right order. 1. ___ school', 'رتّب المراحل الدراسية. 1. مدرسة ___', 'رتّب المراحل الدراسية. 1. مدرسة الروضة',
            ['Basic', 'Secondary', 'Nursery'], 2, 'أول مرحلة هي الروضة Nursery: يذهب إليها الأطفال في عمر ثلاث سنوات.'),
          fill('Put the stages in the right order. 2. ___ school', 'رتّب المراحل الدراسية. 2. المدرسة ___', 'رتّب المراحل الدراسية. 2. المدرسة الأساسية',
            ['Basic', 'Secondary', 'Nursery'], 0, 'بعد الروضة تأتي المدرسة الأساسية Basic، من الصف الأول إلى التاسع.'),
          fill('Put the stages in the right order. 3. ___ school', 'رتّب المراحل الدراسية. 3. المدرسة ___', 'رتّب المراحل الدراسية. 3. المدرسة الثانوية',
            ['Basic', 'Secondary', 'Nursery'], 1, 'آخر مرحلة هي الثانوية Secondary: الصفوف 10 و11 و12.'),
          // ex. 6a — correct the underlined mistakes in Ameer's text
          fill('Correct the mistake: Our teacher ___ read the roll call.', 'صحّح الخطأ: معلّمنا ___ يقرأ أسماء التلاميذ.', 'صحّح الخطأ: معلّمنا عليه أن يقرأ أسماء التلاميذ.',
            ['have to', 'has to', 'having to'], 1, 'Our teacher = he، ومع he / she / it نقول has to وليس have to.'),
          fill('Correct the mistake: Our teacher has to read the roll call and ___ us that we have to wear our school uniform.', 'صحّح الخطأ: على معلّمنا أن يقرأ أسماء التلاميذ و___ أنه يجب أن نلبس الزيّ المدرسي.', 'صحّح الخطأ: على معلّمنا أن يقرأ أسماء التلاميذ ويخبرنا أنه يجب أن نلبس الزيّ المدرسي.',
            ['tells', 'tell', 'telling'], 1, 'بعد has to يأتي الفعل بلا s: has to read … and tell.'),
          fill('Correct the mistake: We ___ wear our school uniform.', 'صحّح الخطأ: ___ أن نلبس زيّنا المدرسي.', 'صحّح الخطأ: يجب علينا أن نلبس زيّنا المدرسي.',
            ['has to', 'have to', 'having to'], 1, 'مع we نقول have to، أمّا has to فهي لـ he / she / it.'),
          fill('Correct the mistake: We have to ___ at school on time.', 'صحّح الخطأ: يجب أن ___ إلى المدرسة في الوقت المحدّد.', 'صحّح الخطأ: يجب أن نصل إلى المدرسة في الوقت المحدّد.',
            ['arrives', 'arrive', 'arriving'], 1, 'بعد have to يأتي الفعل بشكله الأصلي بلا s: have to arrive.'),
          fill('Correct the mistake: We can play in the playground, but we ___ walk in the corridors.', 'صحّح الخطأ: نستطيع أن نلعب في الملعب، لكن ___ أن نمشي في الممرّات.', 'صحّح الخطأ: نستطيع أن نلعب في الملعب، لكن يجب علينا أن نمشي في الممرّات.',
            ['have', 'have to', 'has to'], 1, 'كلمة to ناقصة: have to walk = يجب أن نمشي.'),
          fill("Correct the mistake: We don't ___ do our homework at school.", 'صحّح الخطأ: ليس ___ أن نكتب وظائفنا في المدرسة.', 'صحّح الخطأ: ليس علينا أن نكتب وظائفنا في المدرسة.',
            ['has to', 'have to', 'having to'], 1, 'بعد don’t نقول have to دائماً: We don’t have to.'),
          fill('Correct the mistake: We have to ___ quiet there.', 'صحّح الخطأ: يجب أن ___ هادئين هناك.', 'صحّح الخطأ: يجب أن نبقى هادئين هناك.',
            ['keeps', 'keep', 'keeping'], 1, 'بعد have to يأتي الفعل بلا s: have to keep.'),
          fill('Correct the mistake: What ___ you have to do in your classroom?', 'صحّح الخطأ: ماذا ___ عليك أن تفعل في صفّك؟', 'صحّح الخطأ: ماذا يجب عليك أن تفعل في صفّك؟',
            ['does', 'do', 'is'], 1, 'مع you نسأل بـ do: What do you have to do?'),
          // ex. 8 — four classroom rules from the text
          fill('Write the rules from the text: They have to ___ their school uniform.', 'اكتب القواعد من النص: يجب عليهم أن ___ زيّهم المدرسي.', 'اكتب القواعد من النص: يجب عليهم أن يلبسوا زيّهم المدرسي.',
            ['wear', 'bring', 'read'], 0, 'يقول النص: we have to wear our school uniform.'),
          fill('Write the rules from the text: They have to ___ at school on time.', 'اكتب القواعد من النص: يجب عليهم أن ___ إلى المدرسة في الوقت المحدّد.', 'اكتب القواعد من النص: يجب عليهم أن يصلوا إلى المدرسة في الوقت المحدّد.',
            ['play', 'arrive', 'walk'], 1, 'يقول النص: We have to arrive at school on time.'),
          fill('Write the rules from the text: They have to ___ in the corridors.', 'اكتب القواعد من النص: يجب عليهم أن ___ في الممرّات.', 'اكتب القواعد من النص: يجب عليهم أن يمشوا في الممرّات.',
            ['run', 'play', 'walk'], 2, 'يقول النص: we have to walk in the corridors، فلا نركض فيها.'),
          fill('Write the rules from the text: They have to ___ quiet in the library.', 'اكتب القواعد من النص: يجب عليهم أن ___ هادئين في المكتبة.', 'اكتب القواعد من النص: يجب عليهم أن يبقوا هادئين في المكتبة.',
            ['keep', 'read', 'run'], 0, 'يقول النص: we have to keep quiet there، أي في المكتبة.'),
        ],
      },
      compositions: [
        {
          source: 'book',
          topic: 'Write your classroom rules.',
          topicAr: 'اكتب قواعد صفّك.',
          words: 40,
          points: ['We have to …', 'We …', 'We …'],
          pointsAr: ['يجب علينا أن …', 'نحن …', 'نحن …'],
          plan: [
            { en: 'Start: say that these are your classroom rules.', ar: 'ابدأ: قل إن هذه قواعد صفّك.' },
            { en: 'Write the things you have to do: We have to …', ar: 'اكتب الأشياء التي يجب أن تفعلها: We have to …' },
            { en: "End with one thing you don't have to do: We don't have to …", ar: 'اختم بشيء ليس عليك أن تفعله: We don’t have to …' },
          ],
          phrases: [
            { en: 'classroom rules', ar: 'قواعد الصف' },
            { en: 'arrive on time', ar: 'نصل في الوقت المحدّد' },
            { en: 'listen to the teacher', ar: 'نصغي إلى المعلّم' },
            { en: 'raise our hands', ar: 'نرفع أيدينا' },
            { en: 'be quiet', ar: 'نكون هادئين' },
            { en: 'keep our classroom clean', ar: 'نحافظ على نظافة صفّنا' },
            { en: 'say please and thank you', ar: 'نقول من فضلك وشكراً' },
            { en: "don't have to", ar: 'ليس علينا أن' },
          ],
          model: "These are our classroom rules. We have to arrive on time. We have to listen to the teacher. We have to raise our hands before speaking. We have to be quiet in the classroom. We have to keep our classroom clean. We have to say please and thank you. We don't have to do our homework at school.",
          modelAr: 'هذه قواعد صفّنا. يجب أن نصل في الوقت المحدّد. يجب أن نصغي إلى المعلّم. يجب أن نرفع أيدينا قبل أن نتكلّم. يجب أن نكون هادئين في الصف. يجب أن نحافظ على نظافة صفّنا. يجب أن نقول من فضلك وشكراً. ليس علينا أن نكتب وظائفنا في المدرسة.',
          checklistAr: [
            'بدأتُ بجملة تقول إن هذه قواعد الصف.',
            'كتبتُ ثلاث قواعد على الأقل بـ We have to.',
            'بعد have to كتبتُ الفعل بلا s.',
            'استعملتُ don’t have to لشيء ليس علينا فعله.',
            'بدأتُ كل جملة بحرف كبير وأنهيتُها بنقطة.',
          ],
        },
      ],
      translations: [
        { en: 'I have to leave my mobile phone at home.', ar: 'يجب أن أترك هاتفي المحمول في البيت.' },
        { en: 'I have to raise my hand before speaking.', ar: 'يجب أن أرفع يدي قبل أن أتكلّم.' },
        { en: 'I have to keep my classroom clean.', ar: 'يجب أن أحافظ على نظافة صفّي.' },
        { en: 'My new school is very big.', ar: 'مدرستي الجديدة كبيرة جداً.' },
        { en: 'I have science in the science lab.', ar: 'أدرس العلوم في مخبر العلوم.' },
        { en: 'Don’t run in the corridor, you have to walk.', ar: 'لا تركض في الممرّ، يجب أن تمشي.' },
        { en: 'I have to listen to the teacher.', ar: 'يجب أن أصغي إلى المعلّم.' },
        { en: 'You don’t have to bring a sandwich with you.', ar: 'ليس عليك أن تُحضر معك شطيرة.' },
        { en: 'In Britain, children go to nursery school when they are three.', ar: 'في بريطانيا، يذهب الأطفال إلى الروضة عندما يصبح عمرهم ثلاث سنوات.' },
      ],
    },

    // ===================== UNIT 2 — Family (Activity Book pages 8–10) =====================
    u2: {
      workbook: {
        pages: '8–10',
        readings: [
          {
            title: 'My Mother',
            paragraphs: [
              'My mother is 38 years old. She is kind and beautiful. She has got short brown hair. She works as a teacher in a school. She cooks very well. She does all the housework. She often helps me do my homework. She sometimes plays with me. She loves my brother and me very much. I love my mother, she is the best.',
            ],
            paragraphsAr: [
              'عمر أمي 38 سنة. هي لطيفة وجميلة. لها شعر بنّي قصير. تعمل معلّمةً في مدرسة. تطبخ جيداً جداً. تقوم بكل أعمال البيت. غالباً ما تساعدني في وظائفي. وأحياناً تلعب معي. تحبّ أخي وتحبّني كثيراً. أنا أحبّ أمي، إنها الأفضل.',
            ],
            questions: [
              {
                q: "What is the mother's job?", qAr: 'ما عمل الأم؟',
                options: ['She is a teacher.', 'She is a nurse.', 'She is a doctor.', 'She is a pupil.'],
                answer: 0, explainAr: 'يقول النص: She works as a teacher in a school، أي هي معلّمة.',
              },
              {
                q: "What is the mother's hair like?", qAr: 'كيف شعر الأم؟',
                options: ['long and black', 'short and brown', 'short and black', 'long and brown'],
                answer: 1, explainAr: 'يقول النص: She has got short brown hair، أي شعرها بنّي قصير.',
              },
              {
                q: 'What does the mother often do?', qAr: 'ماذا تفعل الأم غالباً؟',
                options: ['She plays football.', 'She goes to bed late.', 'She helps me do my homework.', 'She chats online.'],
                answer: 2, explainAr: 'يقول النص: She often helps me do my homework. كلمة often تعني «غالباً».',
              },
            ],
          },
        ],
        exercises: [
          // ex. 1a — choose the correct word
          fill('My mother ___ 38 years old.', 'أمي ___ 38 سنة.', 'أمي عمرها 38 سنة.', ['is', 'are', 'am'], 0,
            'My mother = she، ومع she نستعمل is.'),
          fill('She ___ got short hair.', 'هي ___ شعراً قصيراً.', 'هي تملك شعراً قصيراً.', ['have', 'has', 'having'], 1,
            'مع he / she / it نقول has got، ومع I / you / we / they نقول have got.'),
          fill('She ___ as a teacher.', 'هي ___ معلّمةً.', 'هي تعمل معلّمةً.', ['work', 'works', 'working'], 1,
            'مع she نضيف s إلى الفعل في المضارع البسيط: she works.'),
          fill('She can ___ very well.', 'هي تستطيع أن ___ جيداً جداً.', 'هي تستطيع أن تطبخ جيداً جداً.', ['cook', 'cooks', 'cooking'], 0,
            'بعد can يأتي الفعل بلا s: can cook.'),
          fill('She loves my brother and ___.', 'تحبّ أخي و___.', 'تحبّ أخي وتحبّني.', ['me', 'my', 'I'], 0,
            'بعد الفعل loves نستعمل me (أنا مفعولاً به). أمّا my فتأتي قبل اسم، مثل my brother.'),
          // ex. 1b — cross the odd word out
          mcq('Cross the odd word out: women / men / children / girl', 'احذف الكلمة المختلفة: نساء / رجال / أطفال / بنت', ['women', 'men', 'children', 'girl'], 3,
            'girl مفرد (بنت واحدة)، والكلمات الأخرى كلها جمع.'),
          mcq('Cross the odd word out: niece / nephew / friend / cousin', 'احذف الكلمة المختلفة: ابنة الأخ / ابن الأخ / صديق / ابن العم', ['niece', 'nephew', 'friend', 'cousin'], 2,
            'friend (صديق) ليس من أفراد العائلة، والكلمات الأخرى كلها أقارب.'),
          mcq('Cross the odd word out: mother / son / daughter / granddaughter', 'احذف الكلمة المختلفة: أم / ابن / ابنة / حفيدة', ['mother', 'son', 'daughter', 'granddaughter'], 1,
            'son (ابن) هو الوحيد المذكّر، والكلمات الأخرى كلها لإناث.'),
          mcq('Cross the odd word out: brother / grandfather / sister / uncle', 'احذف الكلمة المختلفة: أخ / جدّ / أخت / عمّ', ['brother', 'grandfather', 'sister', 'uncle'], 2,
            'sister (أخت) هي الوحيدة المؤنّثة، والكلمات الأخرى كلها لذكور.'),
          // ex. 2 — complete the family picture: Henry and Anais, and their children Robin and Elsa
          fill("My family: Anais is the mother. She is Henry's ___.", 'عائلتي: أنايس هي الأم. هي ___ هنري.', 'عائلتي: أنايس هي الأم. هي زوجة هنري.',
            ['husband', 'wife', 'daughter', 'sister'], 1, 'الأم متزوّجة من الأب، فهي زوجته: wife. أمّا husband فهو الزوج.'),
          fill("My family: Henry is Anais's husband and the children's ___.", 'عائلتي: هنري زوج أنايس و___ الأولاد.', 'عائلتي: هنري زوج أنايس وأبو الأولاد.',
            ['brother', 'uncle', 'father', 'son'], 2, 'زوج الأم هو أبو الأولاد: father.'),
          fill("My family: Robin is Elsa's brother and Anais's ___.", 'عائلتي: روبن أخو إلسا و___ أنايس.', 'عائلتي: روبن أخو إلسا وابن أنايس.',
            ['son', 'daughter', 'husband', 'nephew'], 0, 'روبن ولد وأمّه أنايس، فهو ابنها: son.'),
          fill("My family: Elsa is Henry's daughter and Robin's ___.", 'عائلتي: إلسا ابنة هنري و___ روبن.', 'عائلتي: إلسا ابنة هنري وأخت روبن.',
            ['brother', 'sister', 'mother', 'wife'], 1, 'إلسا بنت، وروبن أخوها، فهي أخته: sister.'),
          fill("My family: Anais and Henry are Robin and Elsa's ___.", 'عائلتي: أنايس وهنري هما ___ روبن وإلسا.', 'عائلتي: أنايس وهنري هما والدا روبن وإلسا.',
            ['children', 'parents', 'cousins', 'grandparents'], 1, 'الأم والأب معاً هما الوالدان: parents. وروبن وإلسا هما الأولاد: children.'),
          // ex. 3 — guess who?
          fill('My mother has a baby girl. She is her ___.', 'أمي عندها طفلة صغيرة. هي ___ أمي.', 'أمي عندها طفلة صغيرة. هي ابنة أمي.',
            ['sister', 'daughter', 'niece', 'aunt'], 1, 'البنت الصغيرة التي أنجبتها أمي هي ابنتها: daughter.'),
          fill('My son calls me ___.', 'ابني يناديني ___.', 'ابني يناديني أبي.', ['brother', 'cousin', 'father', 'nephew'], 2,
            'الابن ينادي أباه: father. (ولو كانت المتكلّمة أمّاً لقال: mother.)'),
          fill("My mother is my father's ___.", 'أمي هي ___ أبي.', 'أمي هي زوجة أبي.', ['wife', 'husband', 'sister', 'daughter'], 0,
            'الأم هي زوجة الأب: wife.'),
          fill("My father is my mother's ___.", 'أبي هو ___ أمي.', 'أبي هو زوج أمي.', ['wife', 'brother', 'husband', 'son'], 2,
            'الأب هو زوج الأم: husband.'),
          fill('My father has got one sister. She is my ___.', 'لأبي أخت واحدة. هي ___.', 'لأبي أخت واحدة. هي عمّتي.', ['uncle', 'aunt', 'niece', 'cousin'], 1,
            'أخت الأب هي العمّة: aunt.'),
          fill("My mother has got a brother. He's my ___.", 'لأمي أخ. هو ___.', 'لأمي أخ. هو خالي.', ['uncle', 'aunt', 'nephew', 'grandfather'], 0,
            'أخو الأم هو الخال: uncle. (وأخو الأب أيضاً uncle.)'),
          fill('My grandfather is married to my ___.', 'جدّي متزوّج من ___.', 'جدّي متزوّج من جدّتي.', ['aunt', 'mother', 'sister', 'grandmother'], 3,
            'زوجة الجدّ هي الجدّة: grandmother.'),
          fill('My grandparents call me their ___.', 'جدّي وجدّتي ينادياني: ___.', 'جدّي وجدّتي ينادياني: حفيدنا.', ['nephew', 'grandson', 'cousin', 'uncle'], 1,
            'أنا ابن ابنهما، فأنا حفيدهما: grandson (والبنت granddaughter).'),
          fill('My sister has two children, a boy and a girl. Her son is my ___.', 'لأختي ولدان، صبي وبنت. ابنها هو ___.', 'لأختي ولدان، صبي وبنت. ابنها هو ابن أختي.',
            ['nephew', 'niece', 'cousin', 'uncle'], 0, 'ابن الأخت أو ابن الأخ هو nephew.'),
          fill('My sister has two children, a boy and a girl. Her daughter is my ___.', 'لأختي ولدان، صبي وبنت. ابنتها هي ___.', 'لأختي ولدان، صبي وبنت. ابنتها هي ابنة أختي.',
            ['nephew', 'aunt', 'niece', 'cousin'], 2, 'ابنة الأخت أو ابنة الأخ هي niece.'),
          fill("My uncle and aunt's children are my ___.", 'أولاد عمّي وعمّتي هم ___.', 'أولاد عمّي وعمّتي هم أبناء عمومتي.',
            ['nephews', 'cousins', 'grandchildren', 'parents'], 1, 'أولاد العمّ والعمّة والخال والخالة هم cousins.'),
          // ex. 4 — write the plural
          fill('Write the plural: man → ___', 'اكتب الجمع: رجل ← ___', 'اكتب الجمع: رجل ← رجال', ['mans', 'men', 'mens'], 1,
            'جمع man غير نظامي: men، ولا نضيف s.'),
          fill('Write the plural: woman → ___', 'اكتب الجمع: امرأة ← ___', 'اكتب الجمع: امرأة ← نساء', ['women', 'womans', 'womens'], 0,
            'جمع woman غير نظامي: women.'),
          fill('Write the plural: child → ___', 'اكتب الجمع: طفل ← ___', 'اكتب الجمع: طفل ← أطفال', ['childs', 'childrens', 'children'], 2,
            'جمع child غير نظامي: children.'),
          fill('Write the plural: wife → ___', 'اكتب الجمع: زوجة ← ___', 'اكتب الجمع: زوجة ← زوجات', ['wifes', 'wives', 'wifies'], 1,
            'الكلمة التي تنتهي بـ fe نحوّلها إلى ves: wife ← wives.'),
          fill('Write the plural: person → ___', 'اكتب الجمع: شخص ← ___', 'اكتب الجمع: شخص ← أشخاص', ['people', 'peoples', 'personses'], 0,
            'جمع person غير نظامي: people.'),
          fill('Write the plural: family → ___', 'اكتب الجمع: عائلة ← ___', 'اكتب الجمع: عائلة ← عائلات', ['familys', 'familyes', 'families'], 2,
            'الكلمة التي تنتهي بحرف ساكن + y نحوّل y إلى ies: family ← families.'),
          // ex. 6 — look and say: Molly's things and Fred's things
          fill('Look and say: Molly has got a doll. It is ___ doll.', 'انظر وقل: عند مولي دمية. إنها دمية ___.', 'انظر وقل: عند مولي دمية. إنها دمية مولي.',
            ["Molly's", 'Mollys', "Mollys'"], 0, 'للملكية نضيف ’s إلى اسم المالك: Molly’s doll.'),
          fill('Look and say: Fred has got a skateboard. It is ___ skateboard.', 'انظر وقل: عند فريد لوح تزلّج. إنه لوح تزلّج ___.', 'انظر وقل: عند فريد لوح تزلّج. إنه لوح تزلّج فريد.',
            ['Fred', "Fred's", "Freds'"], 1, 'للملكية نضيف ’s إلى اسم المالك: Fred’s skateboard.'),
          // ex. 7 — write ('s) or (')
          fill('Write (\'s) or (\'): My friend___ pet is a golden fish.', 'اكتب (\'s) أو (\'): حيوان ___ الأليف سمكة ذهبية.', 'اكتب (\'s) أو (\'): حيوان صديقي الأليف سمكة ذهبية.',
            ["'s", "'", "s'"], 0, 'friend مفرد، فنضيف ’s: my friend’s pet.'),
          fill('Write (\'s) or (\'): Tom and Jerry___ jokes are funny.', 'اكتب (\'s) أو (\'): نكات ___ مضحكة.', 'اكتب (\'s) أو (\'): نكات توم وجيري مضحكة.',
            ["'", "'s", "s'"], 1, 'عندما يملك شخصان الشيء نفسه نضع ’s بعد الاسم الأخير فقط: Tom and Jerry’s jokes.'),
          fill('Write (\'s) or (\'): The pupils___ uniform is blue.', 'اكتب (\'s) أو (\'): زيّ ___ أزرق.', 'اكتب (\'s) أو (\'): زيّ التلاميذ أزرق.',
            ["'s", "'", 's'], 1, 'pupils جمع ينتهي بـ s، فنضيف ’ فقط: the pupils’ uniform، مثل the students’ books.'),
          fill('Write (\'s) or (\'): ___ glasses are expensive.', 'اكتب (\'s) أو (\'): نظّارة ___ غالية.', 'اكتب (\'s) أو (\'): نظّارة تشارلز غالية.',
            ["Charles's", "Charle's", 'Charles'], 0, 'Charles اسم شخص واحد، وفي كتاب التلميذ: Charles’s mother. (ويُقبل أيضاً Charles’ لأن الاسم ينتهي بـ s.)'),
          fill('Write (\'s) or (\'): Ted___ trainers are lost.', 'اكتب (\'s) أو (\'): حذاء ___ الرياضي ضائع.', 'اكتب (\'s) أو (\'): حذاء تيد الرياضي ضائع.',
            ["'", "s'", "'s"], 2, 'Ted اسم مفرد لا ينتهي بـ s، فنضيف ’s: Ted’s trainers.'),
        ],
      },
      compositions: [
        {
          source: 'book',
          topic: 'Complete the text about you.',
          topicAr: 'أكمل النص عن نفسك.',
          words: 40,
          points: ['My name is …', 'My mother’s name is … She is a / an …', 'My father’s name is … He is a / an …', 'My grandmother’s name is … My grandfather’s name is …', 'My sister’s name is … My brother’s name is …', 'I have a pet. It is a … My pet’s name is …'],
          pointsAr: ['اسمي …', 'اسم أمي … هي …', 'اسم أبي … هو …', 'اسم جدّتي … اسم جدّي …', 'اسم أختي … اسم أخي …', 'عندي حيوان أليف. إنه … اسمه …'],
          plan: [
            { en: 'Say your name and how old you are.', ar: 'قل اسمك وكم عمرك.' },
            { en: "Write your parents' names and their jobs.", ar: 'اكتب اسمَي والديك وعملهما.' },
            { en: 'Write about your grandparents, sisters and brothers.', ar: 'اكتب عن جدّك وجدّتك وإخوتك وأخواتك.' },
            { en: 'End with your pet and its name.', ar: 'اختم بحيوانك الأليف واسمه.' },
          ],
          phrases: [
            { en: 'My name is', ar: 'اسمي' },
            { en: 'years old', ar: 'من العمر (سنة)' },
            { en: "My mother's name is", ar: 'اسم أمي' },
            { en: "My father's name is", ar: 'اسم أبي' },
            { en: "My grandmother's name is", ar: 'اسم جدّتي' },
            { en: "My sister's name is", ar: 'اسم أختي' },
            { en: 'I have a pet', ar: 'عندي حيوان أليف' },
            { en: "My pet's name is", ar: 'اسم حيواني الأليف' },
          ],
          model: "My name is Sami. I'm ten years old. My mother's name is Rasha. She is a teacher. My father's name is Omar. He is a doctor. My grandmother's name is Salma. My grandfather's name is Adel. My sister's name is Lama. She is a pupil. I have a pet. It is a cat. My pet's name is Lucy.",
          modelAr: 'اسمي سامي. عمري عشر سنوات. اسم أمي رشا. هي معلّمة. اسم أبي عمر. هو طبيب. اسم جدّتي سلمى. اسم جدّي عادل. اسم أختي لمى. هي تلميذة. عندي حيوان أليف. إنه قطة. اسم قطّتي لوسي.',
          checklistAr: [
            'كتبتُ اسمي وعمري.',
            'كتبتُ أسماء أفراد عائلتي وأعمالهم.',
            'استعملتُ ’s للملكية: My mother’s name.',
            'استعملتُ She is مع الأم والأخت، وHe is مع الأب والأخ.',
            'استعملتُ a قبل الكلمة التي تبدأ بحرف ساكن وan قبل الحرف الصوتي.',
          ],
        },
        {
          source: 'workbook',
          topic: 'Write about your family.',
          topicAr: 'اكتب عن عائلتك.',
          words: 40,
          points: ['family members', 'pets'],
          pointsAr: ['أفراد العائلة', 'الحيوانات الأليفة'],
          plan: [
            { en: 'Say if you come from a big or a small family.', ar: 'قل إن كانت عائلتك كبيرة أم صغيرة.' },
            { en: 'Describe your family members: names and what they are like.', ar: 'صف أفراد عائلتك: أسماءهم وكيف هم.' },
            { en: 'Write about your pets.', ar: 'اكتب عن حيواناتك الأليفة.' },
            { en: 'End with how you feel about your family.', ar: 'اختم بشعورك نحو عائلتك.' },
          ],
          phrases: [
            { en: 'I come from a big family', ar: 'أنا من عائلة كبيرة' },
            { en: 'very funny', ar: 'مضحك جداً' },
            { en: 'kind and beautiful', ar: 'لطيفة وجميلة' },
            { en: "I've got one brother", ar: 'عندي أخ واحد' },
            { en: 'My grandparents', ar: 'جدّي وجدّتي' },
            { en: "We've got two pets", ar: 'عندنا حيوانان أليفان' },
            { en: 'a cat called', ar: 'قطة اسمها' },
            { en: 'I love my family', ar: 'أحبّ عائلتي' },
          ],
          model: "I come from a big family. My father's name is Adel. He is tall and he is very funny. My mother's name is Rasha. She is kind and beautiful. I've got one brother and two sisters. My grandparents are Omar and Salma. We've got two pets, a cat called Lucy and a dog called Puppy. I love my family.",
          modelAr: 'أنا من عائلة كبيرة. اسم أبي عادل. هو طويل ومضحك جداً. اسم أمي رشا. هي لطيفة وجميلة. عندي أخ واحد وأختان. جدّي وجدّتي هما عمر وسلمى. عندنا حيوانان أليفان، قطة اسمها لوسي وكلب اسمه بابي. أنا أحبّ عائلتي.',
          checklistAr: [
            'قلتُ إن عائلتي كبيرة أو صغيرة.',
            'كتبتُ عن أفراد عائلتي ووصفتُهم.',
            'كتبتُ عن الحيوانات الأليفة.',
            'استعملتُ has got / have got و’s للملكية بشكل صحيح.',
            'بدأتُ كل جملة بحرف كبير وأنهيتُها بنقطة.',
          ],
        },
      ],
      translations: [
        { en: 'My mother is 38 years old.', ar: 'عمر أمي 38 سنة.' },
        { en: 'She has got short brown hair.', ar: 'لها شعر بنّي قصير.' },
        { en: 'She works as a teacher in a school.', ar: 'تعمل معلّمةً في مدرسة.' },
        { en: 'She often helps me do my homework.', ar: 'غالباً ما تساعدني في وظائفي.' },
        { en: 'I love my mother, she is the best.', ar: 'أحبّ أمي، إنها الأفضل.' },
        { en: 'My father is tall and he is a very funny person.', ar: 'أبي طويل وهو شخص مضحك جداً.' },
        { en: 'I come from a small family.', ar: 'أنا من عائلة صغيرة.' },
        { en: "I've got one brother and two sisters.", ar: 'عندي أخ واحد وأختان.' },
        { en: "Those are the children's toys.", ar: 'تلك ألعاب الأطفال.' },
      ],
    },

    // ===================== UNIT 3 — Daily Routine (Activity Book pages 11–13) =====================
    u3: {
      workbook: {
        pages: '11–13',
        readings: [
          {
            title: "Emma's Day",
            paragraphs: [
              'Hi! I am Emma. I am a nurse. I usually (1) wakes up at 6:30, but at weekends, I (2) not get up early. I brush my teeth and have breakfast. Then I get dressed and go to work. I (3) doesn’t have a car, so I go to hospital with my friend, Sally, in her car.',
              'Sally and I (4) starts work at 8:00. We (5) helps doctors and take care of sick people. We always have lunch break at 1:00. We go back home at 5:00. I take a shower and Sally sets the table, then we have dinner at 6:30. In the evening, I watch TV. and Sally (7) read a book. We go to bed at 10:00. What (8) does you do in your day?',
            ],
            paragraphsAr: [
              'مرحباً! أنا إيما. أنا ممرّضة. عادةً أستيقظ في السادسة والنصف، لكن في عطلة نهاية الأسبوع لا أنهض باكراً. أفرّش أسناني وأتناول الفطور. ثم ألبس ثيابي وأذهب إلى العمل. ليس عندي سيارة، لذلك أذهب إلى المستشفى مع صديقتي سالي في سيارتها. (الأرقام في النص تدلّ على الأخطاء التي ستصحّحها.)',
              'أنا وسالي نبدأ العمل في الثامنة. نساعد الأطباء ونعتني بالمرضى. دائماً نأخذ استراحة الغداء في الواحدة. نعود إلى البيت في الخامسة. أستحمّ وتجهّز سالي المائدة، ثم نتناول العشاء في السادسة والنصف. في المساء أشاهد التلفاز وتقرأ سالي كتاباً. ننام في العاشرة. وأنت، ماذا تفعل في يومك؟',
            ],
            questions: [
              {
                q: "Fill in Emma's daily routine: When does Emma brush her teeth and get dressed?", qAr: 'أكمل برنامج إيما اليومي: متى تفرّش إيما أسنانها وتلبس ثيابها؟',
                options: ['In the morning', 'In the afternoon', 'In the evening'],
                answer: 0, explainAr: 'تفعل ذلك بعد أن تستيقظ وقبل أن تذهب إلى العمل، أي في الصباح.',
              },
              {
                q: "Fill in Emma's daily routine: When does Emma go back home?", qAr: 'أكمل برنامج إيما اليومي: متى تعود إيما إلى البيت؟',
                options: ['In the morning', 'In the afternoon', 'In the evening'],
                answer: 1, explainAr: 'تعود إلى البيت في الساعة الخامسة (5:00)، وهذا بعد الظهر.',
              },
              {
                q: "Fill in Emma's daily routine: When does Emma watch TV?", qAr: 'أكمل برنامج إيما اليومي: متى تشاهد إيما التلفاز؟',
                options: ['In the morning', 'In the afternoon', 'In the evening'],
                answer: 2, explainAr: 'يقول النص: In the evening, I watch TV.',
              },
              {
                q: 'What does Sally do in the evening?', qAr: 'ماذا تفعل سالي في المساء؟',
                options: ['She reads a book.', 'She watches TV.', 'She goes to work.', 'She wakes up.'],
                answer: 0, explainAr: 'في المساء تشاهد إيما التلفاز، أمّا سالي فتقرأ كتاباً: Sally reads a book.',
              },
            ],
          },
        ],
        exercises: [
          // ex. 1 — read and match the routines with the pictures
          ...u3RoutineItems,
          // ex. 2 — reorder the sentences
          ...u3OrderItems(),
          // ex. 3 — what time is it?
          ...u3TimeItems,
          // ex. 5 — look at the chart and fill in the frequency adverbs
          fill('Dana ___ early in the morning. (Get up: ✓ ✓ ✓ ✓ ✓)', 'دانا ___ باكراً في الصباح. (كل الأيام ✓)', 'دانا تنهض دائماً باكراً في الصباح.',
            ['always gets up', 'never gets up', 'always get up', 'sometimes gets up'], 0,
            'خمس علامات ✓ من خمسة أيام = always. ومع she نضيف s: gets up.'),
          fill('She ___ her bag in the evening. (Pack: ✓ ✓ ✓ ✓ ✗)', 'هي ___ حقيبتها في المساء. (أربعة أيام ✓ ويوم ✗)', 'هي عادةً تجهّز حقيبتها في المساء.',
            ['always packs', 'usually packs', 'usually pack', 'never packs'], 1,
            'أربعة أيام من خمسة = usually. ومع she نضيف s: packs.'),
          fill('She ___ on foot. (Go to school: ✓ ✗ ✓ ✗ ✓)', 'هي ___ سيراً على الأقدام. (يوم ✓ ويوم ✗)', 'هي أحياناً تذهب إلى المدرسة سيراً على الأقدام.',
            ['always goes to school', 'sometimes go to school', 'sometimes goes to school', 'never goes to school'], 2,
            'يوم نعم ويوم لا = sometimes. ومع she نضيف es: goes.'),
          fill('She ___ television at night. (Watch: ✗ ✗ ✗ ✗ ✗)', 'هي ___ التلفاز في الليل. (كل الأيام ✗)', 'هي لا تشاهد التلفاز في الليل أبداً.',
            ['never watches', 'always watches', 'never watch', 'usually watches'], 0,
            'لا توجد أي علامة ✓ = never. ومع she نضيف es: watches.'),
          // ex. 6a — correct the underlined mistakes in Emma's text (the book prints no number 6)
          fill('Correct the mistake (1): I usually ___ up at 6:30.', 'صحّح الخطأ (1): عادةً ___ في السادسة والنصف.', 'صحّح الخطأ (1): عادةً أستيقظ في السادسة والنصف.',
            ['wakes', 'wake', 'waking'], 1, 'مع I لا نضيف s إلى الفعل: I wake up.'),
          fill('Correct the mistake (2): At weekends, I ___ get up early.', 'صحّح الخطأ (2): في عطلة نهاية الأسبوع ___ باكراً.', 'صحّح الخطأ (2): في عطلة نهاية الأسبوع لا أنهض باكراً.',
            ['not', "don't", "doesn't"], 1, 'النفي مع I يكون بـ don’t + الفعل: I don’t get up.'),
          fill('Correct the mistake (3): I ___ have a car.', 'صحّح الخطأ (3): ___ سيارة.', 'صحّح الخطأ (3): ليس عندي سيارة.',
            ["doesn't", "don't", 'not'], 1, 'مع I نستعمل don’t، أمّا doesn’t فهي لـ he / she / it.'),
          fill('Correct the mistake (4): Sally and I ___ work at 8:00.', 'صحّح الخطأ (4): أنا وسالي ___ العمل في الثامنة.', 'صحّح الخطأ (4): أنا وسالي نبدأ العمل في الثامنة.',
            ['starts', 'start', 'starting'], 1, 'Sally and I = we، ومع we لا نضيف s: start.'),
          fill('Correct the mistake (5): We ___ doctors and take care of sick people.', 'صحّح الخطأ (5): ___ الأطباء ونعتني بالمرضى.', 'صحّح الخطأ (5): نساعد الأطباء ونعتني بالمرضى.',
            ['help', 'helps', 'helping'], 0, 'مع we لا نضيف s: we help.'),
          fill('Correct the mistake (7): In the evening, I watch TV and Sally ___ a book.', 'صحّح الخطأ (7): في المساء أشاهد التلفاز وسالي ___ كتاباً.', 'صحّح الخطأ (7): في المساء أشاهد التلفاز وسالي تقرأ كتاباً.',
            ['read', 'reading', 'reads'], 2, 'Sally = she، ومع she نضيف s: reads.'),
          fill('Correct the mistake (8): What ___ you do in your day?', 'صحّح الخطأ (8): ماذا ___ في يومك؟', 'صحّح الخطأ (8): ماذا تفعل في يومك؟',
            ['does', 'do', 'are'], 1, 'مع you نسأل بـ do: What do you do?'),
        ],
      },
      compositions: [
        {
          source: 'book',
          topic: 'Write sentences a bout your daily routine.',
          topicAr: 'اكتب جملاً عن برنامجك اليومي.',
          words: 40,
          points: ['I usually wake up at six o’clock in the morning.', 'I sometimes …', 'I … in the afternoon.', 'I …'],
          pointsAr: ['عادةً أستيقظ في السادسة صباحاً.', 'أحياناً …', 'أنا … بعد الظهر.', 'أنا …'],
          plan: [
            { en: 'Start with the morning: when you wake up.', ar: 'ابدأ بالصباح: متى تستيقظ.' },
            { en: 'Write what you do in the afternoon.', ar: 'اكتب ماذا تفعل بعد الظهر.' },
            { en: 'End with the evening and bedtime.', ar: 'اختم بالمساء ووقت النوم.' },
          ],
          phrases: [
            { en: 'wake up', ar: 'أستيقظ' },
            { en: 'have a shower', ar: 'أستحمّ' },
            { en: 'pack my bag', ar: 'أجهّز حقيبتي' },
            { en: 'do my homework', ar: 'أكتب وظائفي' },
            { en: 'in the afternoon', ar: 'بعد الظهر' },
            { en: 'go to bed late', ar: 'أنام متأخراً' },
            { en: 'usually', ar: 'عادةً' },
            { en: 'sometimes', ar: 'أحياناً' },
          ],
          model: "I usually wake up at six o'clock in the morning. I sometimes have a shower before breakfast. I always pack my bag and go to school at seven o'clock. I usually do my homework in the afternoon. I never go to bed late. I always sleep at nine o'clock.",
          modelAr: 'عادةً أستيقظ في السادسة صباحاً. أحياناً أستحمّ قبل الفطور. دائماً أجهّز حقيبتي وأذهب إلى المدرسة في السابعة. عادةً أكتب وظائفي بعد الظهر. لا أنام متأخراً أبداً. دائماً أنام في التاسعة.',
          checklistAr: [
            'كتبتُ عن الصباح وبعد الظهر والمساء.',
            'استعملتُ ظروف التكرار: always, usually, sometimes, never.',
            'وضعتُ ظرف التكرار قبل الفعل: I usually wake up.',
            'مع I لم أضف s إلى الفعل.',
            'كتبتُ الوقت بشكل صحيح: at six o’clock.',
          ],
        },
        {
          source: 'workbook',
          topic: 'Write about your daily routine.',
          topicAr: 'اكتب عن برنامجك اليومي.',
          words: 40,
          points: ['In the morning, I …', 'In the afternoon, I …', 'In the evening, I …'],
          pointsAr: ['في الصباح، أنا …', 'بعد الظهر، أنا …', 'في المساء، أنا …'],
          plan: [
            { en: 'In the morning: two things you do.', ar: 'في الصباح: شيئان تفعلهما.' },
            { en: 'In the afternoon: two things you do.', ar: 'بعد الظهر: شيئان تفعلهما.' },
            { en: 'In the evening: two things you do.', ar: 'في المساء: شيئان تفعلهما.' },
          ],
          phrases: [
            { en: 'In the morning', ar: 'في الصباح' },
            { en: 'get up', ar: 'أنهض' },
            { en: 'get dressed', ar: 'ألبس ثيابي' },
            { en: 'pack my bag', ar: 'أجهّز حقيبتي' },
            { en: 'In the afternoon', ar: 'بعد الظهر' },
            { en: 'In the evening', ar: 'في المساء' },
            { en: 'set the table', ar: 'أجهّز المائدة' },
            { en: 'chat with my friends online', ar: 'أدردش مع أصدقائي على الإنترنت' },
          ],
          model: 'In the morning, I get up at half past six. I have breakfast, get dressed and pack my bag. In the afternoon, I have lunch with my family. I do my homework and I sometimes play football. In the evening, I usually set the table. I chat with my friends online, but I never go to bed late.',
          modelAr: 'في الصباح أنهض في السادسة والنصف. أتناول الفطور وألبس ثيابي وأجهّز حقيبتي. بعد الظهر أتناول الغداء مع عائلتي. أكتب وظائفي وأحياناً ألعب كرة القدم. في المساء عادةً أجهّز المائدة. أدردش مع أصدقائي على الإنترنت، لكنّي لا أنام متأخراً أبداً.',
          checklistAr: [
            'كتبتُ جملتين عن الصباح وجملتين عن بعد الظهر وجملتين عن المساء.',
            'بدأتُ كل جزء بـ In the morning / In the afternoon / In the evening.',
            'استعملتُ ظرف تكرار واحداً على الأقل.',
            'مع I لم أضف s إلى الفعل.',
            'أنهيتُ كل جملة بنقطة.',
          ],
        },
      ],
      translations: [
        { en: 'Dalia always wakes up early.', ar: 'داليا تستيقظ دائماً باكراً.' },
        { en: 'She never goes to bed late.', ar: 'هي لا تنام متأخرة أبداً.' },
        { en: 'In the evening, she sometimes chats with her friends online.', ar: 'في المساء تدردش أحياناً مع صديقاتها على الإنترنت.' },
        { en: 'I brush my teeth and have breakfast.', ar: 'أفرّش أسناني وأتناول الفطور.' },
        { en: 'Then I get dressed and go to work.', ar: 'ثم ألبس ثيابي وأذهب إلى العمل.' },
        { en: 'I go to school at twenty to eight.', ar: 'أذهب إلى المدرسة في الثامنة إلا ثلثاً.' },
        { en: 'He drinks milk in the morning.', ar: 'هو يشرب الحليب في الصباح.' },
        { en: 'I always go to bed early.', ar: 'أنا أنام دائماً باكراً.' },
        { en: 'We like to spend time together.', ar: 'نحبّ أن نقضي الوقت معاً.' },
      ],
    },

    // ===================== UNIT 4 — The Five Senses (Activity Book pages 14–16) =====================
    u4: {
      workbook: {
        pages: '14–16',
        readings: [
          {
            title: 'How to protect your senses?',
            paragraphs: [
              'To protect our senses, we should follow a healthy lifestyle, exercise, eat healthy food and avoid smoking. Also do the following:',
              'Sight - have proper lighting when reading. - wear sunglasses. - avoid looking at a screen or focusing on something close for a long time.',
              'Hearing - avoid loud sounds. - keep your ears clean.',
              'Taste - keep your teeth healthy. - reduce salt in food.',
              'Smell - Avoid strong and chemical smells - Use natural treatments',
              "Touch - keep your skin clean. - Don't touch chemicals.",
            ],
            paragraphsAr: [
              'لكي نحمي حواسّنا يجب أن نعيش حياة صحية، ونمارس الرياضة، ونأكل طعاماً صحياً، ونبتعد عن التدخين. وافعل أيضاً ما يلي:',
              'البصر: - اقرأ في ضوء مناسب. - البس نظارة شمسية. - لا تنظر إلى شاشة أو إلى شيء قريب مدة طويلة.',
              'السمع: - ابتعد عن الأصوات العالية. - حافظ على نظافة أذنيك.',
              'التذوّق: - حافظ على صحة أسنانك. - قلّل الملح في الطعام.',
              'الشمّ: - ابتعد عن الروائح القوية والكيميائية. - استعمل العلاجات الطبيعية.',
              'اللمس: - حافظ على نظافة جلدك. - لا تلمس المواد الكيميائية.',
            ],
            questions: [
              {
                q: 'How can we protect our sense of hearing?', qAr: 'كيف نحمي حاسّة السمع؟',
                options: ['Avoid loud sounds.', 'Wear sunglasses.', 'Reduce salt in food.', "Don't touch chemicals."],
                answer: 0, explainAr: 'تحت كلمة Hearing يقول النص: avoid loud sounds، أي ابتعد عن الأصوات العالية.',
              },
              {
                q: 'Which advice is for the sense of taste?', qAr: 'أيّ نصيحة هي لحاسّة التذوّق؟',
                options: ['Keep your ears clean.', 'Keep your teeth healthy.', 'Keep your skin clean.', 'Have proper lighting when reading.'],
                answer: 1, explainAr: 'تحت كلمة Taste يقول النص: keep your teeth healthy و reduce salt in food.',
              },
              {
                q: 'Which advice is for the sense of sight?', qAr: 'أيّ نصيحة هي لحاسّة البصر؟',
                options: ['Use natural treatments.', 'Avoid loud sounds.', 'Wear sunglasses.', 'Reduce salt in food.'],
                answer: 2, explainAr: 'تحت كلمة Sight يقول النص: wear sunglasses، أي البس نظارة شمسية.',
              },
            ],
            trueFalse: [
              { statement: "We shouldn't look at the sun.", answer: true },
              { statement: "It's good to hear loud sounds.", answer: false },
              { statement: 'A lot of salt can affect the sense of smell.', answer: false },
              { statement: 'Watching TV for a long time is bad for your eyes.', answer: true },
              { statement: 'Healthy teeth help you to taste better.', answer: true },
            ],
          },
        ],
        exercises: [
          // ex. 1b — fill in the spaces with the words in the box
          fill('Always wear a ___ when you are walking in the sun.', 'البس دائماً ___ عندما تمشي في الشمس.', 'البس دائماً قبّعة عندما تمشي في الشمس.',
            ['shade', 'hat', 'sun cream'], 1, 'نلبس القبّعة (hat) على رأسنا في الشمس. ونقول a hat لأنها شيء واحد.'),
          fill('___ will help you to protect your eyes from the sun.', '___ ستساعدك على حماية عينيك من الشمس.', 'النظارة الشمسية ستساعدك على حماية عينيك من الشمس.',
            ['Sun cream', 'Sunglasses', 'Clothes'], 1, 'النظارة الشمسية (sunglasses) تحمي العينين.'),
          fill('Apply a lot of ___ to protect your skin.', 'ضع كثيراً من ___ لتحمي جلدك.', 'ضع كثيراً من الكريم الواقي من الشمس لتحمي جلدك.',
            ['sunglasses', 'hat', 'sun cream'], 2, 'الكريم الواقي من الشمس (sun cream) ندهنه على الجلد.'),
          fill('Wear cotton ___ to protect your body skin.', 'البس ___ قطنية لتحمي جلد جسمك.', 'البس ملابس قطنية لتحمي جلد جسمك.',
            ['clothes', 'sunglasses', 'shade'], 0, 'الملابس القطنية (cotton clothes) تغطّي الجسم وتحميه.'),
          fill('Play in the ___ to protect yourself from the sun.', 'العب في ___ لتحمي نفسك من الشمس.', 'العب في الظلّ لتحمي نفسك من الشمس.',
            ['shade', 'hat', 'sunglasses'], 0, 'الظلّ (shade) مكان لا تصل إليه الشمس.'),
          // ex. 2 — match the sentences with the parts of the body
          fill('You look happy. → ___', 'تبدو سعيداً. ← ___', 'تبدو سعيداً. ← العينان', ['eyes', 'nose', 'ears', 'tongue'], 0,
            'look (يبدو / ينظر) نعرفه بالنظر، أي بالعينين: eyes.'),
          fill('The rose smells nice. → ___', 'رائحة الوردة جميلة. ← ___', 'رائحة الوردة جميلة. ← الأنف', ['hand', 'nose', 'tongue', 'eyes'], 1,
            'smell (رائحة) نعرفها بالأنف: nose.'),
          fill('The rabbit feels soft. → ___', 'ملمس الأرنب ناعم. ← ___', 'ملمس الأرنب ناعم. ← اليد', ['ears', 'eyes', 'hand', 'nose'], 2,
            'feel (ملمس) نعرفه باللمس، أي باليد: hand.'),
          fill('The music sounds loud. → ___', 'صوت الموسيقى عالٍ. ← ___', 'صوت الموسيقى عالٍ. ← الأذنان', ['tongue', 'hand', 'nose', 'ears'], 3,
            'sound (صوت) نسمعه بالأذنين: ears.'),
          fill('The pizza tastes salty. → ___', 'طعم البيتزا مالح. ← ___', 'طعم البيتزا مالح. ← اللسان', ['tongue', 'eyes', 'ears', 'hand'], 0,
            'taste (طعم) نعرفه باللسان: tongue.'),
          // ex. 3 — write do or does
          fill('When ___ you listen to slow music?', 'متى ___ إلى الموسيقى الهادئة؟', 'متى تستمع إلى الموسيقى الهادئة؟', ['do', 'does', 'are'], 0,
            'مع you نسأل بـ do.'),
          fill('Why ___ Omar feel sad?', 'لماذا ___ عمر بالحزن؟', 'لماذا يشعر عمر بالحزن؟', ['do', 'does', 'is'], 1,
            'Omar = he، ومع he / she / it نسأل بـ does.'),
          fill('Where ___ the cat sleep?', 'أين ___ القطة؟', 'أين تنام القطة؟', ['does', 'do', 'is'], 0,
            'the cat = it، ومع it نسأل بـ does.'),
          fill('How ___ they feel in the holiday?', 'كيف ___ في العطلة؟', 'كيف يشعرون في العطلة؟', ['does', 'are', 'do'], 2,
            'مع they نسأل بـ do.'),
          // ex. 4 — match the questions with the answers
          mcq('How does she eat pizza?', 'كيف تأكل البيتزا؟', ['Spicy food.', 'With a knife and fork.', 'In the morning.', 'To the supermarket.'], 1,
            'السؤال بـ How (كيف)، والجواب: With a knife and fork (بالسكين والشوكة).'),
          mcq('Where do they go?', 'إلى أين يذهبون؟', ['To the supermarket.', 'In the morning.', 'With a knife and fork.', 'Spicy food.'], 0,
            'السؤال بـ Where (أين)، والجواب مكان: To the supermarket.'),
          mcq('When do you usually listen to music?', 'متى تستمع عادةً إلى الموسيقى؟', ['Spicy food.', 'To the supermarket.', 'In the morning.', 'With a knife and fork.'], 2,
            'السؤال بـ When (متى)، والجواب وقت: In the morning.'),
          mcq('What food do you like?', 'أيّ طعام تحبّ؟', ['In the morning.', 'With a knife and fork.', 'To the supermarket.', 'Spicy food.'], 3,
            'السؤال بـ What food (أيّ طعام)، والجواب نوع طعام: Spicy food (طعام حارّ).'),
          // ex. 7 — look at the pictures (a lemon, a rabbit, a cold drink with ice, a pizza) and describe
          fill('Look and describe: The lemon tastes ___.', 'انظر وصف (صورة ليمونة): طعم الليمونة ___.', 'انظر وصف (صورة ليمونة): طعم الليمونة حامض.',
            ['soft', 'sour', 'loud'], 1, 'في كتاب التلميذ: Lemons taste sour. أي الليمون حامض.'),
          fill('Look and describe: The rabbit feels ___.', 'انظر وصف (صورة أرنب): ملمس الأرنب ___.', 'انظر وصف (صورة أرنب): ملمس الأرنب ناعم.',
            ['soft', 'sour', 'salty'], 0, 'فرو الأرنب ناعم: The rabbit feels soft.'),
          fill('Look and describe: The drink feels ___.', 'انظر وصف (صورة كأس فيه مكعّبات ثلج): الشراب ___ عند لمسه.', 'انظر وصف (صورة كأس فيه مكعّبات ثلج): الشراب بارد عند لمسه.',
            ['loud', 'bitter', 'cold'], 2, 'في الكأس ثلج، فالشراب بارد: cold.'),
          fill('Look and describe: The pizza tastes ___.', 'انظر وصف (صورة بيتزا): طعم البيتزا ___.', 'انظر وصف (صورة بيتزا): طعم البيتزا مالح.',
            ['salty', 'soft', 'loud'], 0, 'في كتاب الأنشطة: The pizza tastes salty. و soft و loud لا تصفان الطعم.'),
          // ex. 8 — put the words in the right order
          build('When does Hani travel to Damascus?', 'متى يسافر هاني إلى دمشق؟'),
          build('What food do you prefer?', 'ما الطعام الذي تفضّله؟'),
          build('What does John look like?', 'كيف يبدو جون؟ (ما شكله؟)'),
          build('Where do you play football?', 'أين تلعب كرة القدم؟'),
        ],
      },
      compositions: [
        {
          source: 'book',
          topic: 'Write about the five senses.',
          topicAr: 'اكتب عن الحواس الخمس.',
          words: 40,
          points: ['I have got five senses.', 'I smell with …'],
          pointsAr: ['عندي خمس حواس.', 'أشمّ بـ …'],
          plan: [
            { en: 'Start: I have got five senses.', ar: 'ابدأ: عندي خمس حواس.' },
            { en: 'Write which part of the body you use for each sense.', ar: 'اكتب أيّ جزء من جسمك تستعمل لكل حاسّة.' },
            { en: 'Give examples: how things smell, taste, feel or sound.', ar: 'أعطِ أمثلة: كيف رائحة الأشياء وطعمها وملمسها وصوتها.' },
          ],
          phrases: [
            { en: 'I have got five senses', ar: 'عندي خمس حواس' },
            { en: 'I smell with my nose', ar: 'أشمّ بأنفي' },
            { en: 'I see with my eyes', ar: 'أرى بعينيّ' },
            { en: 'I hear with my ears', ar: 'أسمع بأذنيّ' },
            { en: 'I taste with my tongue', ar: 'أتذوّق بلساني' },
            { en: 'smell nice', ar: 'رائحتها جميلة' },
            { en: 'taste sour', ar: 'طعمها حامض' },
            { en: 'feels soft', ar: 'ملمسها ناعم' },
          ],
          model: 'I have got five senses. I smell with my nose. I see with my eyes. I hear with my ears. I taste with my tongue. I feel with my hands. Flowers smell nice. Lemons taste sour. The cat feels soft. The music sounds loud. I use my five senses every day.',
          modelAr: 'عندي خمس حواس. أشمّ بأنفي. أرى بعينيّ. أسمع بأذنيّ. أتذوّق بلساني. ألمس بيديّ. رائحة الأزهار جميلة. طعم الليمون حامض. ملمس القطة ناعم. صوت الموسيقى عالٍ. أستعمل حواسّي الخمس كل يوم.',
          checklistAr: [
            'بدأتُ بـ I have got five senses.',
            'كتبتُ الحواس الخمس كلها: البصر والسمع والشمّ والتذوّق واللمس.',
            'استعملتُ with + جزء الجسم: I smell with my nose.',
            'أضفتُ s إلى الفعل مع المفرد: The cat feels soft.',
            'أنهيتُ كل جملة بنقطة.',
          ],
        },
        {
          source: 'workbook',
          topic: 'Complete the paragraph.',
          topicAr: 'أكمل الفقرة.',
          words: 40,
          points: ["I use my hands to feel the cat's fur."],
          pointsAr: ['أستعمل يديّ لألمس فرو القطة.'],
          plan: [
            { en: "Start with the book's sentence: I use my hands to feel the cat's fur.", ar: 'ابدأ بجملة الكتاب: أستعمل يديّ لألمس فرو القطة.' },
            { en: 'Write one sentence for each of the other senses: I use my … to …', ar: 'اكتب جملة لكل حاسّة أخرى: أستعمل … لكي …' },
            { en: 'After each one, say how the thing smells, tastes, sounds or looks.', ar: 'بعد كل جملة قل كيف رائحة الشيء أو طعمه أو صوته أو شكله.' },
          ],
          phrases: [
            { en: 'I use my hands', ar: 'أستعمل يديّ' },
            { en: "the cat's fur", ar: 'فرو القطة' },
            { en: 'It feels soft', ar: 'ملمسه ناعم' },
            { en: 'smell the flowers', ar: 'أشمّ الأزهار' },
            { en: 'It tastes sour', ar: 'طعمه حامض' },
            { en: 'It sounds loud', ar: 'صوتها عالٍ' },
            { en: 'the stars in the sky', ar: 'النجوم في السماء' },
          ],
          model: "I use my hands to feel the cat's fur. It feels soft. I use my nose to smell the flowers. They smell nice. I use my tongue to taste the lemon. It tastes sour. I use my ears to hear the music. It sounds loud. I use my eyes to see the stars in the sky.",
          modelAr: 'أستعمل يديّ لألمس فرو القطة. ملمسه ناعم. أستعمل أنفي لأشمّ الأزهار. رائحتها جميلة. أستعمل لساني لأتذوّق الليمونة. طعمها حامض. أستعمل أذنيّ لأسمع الموسيقى. صوتها عالٍ. أستعمل عينيّ لأرى النجوم في السماء.',
          checklistAr: [
            'بدأتُ بجملة الكتاب عن فرو القطة.',
            'كتبتُ عن الحواس الخمس كلها.',
            'استعملتُ I use my … to … في كل جملة.',
            'وصفتُ كل شيء بكلمة مناسبة: soft, nice, sour, loud.',
            'أنهيتُ كل جملة بنقطة.',
          ],
        },
      ],
      translations: [
        { en: 'We use our five senses every day.', ar: 'نستعمل حواسّنا الخمس كل يوم.' },
        { en: 'They help us understand and enjoy the world around us.', ar: 'تساعدنا على فهم العالم من حولنا والاستمتاع به.' },
        { en: 'We smell flowers and perfumes.', ar: 'نشمّ الأزهار والعطور.' },
        { en: 'Keep your teeth healthy.', ar: 'حافظ على صحة أسنانك.' },
        { en: 'The rose smells nice.', ar: 'رائحة الوردة جميلة.' },
        { en: 'The rabbit feels soft.', ar: 'ملمس الأرنب ناعم.' },
        { en: "I use my hands to feel the cat's fur.", ar: 'أستعمل يديّ لألمس فرو القطة.' },
        { en: 'How does the flower smell?', ar: 'كيف رائحة الزهرة؟' },
        { en: 'Healthy teeth help you to taste better.', ar: 'الأسنان السليمة تساعدك على التذوّق بشكل أفضل.' },
        { en: 'I hear loud sounds from the street.', ar: 'أسمع أصواتاً عالية من الشارع.' },
      ],
    },

    // ===================== UNIT 5 — Clothes (Activity Book pages 17–19) =====================
    u5: {
      workbook: {
        pages: '17–19',
        readings: [
          {
            title: 'Share your Treasure',
            paragraphs: [
              'Join us this Saturday to share your treasure.',
              "Before buying new clothes, let's empty our wardrobes and help the poor at the same time.",
              'Our Charity Group is organizing a sale in our schoolyard this Saturday, and we need your help.',
              'Please donate the clothes that you do not need to the charity in order to be sold at cheap prices. We will help the poor families in our community.',
              'We look forward to seeing you there.',
            ],
            paragraphsAr: [
              'انضمّوا إلينا يوم السبت هذا لتتشاركوا كنوزكم.',
              'قبل أن نشتري ملابس جديدة، لنُفرغ خزائننا ونساعد الفقراء في الوقت نفسه.',
              'مجموعتنا الخيرية تنظّم سوقاً للبيع في ساحة مدرستنا يوم السبت هذا، ونحن بحاجة إلى مساعدتكم.',
              'من فضلكم تبرّعوا للجمعية الخيرية بالملابس التي لا تحتاجونها، لكي تُباع بأسعار رخيصة. سنساعد العائلات الفقيرة في مجتمعنا.',
              'ننتظر بشوق أن نراكم هناك.',
            ],
            questions: [
              {
                q: 'What does the word "donate" mean?', qAr: 'ما معنى كلمة «donate»؟',
                options: ['to give something to help', 'to get something', 'to buy something'],
                answer: 0, explainAr: 'donate = يتبرّع، أي يعطي شيئاً ليساعد الآخرين، مثل إعطاء الملابس للجمعية الخيرية.',
              },
              {
                q: 'Where is the sale?', qAr: 'أين سوق البيع؟',
                options: ['in the classroom', 'in the schoolyard', 'in the library', 'in the canteen'],
                answer: 1, explainAr: 'يقول النص: a sale in our schoolyard، أي في ساحة المدرسة.',
              },
              {
                q: 'When is the sale?', qAr: 'متى سوق البيع؟',
                options: ['this Friday', 'every day', 'this Saturday', 'next month'],
                answer: 2, explainAr: 'يقول النص: Join us this Saturday، أي يوم السبت هذا.',
              },
            ],
            trueFalse: [
              { statement: 'The group hopes to raise money for the poor.', answer: true },
              { statement: "The charity doesn't want donations.", answer: false },
              { statement: 'The charity wants to buy your clothes.', answer: false },
              { statement: 'The charity will help the poor.', answer: true },
            ],
          },
        ],
        exercises: [
          // ex. 2 — read, look and write (Tim and Alice; each picture is described in Arabic)
          fill("Tim: At the moment, I'm wearing my favourite ___.", 'تيم (صورة بنطال جينز): الآن ألبس ___ المفضّل عندي.', 'تيم (صورة بنطال جينز): الآن ألبس بنطال الجينز المفضّل عندي.',
            ['skirt', 'jeans', 'gloves'], 1, 'بنطال الجينز بالإنجليزية: jeans.'),
          fill("Tim: I'm wearing a blue ___.", 'تيم (صورة قميص قصير الأكمام): ألبس ___ أزرق.', 'تيم (صورة قميص قصير الأكمام): ألبس تي شيرت أزرق.',
            ['T-shirt', 'scarf', 'dress'], 0, 'القميص القصير الأكمام بلا أزرار هو T-shirt.'),
          fill("Tim: I'm wearing ___.", 'تيم (صورة حذاء رياضي): ألبس ___.', 'تيم (صورة حذاء رياضي): ألبس حذاءً رياضياً.',
            ['pyjamas', 'gloves', 'trainers'], 2, 'الحذاء الرياضي بالإنجليزية: trainers.'),
          fill("Tim: I'm wearing a pair of ___.", 'تيم (صورة جوارب): ألبس زوجاً من ___.', 'تيم (صورة جوارب): ألبس زوجاً من الجوارب.',
            ['socks', 'coat', 'blouse'], 0, 'الجوارب: socks. ونقول a pair of socks (زوج جوارب).'),
          fill("Tim: I'm wearing a ___ of course!", 'تيم (صورة قبّعة لها حافّة من الأمام): وألبس ___ طبعاً!', 'تيم (صورة قبّعة لها حافّة من الأمام): وألبس قبّعة كاب طبعاً!',
            ['sweater', 'cap', 'skirt'], 1, 'القبّعة الرياضية التي لها حافّة من الأمام: cap.'),
          fill('Tim: I also like wearing ___.', 'تيم (صورة بنطال قصير): أحبّ أيضاً أن ألبس ___.', 'تيم (صورة بنطال قصير): أحبّ أيضاً أن ألبس الشورت.',
            ['gloves', 'scarf', 'shorts'], 2, 'البنطال القصير: shorts.'),
          fill('Alice: Today she is wearing a striped ___.', 'أليس (صورة تنّورة): اليوم تلبس ___ مخطّطة.', 'أليس (صورة تنّورة): اليوم تلبس تنّورة مخطّطة.',
            ['skirt', 'coat', 'sweater'], 0, 'التنّورة: skirt. و striped تعني مخطّطة.'),
          fill('Alice: She is wearing a floral ___.', 'أليس (صورة بلوزة): تلبس ___ مزهّرة.', 'أليس (صورة بلوزة): تلبس بلوزة مزهّرة.',
            ['shorts', 'blouse', 'socks'], 1, 'البلوزة: blouse. و floral تعني عليها رسوم أزهار.'),
          fill('Alice: Sometimes she wears a ___.', 'أليس (صورة فستان): أحياناً تلبس ___.', 'أليس (صورة فستان): أحياناً تلبس فستاناً.',
            ['cap', 'scarf', 'dress'], 2, 'الفستان: dress.'),
          fill('Alice: Sometimes she wears high heeled ___.', 'أليس (صورة حذاء بكعب عالٍ): أحياناً تلبس ___ بكعب عالٍ.', 'أليس (صورة حذاء بكعب عالٍ): أحياناً تلبس حذاءً بكعب عالٍ.',
            ['shoes', 'socks', 'gloves'], 0, 'الحذاء: shoes. و high heeled تعني بكعب عالٍ.'),
          // ex. 4 — match
          fill("Jessy isn't wearing ___.", 'جيسي لا تلبس ___.', 'جيسي لا تلبس فستانها الأزرق اليوم.',
            ['their hats', 'her blue dress today', 'my gloves'], 1, 'Jessy بنت، فنقول her (ـها): her blue dress today.'),
          fill("It's raining. ___", 'إنها تمطر. ___', 'إنها تمطر. خذ مظلّتك!',
            ['Take your umbrella!', 'I put on my sunglasses.', 'Where are my gloves?'], 0, 'في المطر نأخذ المظلّة: umbrella.'),
          fill('My parents are wearing ___.', 'والداي يلبسان ___.', 'والداي يلبسان قبّعتيهما.',
            ['her blue dress today', 'my gloves', 'their hats'], 2, 'My parents = they، فنقول their (ـهما / ـهم): their hats.'),
          fill("I'm cold. Where are ___?", 'أشعر بالبرد. أين ___؟', 'أشعر بالبرد. أين قفّازاتي؟',
            ['my gloves', 'their hats', 'her blue dress'], 0, 'عندما نشعر بالبرد نلبس القفّازات: gloves.'),
          fill("When it's sunny, ___.", 'عندما يكون الجو مشمساً، ___.', 'عندما يكون الجو مشمساً، أضع نظّارتي الشمسية.',
            ['take your umbrella', 'I put on my sunglasses', 'where are my gloves'], 1, 'في الشمس نضع النظّارة الشمسية: sunglasses.'),
          // ex. 5 — look and describe: what are they wearing?
          fill('Jane is wearing a ___ dress.', 'جين (صورة فستان عليه أزهار) تلبس فستاناً ___.', 'جين (صورة فستان عليه أزهار) تلبس فستاناً مزهّراً.',
            ['striped', 'floral', 'plain'], 1, 'الفستان الذي عليه أزهار: floral.'),
          fill('Suzy is wearing a ___ shirt and a skirt.', 'سوزي (صورة قميص عليه نقاط) تلبس قميصاً ___ وتنّورة.', 'سوزي (صورة قميص عليه نقاط) تلبس قميصاً منقّطاً وتنّورة.',
            ['dotted', 'floral', 'striped'], 0, 'القميص الذي عليه نقاط: dotted.'),
          fill('Mark is wearing a jacket and ___.', 'مارك (صورة بنطال قصير) يلبس سترة و___.', 'مارك (صورة بنطال قصير) يلبس سترة وشورتاً.',
            ['a skirt', 'a dress', 'shorts'], 2, 'البنطال القصير: shorts.'),
          fill('Tony is wearing a shirt and ___.', 'توني (صورة بنطال طويل) يلبس قميصاً و___.', 'توني (صورة بنطال طويل) يلبس قميصاً وبنطالاً.',
            ['trousers', 'shorts', 'a skirt'], 0, 'البنطال الطويل: trousers.'),
          // ex. 6 — read and draw
          mcq('Read and draw: "A floral shirt". What do you draw on it?', 'اقرأ وارسم: «قميص floral». ماذا ترسم عليه؟',
            ['خطوطاً', 'أزهاراً', 'نقاطاً', 'لا شيء، لون واحد فقط'], 1, 'floral = عليه أزهار (flowers).'),
          mcq('Read and draw: "A striped shirt". What do you draw on it?', 'اقرأ وارسم: «قميص striped». ماذا ترسم عليه؟',
            ['خطوطاً', 'أزهاراً', 'نقاطاً', 'لا شيء، لون واحد فقط'], 0, 'striped = مخطّط، عليه خطوط.'),
          mcq('Read and draw: "A dotted shirt". What do you draw on it?', 'اقرأ وارسم: «قميص dotted». ماذا ترسم عليه؟',
            ['خطوطاً', 'أزهاراً', 'نقاطاً', 'لا شيء، لون واحد فقط'], 2, 'dotted = منقّط، عليه نقاط.'),
          mcq('Read and draw: "A blue plain shirt". How do you colour it?', 'اقرأ وارسم: «قميص أزرق plain». كيف تلوّنه؟',
            ['أزرق مع خطوط', 'أزرق مع أزهار', 'أزرق مع نقاط', 'أزرق فقط، بلا رسوم'], 3, 'plain = سادة، لون واحد بلا خطوط ولا نقاط ولا أزهار.'),
          // ex. 7 — write the verbs in the correct form
          fill("He's ___ in the pool now. (swim)", 'هو ___ في المسبح الآن. (يسبح)', 'هو يسبح في المسبح الآن.',
            ['swiming', 'swimming', 'swims'], 1, 'swim: نضاعف m ثم نضيف ing: swimming.'),
          fill("They aren't ___ French this year. (study)", 'هم لا ___ الفرنسية هذه السنة. (يدرس)', 'هم لا يدرسون الفرنسية هذه السنة.',
            ['studying', 'studing', 'studys'], 0, 'study: نبقي y ونضيف ing: studying.'),
          fill("I'm ___ a lot of photos for my project today. (take)", 'أنا ___ صوراً كثيرة لمشروعي اليوم. (يلتقط)', 'أنا ألتقط صوراً كثيرة لمشروعي اليوم.',
            ['takeing', 'takes', 'taking'], 2, 'take: نحذف e ونضيف ing: taking.'),
          fill("We're ___ for the bus. (wait)", 'نحن ___ الحافلة. (ينتظر)', 'نحن ننتظر الحافلة.',
            ['waiting', 'waitting', 'waits'], 0, 'wait: نضيف ing فقط: waiting.'),
          fill("She's ___ the birthday cake. (cut)", 'هي ___ كعكة عيد الميلاد. (يقطع)', 'هي تقطع كعكة عيد الميلاد.',
            ['cuting', 'cutting', 'cuts'], 1, 'cut: نضاعف t ثم نضيف ing: cutting، مثل put ← putting.'),
        ],
      },
      compositions: [
        {
          source: 'book',
          topic: 'Complete the following.',
          topicAr: 'أكمل ما يلي: ماذا تلبس في الشتاء وفي الصيف؟',
          words: 40,
          points: ['In winter, I wear …, …, … and …', 'In summer, … … …, …, … and …'],
          pointsAr: ['في الشتاء ألبس …، …، … و…', 'في الصيف … … …، …، … و…'],
          plan: [
            { en: 'Winter: say what the weather is like and what you wear.', ar: 'الشتاء: قل كيف الطقس وماذا تلبس.' },
            { en: 'Summer: say what the weather is like and what you wear.', ar: 'الصيف: قل كيف الطقس وماذا تلبس.' },
          ],
          phrases: [
            { en: 'In winter', ar: 'في الشتاء' },
            { en: 'it gets cold', ar: 'يصبح الجو بارداً' },
            { en: 'a coat', ar: 'معطف' },
            { en: 'a sweater', ar: 'كنزة' },
            { en: 'gloves', ar: 'قفّازات' },
            { en: 'In summer', ar: 'في الصيف' },
            { en: "it's always hot", ar: 'الجو حارّ دائماً' },
            { en: 'shorts', ar: 'شورت' },
            { en: 'my sunglasses', ar: 'نظّارتي الشمسية' },
          ],
          model: "In winter, it gets cold. I wear a coat, a sweater, gloves and a scarf. In summer, it's always hot. I wear a T-shirt, shorts, a cap and trainers. I sometimes put on my sunglasses when it's sunny.",
          modelAr: 'في الشتاء يصبح الجو بارداً. ألبس معطفاً وكنزة وقفّازات ووشاحاً. في الصيف الجو حارّ دائماً. ألبس تي شيرت وشورتاً وقبّعة كاب وحذاءً رياضياً. أحياناً أضع نظّارتي الشمسية عندما يكون الجو مشمساً.',
          checklistAr: [
            'كتبتُ عن الشتاء وعن الصيف.',
            'ذكرتُ أربع قطع ملابس على الأقل لكل فصل.',
            'وضعتُ فاصلة بين الأشياء وand قبل آخر شيء.',
            'استعملتُ a قبل المفرد (a coat) ولم أستعملها قبل الجمع (gloves).',
            'أنهيتُ كل جملة بنقطة.',
          ],
        },
        {
          source: 'workbook',
          topic: 'Complete.',
          topicAr: 'أكمل الفقرة: ماذا يلبس كل فرد من أفراد العائلة في الصورة؟',
          words: 40,
          points: [
            'This is my family. I have a grandfather, a grandmother, a father, a mother and a baby sister.',
            'I am wearing a … dress. My father is wearing a striped blue and white T-shirt and … .',
            'My mother is wearing a … and … .',
            'My brother … . My grandfather … . My grandmother … .',
          ],
          pointsAr: [
            'هذه عائلتي. عندي جدّ وجدّة وأب وأم وأخت رضيعة.',
            'ألبس فستاناً … . أبي يلبس تي شيرت مخطّطاً أزرق وأبيض و… .',
            'أمي تلبس … و… .',
            'أخي … . جدّي … . جدّتي … .',
          ],
          plan: [
            { en: 'Keep the first two sentences of the book.', ar: 'اكتب أول جملتين كما في الكتاب.' },
            { en: 'Say what you and your parents are wearing.', ar: 'قل ماذا تلبس أنت ووالداك.' },
            { en: 'Say what your brother and grandparents are wearing.', ar: 'قل ماذا يلبس أخوك وجدّك وجدّتك.' },
          ],
          phrases: [
            { en: 'This is my family', ar: 'هذه عائلتي' },
            { en: 'I am wearing', ar: 'ألبس (الآن)' },
            { en: 'is wearing', ar: 'يلبس (الآن)' },
            { en: 'a floral dress', ar: 'فستان مزهّر' },
            { en: 'striped', ar: 'مخطّط' },
            { en: 'trousers', ar: 'بنطال' },
            { en: 'a sweater', ar: 'كنزة' },
            { en: 'shorts', ar: 'شورت' },
          ],
          model: 'This is my family. I have a grandfather, a grandmother, a father, a mother and a baby sister. I am wearing a floral dress. My father is wearing a striped blue and white T-shirt and trousers. My mother is wearing a sweater and trousers. My brother is wearing a T-shirt and shorts. My grandfather is wearing a sweater and trousers. My grandmother is wearing a dress.',
          modelAr: 'هذه عائلتي. عندي جدّ وجدّة وأب وأم وأخت رضيعة. أنا ألبس فستاناً مزهّراً. أبي يلبس تي شيرت مخطّطاً أزرق وأبيض وبنطالاً. أمي تلبس كنزة وبنطالاً. أخي يلبس تي شيرت وشورتاً. جدّي يلبس كنزة وبنطالاً. جدّتي تلبس فستاناً.',
          checklistAr: [
            'كتبتُ ماذا يلبس كل فرد من أفراد العائلة.',
            'استعملتُ المضارع المستمر: is wearing / am wearing.',
            'استعملتُ am مع I و is مع he / she.',
            'وصفتُ الملابس بكلمات مثل floral و striped.',
            'أنهيتُ كل جملة بنقطة.',
          ],
        },
      ],
      translations: [
        { en: "I'm wearing a blue T-shirt and trousers.", ar: 'ألبس تي شيرت أزرق وبنطالاً.' },
        { en: "I'm looking for a sweater.", ar: 'أبحث عن كنزة.' },
        { en: 'What colour would you like?', ar: 'أيّ لون تريدين؟' },
        { en: 'The fitting room is over there.', ar: 'غرفة القياس هناك.' },
        { en: 'Rana is wearing a dotted pink dress and blue shoes.', ar: 'رنا تلبس فستاناً زهرياً منقّطاً وحذاءً أزرق.' },
        { en: 'We will help the poor families in our community.', ar: 'سنساعد العائلات الفقيرة في مجتمعنا.' },
        { en: 'Join us this Saturday to share your treasure.', ar: 'انضمّوا إلينا يوم السبت هذا لتتشاركوا كنوزكم.' },
        { en: "She isn't putting on a scarf.", ar: 'هي لا تضع وشاحاً.' },
        { en: 'Are you buying new jeans?', ar: 'هل تشتري بنطال جينز جديداً؟' },
      ],
    },
  },

  // ===================== REVISION 1 (Activity Book pages 20–21) =====================
  progressTest: {
    title: 'Revision 1',
    titleAr: 'المراجعة الأولى (كتاب الأنشطة)',
    pages: '20–21',
    exercises: [
      // ex. 1 — choose the correct answer
      fill("Emma’s favourite sport is football. She ___ watches football.", 'رياضة إيما المفضّلة كرة القدم. هي ___ تشاهد كرة القدم.', 'رياضة إيما المفضّلة كرة القدم. هي عادةً تشاهد كرة القدم.',
        ['never', 'usually', "don't"], 1, 'من يحبّ كرة القدم يشاهدها كثيراً: usually (عادةً). أمّا never فتعني «أبداً».'),
      fill('I watch films twice a week. I ___ watch films on TV.', 'أشاهد الأفلام مرّتين في الأسبوع. أنا ___ أشاهد الأفلام على التلفاز.', 'أشاهد الأفلام مرّتين في الأسبوع. أنا أحياناً أشاهد الأفلام على التلفاز.',
        ['always', 'never', 'sometimes'], 2, 'مرّتان في الأسبوع ليست كل يوم، فنقول sometimes (أحياناً).'),
      fill('Our teacher gives us homework every day. The teacher ___ gives them homework.', 'معلّمنا يعطينا وظائف كل يوم. المعلّم ___ يعطيهم وظائف.', 'معلّمنا يعطينا وظائف كل يوم. المعلّم دائماً يعطيهم وظائف.',
        ['always', 'never', 'sometimes'], 0, 'every day (كل يوم) = always (دائماً).'),
      fill("She doesn’t like chocolate so she doesn’t eat it. She ___ eats chocolate.", 'هي لا تحبّ الشوكولا لذلك لا تأكلها. هي ___ تأكل الشوكولا.', 'هي لا تحبّ الشوكولا لذلك لا تأكلها. هي لا تأكل الشوكولا أبداً.',
        ['sometimes', 'never', 'always'], 1, 'لا تأكلها أبداً = never.'),
      // ex. 2 — read and match
      fill('The sense of sight ___.', 'حاسّة البصر ___.', 'حاسّة البصر تساعدني على الرؤية.',
        ['in the library', 'helps me to see', 'the classroom'], 1, 'sight = البصر، وهو يساعدنا على الرؤية: helps me to see.'),
      fill('I study in ___.', 'أدرس في ___.', 'أدرس في الصف.',
        ['helps me to see', 'the classroom', 'in a science lab'], 1, 'بعد in نحتاج مكاناً بلا in أخرى: I study in the classroom.'),
      fill('I play with my friends ___.', 'ألعب مع أصدقائي ___.', 'ألعب مع أصدقائي في الملعب.',
        ['in the playground', 'helps me to see', 'the classroom'], 0, 'نلعب في الملعب: in the playground.'),
      fill('My father works ___.', 'أبي يعمل ___.', 'أبي يعمل في مخبر علوم.',
        ['the classroom', 'helps me to see', 'in a science lab'], 2, 'يبقى لأبي مكان العمل: in a science lab (في مخبر علوم).'),
      fill('We have to keep quiet ___.', 'يجب أن نبقى هادئين ___.', 'يجب أن نبقى هادئين في المكتبة.',
        ['in the library', 'helps me to see', 'the classroom'], 0, 'في المكتبة نبقى هادئين: keep quiet in the library. (في الكتاب كُتبت quite خطأً، والصحيح quiet.)'),
      // ex. 3 — fill in the spaces with the words in the box
      fill('I can ___ a blue car in the street.', 'أستطيع أن ___ سيارة زرقاء في الشارع.', 'أستطيع أن أرى سيارة زرقاء في الشارع.',
        ['tastes', 'see', 'does'], 1, 'بعد can يأتي الفعل بلا s، ونرى السيارة بعيوننا: see.'),
      fill('I like chocolate. It ___ sweet.', 'أحبّ الشوكولا. ___ حلو.', 'أحبّ الشوكولا. طعمها حلو.',
        ['see', 'tastes', 'have to'], 1, 'sweet (حلو) طعم، فنقول tastes. ومع it نضيف s.'),
      fill('My mum ___ not wake up late.', 'أمي ___ متأخرة.', 'أمي لا تستيقظ متأخرة.',
        ['does', 'have to', 'see'], 0, 'My mum = she، والنفي معها: does not + الفعل.'),
      fill('We ___ keep our classroom clean.', 'نحن ___ نحافظ على نظافة صفّنا.', 'نحن يجب أن نحافظ على نظافة صفّنا.',
        ['does', 'tastes', 'have to'], 2, 'مع we نقول have to (يجب).'),
      fill('She reads books in the ___.', 'هي تقرأ الكتب في ___.', 'هي تقرأ الكتب في المكتبة.',
        ['library', "uncle's", 'see'], 0, 'نقرأ الكتب في المكتبة: library.'),
      fill('Danny works on his ___ farm.', 'داني يعمل في مزرعة ___.', 'داني يعمل في مزرعة عمّه.',
        ['library', "uncle's", 'tastes'], 1, 'المزرعة ملك العمّ، فنقول his uncle’s farm (مع ’s للملكية).'),
      // ex. 4 — find the words and write them down
      ...wordSearchItems,
      // ex. 5 — choose
      mcq('What do you have to do in the classroom?', 'ماذا يجب أن تفعل في الصف؟',
        ['I have to sleep.', 'I have to listen to my teacher.', 'I has to listen to my teacher.'], 1,
        'في الصف نصغي إلى المعلّم، ومع I نقول have to وليس has to.'),
      mcq('Salwa’s friend Tala has long hair.', 'تالا صديقة سلوى، ولها شعر طويل. أيّ جملة تأتي بعدها؟',
        ['Her hair is black.', 'His hair is black.', 'Their hair is black.'], 0,
        'تالا بنت، فنقول her (ـها): Her hair. أمّا his فللولد.'),
      fill('Does Omar ___ milk in the morning?', 'هل ___ عمر الحليب في الصباح؟', 'هل يشرب عمر الحليب في الصباح؟',
        ['drinks', 'drink', 'drinking'], 1, 'بعد Does يأتي الفعل بلا s: Does he drink?'),
      fill('Smell, hearing, sight, touch and taste are ___.', 'الشمّ والسمع والبصر واللمس والتذوّق هي ___.', 'الشمّ والسمع والبصر واللمس والتذوّق هي الحواس الخمس.',
        ['my five friends', 'the five senses', 'the five colours'], 1, 'هذه هي الحواس الخمس: the five senses.'),
      mcq('What time do you go to school?', 'متى تذهب إلى المدرسة؟ (في أيّ ساعة؟)',
        ['I go by bus.', 'Yes, I do.', 'I go at half past seven.'], 2,
        'السؤال What time يسأل عن الساعة، والجواب: at half past seven (في السابعة والنصف).'),
      fill('Lily always ___ her mother.', 'ليلي دائماً ___ أمها.', 'ليلي دائماً تساعد أمها.',
        ['is helping', 'helps', 'help'], 1, 'مع always نستعمل المضارع البسيط، ومع she نضيف s: helps.'),
      fill('I ___ go to bed late.', 'أنا ___ متأخراً.', 'أنا لا أنام متأخراً.',
        ["doesn't", "don't", "isn't"], 1, 'مع I نستعمل don’t، أمّا doesn’t فهي لـ he / she / it.'),
    ],
  },
}
