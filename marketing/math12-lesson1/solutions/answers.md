# حلول «تدرَّبْ» — الدرس الأول «عموميّات عن المتتاليات» (الكتاب ص 11)

**Authoritative reference** for the solutions video (`SOLUTIONS_SPEC.md`). Reconciled from two independent
solutions; every number, expansion, derivative, sign table and term value below was re-verified with sympy 1.14
in exact arithmetic (`Rational`/`Integer`, no floats) — script:
`/tmp/claude-0/-home-user-lovable-dev/79280624-8267-53f4-b997-9cc33e4721e5/scratchpad/verify/judge.py` (all checks OK).

Statements checked against the page image `p011.png` and `../lesson-content.md`.

> **Count.** Page 11 has **21** sub-questions, not 19 as written in `SOLUTIONS_SPEC.md`:
> ① (1) + ②-1…②-8 (8) + ③-1…③-3 (3) + ④-1…④-9 (9) = 21. All 21 must be in the video.
>
> **Print quirk.** In ②-4 the book prints $u_2+u_4+u_6\cdots+u_{2n}$ (a «+» is missing before the dots).
> On screen write $u_2+u_4+u_6+\cdots+u_{2n}$.
>
> **Reading order of ④ on the page** (RTL grid): row 1 = ❶ $\frac{3}{n^2}$, ❷ $\sqrt{3n+1}$, ❸ $\frac{2n-1}{n+4}$;
> row 2 = ❹ $\frac{1}{n^2+1}$, ❺ $\frac{3n+1}{n-2}$, ❻ $\frac{n}{10^n}$; row 3 = ❼, ❽, ❾ (the three recursive ones).

## Lesson tools used (book pp. 7–10)

| tool | statement |
|---|---|
| تعريف 2 (حسابيّة) | $u_{n+1}=u_n+r$ أيّاً كان $n$ ؛ $u_m=u_p+(m-p)\,r$ ؛ $S=\dfrac{n(a+\ell)}{2}$ ؛ $1+2+\cdots+n=\dfrac{n(n+1)}{2}$ |
| تعريف 3 (هندسيّة) | $u_{n+1}=q\times u_n$ أيّاً كان $n$ ؛ $u_m=u_p\,q^{m-p}$ ؛ $S=a\,\dfrac{1-q^n}{1-q}$ ($q\ne1$) |
| تعريف بالتدريج | $u_{n+1}=f(u_n)$، والشرط: مهما يكن $x$ من $D$ يكن $f(x)$ من $D$، و $u_0\in D$ |
| طرائق الاطّراد | «إشارة الفرق» $u_{n+1}-u_n$ ؛ «اطّراد التابع» $u_n=f(n)$ على $[n_0,+\infty[$ ؛ «مقارنة النسبة بالواحد» $\dfrac{u_{n+1}}{u_n}$ و $1$ (**فقط** إذا كانت الحدود موجبة تماماً) |

## Summary of final answers

| # | final answer | ④: method used |
|---|---|---|
| ① | $u_{n+1}=\frac23\,u_n$ ⇒ هندسيّة، $q=\frac23$، $u_0=\frac13$ | |
| ②-1 | $r=-18$، $u_{20}=-283$ | |
| ②-2 | $q=\frac{30}{13}$، $u_{30}=\frac{25}{2197}\left(\frac{30}{13}\right)^{20}=\frac{25\times30^{20}}{13^{23}}\ (\approx208\,769.96)$ | |
| ②-3 | $u_n=3n-5$ ؛ $u_1+\cdots+u_{20}=530$ ؛ $u_{30}+u_{31}+u_{32}=264$ | |
| ②-4 | $u_n=-2\times3^{n-1}$ ؛ $u_1+\cdots+u_7=-2186$ ؛ $u_2+u_4+\cdots+u_{2n}=\frac34\left(1-9^n\right)$ | |
| ②-5 | $u_{25}+\cdots+u_{125}=-15453$ | |
| ②-6 | $u_3+\cdots+u_{10}=2040$ | |
| ②-7 | $S=105$ | |
| ②-8 | $(a,b,c)=\left(\frac74,7,28\right)$ أو $\left(28,7,\frac74\right)$ | |
| ③-1 | $v_n>0$ أيّاً كان $n$ | |
| ③-2 | $u_{n+1}=u_n+1$ ⇒ حسابيّة، $r=1$، $u_0=1$ | |
| ③-3 | $v_n=\frac{1}{n+1}$ | |
| ④-1 | $n_0=1$: $(u_n)_{n\ge1}$ متناقصة تماماً | «اطّراد التابع» |
| ④-2 | $(u_n)_{n\ge0}$ متزايدة تماماً | «اطّراد التابع» |
| ④-3 | $(u_n)_{n\ge0}$ متزايدة تماماً ($u_{n+1}-u_n=\frac{9}{(n+4)(n+5)}$) | «إشارة الفرق» |
| ④-4 | $(u_n)_{n\ge0}$ متناقصة تماماً ($u_{n+1}-u_n=\frac{-(2n+1)}{(n^2+1)(n^2+2n+2)}$) | «إشارة الفرق» |
| ④-5 | $n_0=3$: $(u_n)_{n\ge3}$ متناقصة تماماً ($f'(x)=\frac{-7}{(x-2)^2}$) | «اطّراد التابع» |
| ④-6 | $u_0<u_1$، ثمّ $(u_n)_{n\ge1}$ متناقصة تماماً ($n_0=1$)؛ $(u_n)_{n\ge0}$ غير مطّردة | «إشارة الفرق» |
| ④-7 | $(u_n)_{n\ge0}$ متناقصة تماماً (الفرق $=-3$) | «إشارة الفرق» |
| ④-8 | $(u_n)_{n\ge0}$ متناقصة تماماً (الحدود $>0$، النسبة $\frac12<1$) | «مقارنة النسبة بالواحد» |
| ④-9 | $(u_n)_{n\ge0}$ متزايدة تماماً (الحدود $>0$، النسبة $2>1$) | «مقارنة النسبة بالواحد» |

---

## ①

**Statement.** ليكن $u_n=\dfrac{2^n}{3^{n+1}}$ في حالة $n\in\mathbb{N}$. أثبت أنّ المتتالية $(u_n)_{n\ge0}$ متتالية هندسية وجِدْ أساسها.

**Pause-beat hint.** تعريف المتتالية الهندسيّة: نبحث عن عدد ثابت $q$ يحقّق $u_{n+1}=q\times u_n$ أيّاً كان $n$.

**Method.** Definition of a geometric sequence (تعريف 3): compute $u_{n+1}$ and make $u_n$ appear.

**Exam-style solution.**
أيّاً كان العدد الطبيعي $n$:
$$u_{n+1}=\frac{2^{n+1}}{3^{(n+1)+1}}=\frac{2^{n+1}}{3^{n+2}}=\frac{2\times2^{n}}{3\times3^{n+1}}=\frac{2}{3}\times\frac{2^n}{3^{n+1}}=\frac23\,u_n$$
إذن $u_{n+1}=\dfrac23\,u_n$ أيّاً كان $n\in\mathbb{N}$، فالمتتالية $(u_n)_{n\ge0}$ هندسيّة أساسها $q=\dfrac23$، وحدّها الأوّل $u_0=\dfrac{2^0}{3^1}=\dfrac13$.

**Answer.** $\boxed{(u_n)_{n\ge0}\ \text{هندسيّة أساسها}\ q=\tfrac23}$ (و $u_0=\frac13$). First terms: $\frac13,\ \frac29,\ \frac4{27},\ \frac8{81}$.

**Alternatives.** Ratio: all terms are $>0$, so $\dfrac{u_{n+1}}{u_n}=\dfrac{2^{n+1}}{3^{n+2}}\times\dfrac{3^{n+1}}{2^n}=\dfrac23$ (constant). Or write $u_n=\dfrac13\left(\dfrac23\right)^n=u_0\,q^n$.

**Subtleties.** Defined for every $n\ge0$ ($n_0=0$). If the ratio route is used, first say why division is allowed ($u_n\ne0$; here $u_n>0$).

**انتبه.** Checking $\frac{u_1}{u_0}=\frac{u_2}{u_1}=\frac23$ on a few terms proves nothing — the relation must hold **for every $n$**. And $u_0=\frac{1}{3}$, not $1$ ($3^{0+1}=3$); the base is $\frac23$, not $2$ (the exponent of $3$ moves too: $3^{n+2}=3\times3^{n+1}$).

---

## ② الأسئلة الآتية تتعلّق بمتتاليات حسابيّة أو هندسيّة

### ②-1

**Statement.** $(u_n)_{n\ge0}$ متتالية حسابيّة فيها $u_2=41$ و $u_5=-13$. احسب $u_{20}$.

**Pause-beat hint.** العلاقة $u_m=u_p+(m-p)\,r$: أولاً نجد الأساس $r$.

**Method.** $u_m=u_p+(m-p)\,r$ twice.

**Exam-style solution.**
$$u_5=u_2+(5-2)\,r\ \Rightarrow\ -13=41+3r\ \Rightarrow\ 3r=-54\ \Rightarrow\ r=-18$$
$$u_{20}=u_5+(20-5)\,r=-13+15\times(-18)=-13-270=-283$$

**Answer.** $r=-18$، $\boxed{u_{20}=-283}$.

**Checks.** $u_{20}=u_2+18r=41-324=-283$; $u_0=u_2-2r=77$ and $u_0+20r=77-360=-283$.

**Subtleties.** A negative base is normal: the sequence is decreasing ($41\to-13$).

**انتبه.** Between $u_2$ and $u_5$ there are $5-2=3$ steps: $u_5=u_2+3r$, not $u_2+5r$. Keep the sign: $-13-41=-54$.

### ②-2

**Statement.** $(u_n)_{n\ge0}$ متتالية هندسيّة فيها $u_7=\dfrac{1}{1080}$ و $u_{10}=\dfrac{25}{2197}$. احسب $u_{30}$.

**Pause-beat hint.** العلاقة $u_m=u_p\,q^{m-p}$: نقسم الحدّين لنجد $q^3$.

**Method.** $u_m=u_p\,q^{m-p}$.

**Exam-style solution.**
$$u_{10}=u_7\,q^{10-7}\ \Rightarrow\ q^3=\frac{u_{10}}{u_7}=\frac{25}{2197}\times1080=\frac{27000}{2197}$$
ولكن $27000=30^3$ و $2197=13^3$، إذن
$$q^3=\left(\frac{30}{13}\right)^3\ \Rightarrow\ q=\frac{30}{13}$$
$$u_{30}=u_{10}\,q^{30-10}=\frac{25}{2197}\left(\frac{30}{13}\right)^{20}=\frac{25\times30^{20}}{13^{3}\times13^{20}}=\frac{25\times30^{20}}{13^{23}}$$

**Answer.** $q=\dfrac{30}{13}$، $\boxed{u_{30}=\dfrac{25}{2197}\left(\dfrac{30}{13}\right)^{20}=\dfrac{25\times30^{20}}{13^{23}}}$.
Leave it in power form (expected exam answer). For orientation only:
$u_{30}=\dfrac{2^{20}\,3^{20}\,5^{22}}{13^{23}}=\dfrac{8716961002500000000000000000000}{41753905413413116367045797}\approx208\,769.96$.

**Checks.** From $u_7$: $u_{30}=u_7\,q^{23}=\dfrac{1}{1080}\left(\dfrac{30}{13}\right)^{23}$ — the same exact number (because $30^3=25\times1080$). Factorisations: $1080=2^3\times3^3\times5$, $2197=13^3$, $25\times1080=27000=30^3$.

**Subtleties.** $x\mapsto x^3$ is one-to-one on $\mathbb{R}$, so $q^3=\left(\frac{30}{13}\right)^3$ has the **single** real solution $q=\frac{30}{13}$ (a $\pm$ would only appear with an even power such as $q^2$).

**انتبه.** For a geometric sequence we **divide** the two terms ($q^3=\frac{u_{10}}{u_7}$, not $\frac{u_7}{u_{10}}$), we never subtract them. The exponent from $u_{10}$ to $u_{30}$ is $20$ (from $u_7$ it is $23$) — not $30$.

### ②-3

**Statement.** $(u_n)_{n\ge0}$ متتالية حسابيّة أساسها $3$ وفيها $u_1=-2$. احسب $u_n$ بدلالة $n$، واستنتج قيمة المجموعين $u_1+u_2+\cdots+u_{20}$ و $u_{30}+u_{31}+u_{32}$.

**Pause-beat hint.** $u_n=u_1+(n-1)\,r$، ثمّ $S=\dfrac{n(a+\ell)}{2}$ (عدد الحدود × (الأوّل + الأخير) ÷ 2).

**Method.** $u_m=u_p+(m-p)r$ with $p=1$; then $S=\dfrac{n(a+\ell)}{2}$.

**Exam-style solution.**
$$u_n=u_1+(n-1)\,r=-2+3(n-1)=3n-5$$
المجموع الأوّل: عدد حدوده $20-1+1=20$، أوّلها $a=u_1=-2$ وآخرها $\ell=u_{20}=3\times20-5=55$:
$$u_1+u_2+\cdots+u_{20}=\frac{20\,(-2+55)}{2}=10\times53=530$$
المجموع الثاني: عدد حدوده $3$، أوّلها $u_{30}=3\times30-5=85$ وآخرها $u_{32}=3\times32-5=91$:
$$u_{30}+u_{31}+u_{32}=\frac{3\,(85+91)}{2}=\frac{3\times176}{2}=264$$

**Answer.** $\boxed{u_n=3n-5}$، $\boxed{u_1+\cdots+u_{20}=530}$، $\boxed{u_{30}+u_{31}+u_{32}=264}$.

**Checks.** $u_0=-5$, $u_{31}=88$, $85+88+91=264=3\times u_{31}$.

**Subtleties.** The formula $u_n=3n-5$ is valid for every $n\ge0$ (it gives $u_0=-5$, and $u_1=-2$ ✓).

**انتبه.** The given term is $u_1$, not $u_0$: $u_n=-2+3n$ is the classic error. Number of terms $=$ last index $-$ first index $+1$.

### ②-4

**Statement.** $(u_n)_{n\ge0}$ متتالية هندسيّة أساسها $3$ وفيها $u_1=-2$. احسب $u_n$ بدلالة $n$، واستنتج قيمة المجموعين $u_1+u_2+\cdots+u_7$ و $u_2+u_4+u_6+\cdots+u_{2n}$.

**Pause-beat hint.** $u_n=u_1\,q^{n-1}$ و $S=a\,\dfrac{1-q^n}{1-q}$. وفي المجموع الثاني: ما الذي نضرب به لننتقل من $u_2$ إلى $u_4$؟

**Method.** $u_m=u_p\,q^{m-p}$ with $p=1$; $S=a\,\dfrac{1-q^n}{1-q}$; for the even-index sum, recognise a **new** geometric sequence of base $q^2=9$.

**Exam-style solution.**
$$u_n=u_1\,q^{n-1}=-2\times3^{\,n-1}$$
المجموع الأوّل: عدد حدوده $7$، أوّلها $a=u_1=-2$، والأساس $q=3\ne1$:
$$u_1+\cdots+u_7=-2\times\frac{1-3^7}{1-3}=-2\times\frac{1-2187}{-2}=1-2187=-2186$$
المجموع الثاني: لنرمز بـ $k$ إلى الدليل المتحوّل. لدينا $u_{2k}=-2\times3^{2k-1}$ و
$$u_{2(k+1)}=-2\times3^{2k+1}=9\times\left(-2\times3^{2k-1}\right)=9\,u_{2k}$$
إذن الحدود $u_2,u_4,\dots,u_{2n}$ هي $n$ حدّاً متتالياً من متتالية هندسيّة أساسها $9\ne1$ وأوّلها $u_2=-2\times3=-6$:
$$u_2+u_4+\cdots+u_{2n}=-6\times\frac{1-9^n}{1-9}=-6\times\frac{1-9^n}{-8}=\frac34\left(1-9^n\right)$$

**Answer.** $\boxed{u_n=-2\times3^{n-1}}$، $\boxed{u_1+\cdots+u_7=-2186}$، $\boxed{u_2+u_4+\cdots+u_{2n}=\dfrac34\left(1-9^n\right)=-\dfrac34\left(9^n-1\right)}$ ($n\ge1$).

**Checks.** $-2(1+3+9+27+81+243+729)=-2\times1093=-2186$. Second sum: $n=1\to-6$; $n=2\to-6-54=-60=\frac34(1-81)$; $n=3\to-546$ (sympy: identity holds symbolically).

**Subtleties.** In the second sum $n$ is a **fixed** number (the count of terms: indices $2,4,\dots,2n$), so use another letter ($k$) for the running index. $u_n=-2\times3^{n-1}$ is valid for $n\ge0$ ($u_0=-\frac23$).

**انتبه.** The even-index terms jump two steps each time: base $q^2=9$, not $3$; there are $n$ of them, not $2n$. And again $u_1$ is given, so the exponent is $n-1$, not $n$.

### ②-5

**Statement.** $(u_n)_{n\ge0}$ متتالية حسابيّة أساسها $-2$ وفيها $u_0=-3$. احسب $u_{25}+u_{26}+\cdots+u_{125}$.

**Pause-beat hint.** نحتاج الحدّ الأوّل والحدّ الأخير وعدد الحدود، ثمّ $S=\dfrac{n(a+\ell)}{2}$.

**Method.** $u_n=u_0+n\,r$, then $S=\dfrac{n(a+\ell)}{2}$.

**Exam-style solution.**
$$u_n=u_0+n\,r=-3-2n,\qquad u_{25}=-3-50=-53,\qquad u_{125}=-3-250=-253$$
عدد الحدود: $125-25+1=101$.
$$u_{25}+u_{26}+\cdots+u_{125}=\frac{101\,(-53-253)}{2}=\frac{101\times(-306)}{2}=101\times(-153)=-15453$$

**Answer.** $\boxed{u_{25}+\cdots+u_{125}=-15453}$.

**انتبه.** $101$ terms, not $100$ (both ends count: last $-$ first $+1$).

### ②-6

**Statement.** $(u_n)_{n\ge0}$ متتالية هندسيّة أساسها $2$ وفيها $u_0=1$. احسب $u_3+u_4+\cdots+u_{10}$.

**Pause-beat hint.** $S=a\,\dfrac{1-q^n}{1-q}$، حيث $a$ أوّل حدود **المجموع** و $n$ عدد حدوده.

**Method.** $u_n=u_0\,q^n$, then $S=a\,\dfrac{1-q^n}{1-q}$.

**Exam-style solution.**
$u_n=u_0\,q^n=2^n$. أوّل حدود المجموع $a=u_3=2^3=8$، وعدد حدوده $10-3+1=8$، والأساس $q=2\ne1$:
$$u_3+u_4+\cdots+u_{10}=8\times\frac{1-2^8}{1-2}=8\times\frac{1-256}{-1}=8\times255=2040$$

**Answer.** $\boxed{u_3+\cdots+u_{10}=2040}$.

**Check.** $8+16+32+64+128+256+512+1024=2040=2^{11}-2^3$.

**انتبه.** $a$ is the first term **of the sum** ($u_3=8$), not $u_0=1$; the exponent in the formula is the **number of terms** ($8$), not the last index ($10$), and not $7$.

### ②-7

**Statement.** احسب المجموع $S=\frac12+1+\frac32+2+\frac52+3+\cdots+10$.

**Pause-beat hint.** كم نضيف في كلّ مرّة؟ إذا كان الفرق ثابتاً فهي حدود متتالية حسابيّة.

**Method.** Recognise consecutive terms of an arithmetic sequence (step $\frac12$), count them, $S=\dfrac{n(a+\ell)}{2}$. (Second way: factor $\frac12$ and use $1+2+\cdots+n=\frac{n(n+1)}{2}$.)

**Exam-style solution.**
نلاحظ أنّ $S=\frac12+\frac22+\frac32+\frac42+\cdots+\frac{20}{2}$: كلّ حدّ يساوي سابقه مضافاً إليه $\frac12$، فهذه حدود متتالية من متتالية حسابيّة أساسها $\frac12$، أوّلها $a=\frac12$ وآخرها $\ell=10=\frac{20}{2}$، وعددها $20$.
$$S=\frac{20\left(\frac12+10\right)}{2}=10\times\frac{21}{2}=105$$
طريقة ثانية: $S=\dfrac12\,(1+2+\cdots+20)=\dfrac12\times\dfrac{20\times21}{2}=\dfrac12\times210=105$.

**Answer.** $\boxed{S=105}$.

**Subtlety (counting).** The $N$-th term is $\frac N2$; $\frac N2=10\Rightarrow N=20$ (or $\frac12+(N-1)\times\frac12=10\Rightarrow N=20$).

**انتبه.** There are $20$ terms, not $10$: the whole numbers $1,2,\dots,10$ are only every second term.

### ②-8

**Statement.** $a$ و $b$ و $c$ ثلاثة حدود متوالية من متتالية هندسيّة. احسبها علماً أن $abc=343$ و $a+b+c=36.75$.

**Pause-beat hint.** اكتب الحدّين $a$ و $c$ بدلالة الحدّ الأوسط $b$ والأساس $q$: $a=\dfrac bq$ و $c=bq$.

**Method.** Definition of a geometric sequence with base $q$ ($b=aq$, $c=bq$, equivalently $b^2=ac$): the product gives $b$, the sum gives $q$.

**Exam-style solution.**
بما أنّ $abc=343\ne0$ فلا يساوي أيٌّ من الحدود الثلاثة الصفر، ومنه $q\ne0$. نكتب $a=\dfrac bq$ و $c=bq$:
$$abc=\frac bq\times b\times bq=b^3=343=7^3\ \Rightarrow\ b=7$$
ونكتب $36.75=\dfrac{147}{4}$:
$$\frac7q+7+7q=\frac{147}{4}\ \Rightarrow\ \frac1q+1+q=\frac{21}{4}\ \Rightarrow\ q+\frac1q=\frac{17}{4}\ \Rightarrow\ 4q^2-17q+4=0$$
$$\Delta=17^2-4\times4\times4=289-64=225=15^2,\qquad q=\frac{17\pm15}{8}\ \Rightarrow\ q=4\ \text{أو}\ q=\frac14$$
- $q=4$: $a=\frac74$، $b=7$، $c=28$.
- $q=\frac14$: $a=28$، $b=7$، $c=\frac74$.

التحقّق: $\frac74\times7\times28=343$ و $\frac74+7+28=\frac{147}{4}=36.75$.

**Answer.** $\boxed{(a,b,c)=\left(\tfrac74,\,7,\,28\right)\ \text{أو}\ \left(28,\,7,\,\tfrac74\right)}$ (i.e. $1.75,\ 7,\ 28$ in one order or the other).

**Alternative.** $a+c=\frac{147}{4}-7=\frac{119}{4}$ and $ac=b^2=49$, so $a,c$ are the roots of $4X^2-119X+196=0$: $\Delta=119^2-16\times196=11025=105^2$, $X\in\left\{\frac74,\,28\right\}$.

**Subtleties.** sympy confirms these are the only real solutions. The two triples are the same three numbers in increasing ($q=4$) or decreasing ($q=\frac14$) order — both must be given.

**انتبه.** The key is the middle term: $abc=b^3$ (because $ac=b^2$) gives $b=7$ at once. Keep **both** solutions. Convert $36.75=\frac{147}{4}$ to work with exact fractions.

---

## ③ $(v_n)_{n\ge0}$ متتالية معرّفة تدريجيّاً وفق $v_0=1$ و $v_{n+1}=\dfrac{v_n}{1+v_n}$

Here $v_{n+1}=f(v_n)$ with $f(x)=\dfrac{x}{1+x}$. First terms: $v_0=1,\ v_1=\frac12,\ v_2=\frac13,\ v_3=\frac14$.

### ③-1

**Statement.** تحقّق أنّ $v_n>0$ أيّاً كان العدد الطبيعي $n$.

**Pause-beat hint.** إذا كان حدٌّ ما موجباً تماماً، فهل يكون الحدّ الذي يليه موجباً تماماً؟

**Method.** «Positivity passes from each term to the next» — the lesson's condition for a recursive definition ($f$ maps $D=\,]0,+\infty[$ into itself and $v_0\in D$). The formal method is lesson 2 «البرهان بالتدريج».

**Exam-style solution.**
- $v_0=1>0$.
- إذا كان حدٌّ ما $v_n>0$، كان $1+v_n>1>0$، فالعدد $v_{n+1}=\dfrac{v_n}{1+v_n}$ ناتج قسمة عدد موجب تماماً على عدد موجب تماماً، إذن $v_{n+1}>0$.
- وهكذا تنتقل الموجبيّة من كلّ حدٍّ إلى الحدّ الذي يليه انطلاقاً من $v_0>0$: $v_1>0$ ثمّ $v_2>0$ ثمّ … إذن $v_n>0$ أيّاً كان العدد الطبيعي $n$.

(In the book's language: for every $x$ in $D=\,]0,+\infty[$, $f(x)=\frac{x}{1+x}\in D$, and $v_0=1\in D$, so every term stays in $D$.) Writing this chain rigorously is exactly the induction proof of lesson 2.

**Answer.** $\boxed{v_n>0\ \text{أيّاً كان}\ n\in\mathbb{N}}$.

**Subtleties.** This step also guarantees that the sequence is well defined ($1+v_n\ne0$) and that $u_n=\frac1{v_n}$ in ③-2 exists ($v_n\ne0$).

**انتبه.** Computing $v_1,v_2,v_3$ and seeing they are positive is **not** a proof for every $n$; what proves it is "start positive + positive in ⇒ positive out".

### ③-2

**Statement.** أثبت أنّ المتتالية $(u_n)_{n\ge0}$ المعرّفة بالعلاقة $u_n=\dfrac{1}{v_n}$ متتالية حسابيّة.

**Pause-beat hint.** تعريف المتتالية الحسابيّة: نبيّن أنّ الفرق $u_{n+1}-u_n$ عدد ثابت.

**Method.** Definition of an arithmetic sequence (تعريف 2).

**Exam-style solution.**
الحدّ $u_n$ معرّف لأنّ $v_n\ne0$ (من ③-1). أيّاً كان العدد الطبيعي $n$:
$$u_{n+1}=\frac{1}{v_{n+1}}=\frac{1}{\dfrac{v_n}{1+v_n}}=\frac{1+v_n}{v_n}=\frac{1}{v_n}+\frac{v_n}{v_n}=u_n+1$$
إذن $u_{n+1}-u_n=1$ أيّاً كان $n$، فالمتتالية $(u_n)_{n\ge0}$ حسابيّة أساسها $r=1$ وحدّها الأوّل $u_0=\dfrac{1}{v_0}=1$.

**Answer.** $\boxed{u_{n+1}=u_n+1:\ (u_n)_{n\ge0}\ \text{حسابيّة أساسها}\ r=1،\ u_0=1}$.

**انتبه.** $\dfrac{1}{v_{n+1}}$ is the reciprocal of the **whole fraction**: $\dfrac{1+v_n}{v_n}$. Do not split it as $\frac1{v_n}+\frac1{1+v_n}$. Mention $v_n\ne0$ before writing $\frac1{v_n}$.

### ③-3

**Statement.** استنتج عبارة $v_n$ بدلالة $n$.

**Pause-beat hint.** الحدّ العامّ لمتتالية حسابيّة $u_n=u_0+n\,r$، ثمّ $v_n=\dfrac{1}{u_n}$.

**Method.** $u_n=u_0+n\,r$ (from $u_m=u_p+(m-p)r$ with $p=0$), then invert.

**Exam-style solution.**
$$u_n=u_0+n\,r=1+n\qquad\Rightarrow\qquad v_n=\frac{1}{u_n}=\frac{1}{n+1}$$

**Answer.** $\boxed{v_n=\dfrac{1}{n+1}}$.

**Check.** $v_0=1$, $v_1=\frac{1}{1+1}=\frac12$, $v_2=\dfrac{1/2}{3/2}=\frac13$ — matches the recursion (sympy: $v_n=\frac{1}{n+1}$ for $n=0,\dots,40$ by direct iteration).

**انتبه.** $u_n=u_0+nr$ (not $(n-1)r$: we start at $u_0$). The question asks for $v_n$: do not stop at $u_n=n+1$.

---

## ④ ادرس جهة اطّراد كلٍّ من المتتاليات الآتية

General reminder for the whole exercise: before choosing a method, **find where the formula is defined** (the domain fixes $n_0$), and remember that the ratio method needs **strictly positive** terms.

### ④-1  $u_n=\dfrac{3}{n^2}$

**Domain / $n_0$.** Undefined at $n=0$ (division by zero) ⇒ the sequence is $(u_n)_{n\ge1}$, $n_0=1$ (like $\left(\frac1n\right)_{n\ge1}$ in the lesson).

**Pause-beat hint.** الحدّ من الشكل $f(n)$: ادرس اطّراد التابع $f(x)=\dfrac{3}{x^2}$ على $[1,+\infty[$.

**Method.** «اطّراد التابع» — it puts the interval $[n_0,+\infty[=[1,+\infty[$ in plain view.

**Exam-style solution.**
الحدّ $u_n$ غير معرّف عند $n=0$، فالمتتالية هي $(u_n)_{n\ge1}$.
نكتب $u_n=f(n)$ حيث $f(x)=\dfrac{3}{x^2}$ على $[1,+\infty[$.
$$f'(x)=-3\times\frac{2x}{x^4}=-\frac{6}{x^3}$$
وفي حالة $x\ge1$ يكون $x^3>0$، إذن $f'(x)<0$، فالتابع $f$ متناقص تماماً على $[1,+\infty[$.
إذن المتتالية $(u_n)_{n\ge1}$ متناقصة تماماً.

**Answer.** $\boxed{(u_n)_{n\ge1}\ \text{متناقصة تماماً}}$ ($u_1=3,\ u_2=\frac34,\ u_3=\frac13,\ u_4=\frac3{16},\dots$).

**Alternatives (same result).** «مقارنة النسبة بالواحد» (terms $\frac{3}{n^2}>0$): $\dfrac{u_{n+1}}{u_n}=\dfrac{n^2}{(n+1)^2}=\left(\dfrac{n}{n+1}\right)^2<1$ since $0<n<n+1$. «إشارة الفرق»: $u_{n+1}-u_n=\dfrac{-3(2n+1)}{n^2(n+1)^2}<0$.

**انتبه.** Write $n\ge1$, not $n\ge0$: $u_0$ does not exist.

### ④-2  $u_n=\sqrt{3n+1}$

**Domain / $n_0$.** $3n+1\ge1>0$ for every natural $n$ ⇒ defined on $\mathbb{N}$, $n_0=0$.

**Pause-beat hint.** $u_n=f(n)$ مع $f(x)=\sqrt{3x+1}$: ما إشارة المشتق؟

**Method.** «اطّراد التابع».

**Exam-style solution.**
نكتب $u_n=f(n)$ حيث $f(x)=\sqrt{3x+1}$، وهو تابع معرّف على $\left[-\frac13,+\infty\right[$ الذي يحوي $[0,+\infty[$، و
$$f'(x)=\frac{3}{2\sqrt{3x+1}}>0\quad\text{على}\ \left]-\tfrac13,+\infty\right[$$
إذن $f$ متزايد تماماً على $[0,+\infty[$، فالمتتالية $(u_n)_{n\ge0}$ متزايدة تماماً.

**Answer.** $\boxed{(u_n)_{n\ge0}\ \text{متزايدة تماماً}}$ ($u_0=1,\ u_1=2,\ u_2=\sqrt7,\ u_3=\sqrt{10},\dots$).

**Alternative.** «إشارة الفرق» with the conjugate: $u_{n+1}-u_n=\sqrt{3n+4}-\sqrt{3n+1}=\dfrac{(3n+4)-(3n+1)}{\sqrt{3n+4}+\sqrt{3n+1}}=\dfrac{3}{\sqrt{3n+4}+\sqrt{3n+1}}>0$.

**انتبه.** $\sqrt{3n+4}-\sqrt{3n+1}\ne\sqrt{3}$: the root of a difference is not the difference of roots. If you use the difference, multiply by the conjugate.

### ④-3  $u_n=\dfrac{2n-1}{n+4}$

**Domain / $n_0$.** $n+4\ge4>0$ ⇒ defined on $\mathbb{N}$, $n_0=0$.

**Pause-beat hint.** مثل مثال الكتاب الأوّل: احسب $u_{n+1}-u_n$ بتوحيد المقامات.

**Method.** «إشارة الفرق».

**Exam-style solution.**
$$u_{n+1}=\frac{2(n+1)-1}{(n+1)+4}=\frac{2n+1}{n+5}$$
$$u_{n+1}-u_n=\frac{2n+1}{n+5}-\frac{2n-1}{n+4}=\frac{(2n+1)(n+4)-(2n-1)(n+5)}{(n+4)(n+5)}$$
$$=\frac{(2n^2+9n+4)-(2n^2+9n-5)}{(n+4)(n+5)}=\frac{9}{(n+4)(n+5)}$$
البسط $9>0$ والمقام جداء عددين موجبين تماماً، إذن $u_{n+1}-u_n>0$ أيّاً كان $n$، فالمتتالية $(u_n)_{n\ge0}$ متزايدة تماماً.

**Answer.** $\boxed{(u_n)_{n\ge0}\ \text{متزايدة تماماً}}$ ($u_0=-\frac14,\ u_1=\frac15,\ u_2=\frac12,\ u_3=\frac57,\dots$).

**Alternative.** «اطّراد التابع»: $f(x)=\dfrac{2x-1}{x+4}$, $f'(x)=\dfrac{2(x+4)-(2x-1)}{(x+4)^2}=\dfrac{9}{(x+4)^2}>0$ on $[0,+\infty[$.

**انتبه.** The ratio method is **not allowed**: $u_0=-\frac14<0$, the terms are not all strictly positive. Watch the minus sign: $-(2n^2+9n-5)=-2n^2-9n+5$, so the constant is $4+5=9$.

### ④-4  $u_n=\dfrac{1}{n^2+1}$

**Domain / $n_0$.** $n^2+1\ge1>0$ ⇒ defined on $\mathbb{N}$, $n_0=0$.

**Pause-beat hint.** احسب $u_{n+1}-u_n$ وانتبه إلى $(n+1)^2+1$.

**Method.** «إشارة الفرق».

**Exam-style solution.**
$$u_{n+1}=\frac{1}{(n+1)^2+1}=\frac{1}{n^2+2n+2}$$
$$u_{n+1}-u_n=\frac{1}{n^2+2n+2}-\frac{1}{n^2+1}=\frac{(n^2+1)-(n^2+2n+2)}{(n^2+1)(n^2+2n+2)}=\frac{-(2n+1)}{(n^2+1)(n^2+2n+2)}$$
البسط $-(2n+1)<0$ والمقام موجب تماماً، إذن $u_{n+1}-u_n<0$ أيّاً كان $n$، فالمتتالية $(u_n)_{n\ge0}$ متناقصة تماماً.

**Answer.** $\boxed{(u_n)_{n\ge0}\ \text{متناقصة تماماً}}$ ($u_0=1,\ u_1=\frac12,\ u_2=\frac15,\ u_3=\frac1{10},\dots$).

**Alternatives.** Ratio (terms $>0$): $\dfrac{u_{n+1}}{u_n}=\dfrac{n^2+1}{n^2+2n+2}<1$ because $2n+1>0$. Function: $f(x)=\dfrac1{x^2+1}$, $f'(x)=\dfrac{-2x}{(x^2+1)^2}<0$ on $]0,+\infty[$ (zero only at $x=0$), so $f$ is strictly decreasing on $[0,+\infty[$.

**انتبه.** $(n+1)^2+1=n^2+2n+2$, not $n^2+2$.

### ④-5  $u_n=\dfrac{3n+1}{n-2}$

**Domain / $n_0$ (key point).** The formula is undefined at $n=2$. By the lesson's definition a sequence lives on $\mathbb{N}$ or on a set $\{n_0,n_0+1,n_0+2,\dots\}$ with no gap, so the sequence is $(u_n)_{n\ge3}$: $n_0=3$. ($u_0=-\frac12$ and $u_1=-4$ can be computed, but $u_2$ does not exist, so the chain breaks at $2$; they are not part of $(u_n)_{n\ge3}$.)

**Pause-beat hint.** أين لا تكون الصيغة معرّفة؟ ثمّ ادرس اطّراد $f(x)=\dfrac{3x+1}{x-2}$ على $[3,+\infty[$.

**Method.** «اطّراد التابع».

**Exam-style solution.**
الحدّ غير معرّف عند $n=2$، فندرس المتتالية $(u_n)_{n\ge3}$.
نكتب $u_n=f(n)$ حيث $f(x)=\dfrac{3x+1}{x-2}$ على $[3,+\infty[$:
$$f'(x)=\frac{3(x-2)-1\times(3x+1)}{(x-2)^2}=\frac{3x-6-3x-1}{(x-2)^2}=\frac{-7}{(x-2)^2}<0$$
إذن $f$ متناقص تماماً على $[3,+\infty[$، فالمتتالية $(u_n)_{n\ge3}$ متناقصة تماماً.

**Answer.** $\boxed{(u_n)_{n\ge3}\ \text{متناقصة تماماً}}$ ($u_3=10,\ u_4=\frac{13}2,\ u_5=\frac{16}3,\dots$; they approach $3$ from above since $f(x)=3+\frac{7}{x-2}$).

**Alternative.** «إشارة الفرق»: $u_{n+1}=\dfrac{3n+4}{n-1}$ and
$u_{n+1}-u_n=\dfrac{(3n+4)(n-2)-(3n+1)(n-1)}{(n-1)(n-2)}=\dfrac{(3n^2-2n-8)-(3n^2-2n-1)}{(n-1)(n-2)}=\dfrac{-7}{(n-1)(n-2)}<0$ for $n\ge3$ (the denominator is positive only once $n\ge3$).
Or rewrite $f(x)=\dfrac{3(x-2)+7}{x-2}=3+\dfrac{7}{x-2}$: as $x$ grows, $\frac{7}{x-2}$ decreases.

**انتبه.** "$f'<0$ wherever it is defined" does **not** make the sequence decreasing across $n=2$: $u_1=-4<u_3=10$. State $n_0=3$ explicitly.

### ④-6  $u_n=\dfrac{n}{10^n}$

**Domain / $n_0$ (key point).** Defined for all $n\ge0$, but $u_0=0$, $u_1=\frac1{10}$: the sequence goes **up** once, then down. Monotonic only from $n_0=1$ — the same situation as the lesson's $v_n=(n-1)^2$ ($v_0>v_1$, increasing from $n_0=1$).

**Pause-beat hint.** احسب $u_{n+1}-u_n$ بمقام مشترك $10^{n+1}$، وانظر إلى إشارته عند $n=0$ ثمّ عند $n\ge1$.

**Method.** «إشارة الفرق» — one computation covers $n=0$ and $n\ge1$ and shows exactly where monotonicity starts.

**Exam-style solution.**
$$u_{n+1}-u_n=\frac{n+1}{10^{n+1}}-\frac{n}{10^n}=\frac{n+1}{10^{n+1}}-\frac{10n}{10^{n+1}}=\frac{1-9n}{10^{n+1}}$$
وبما أنّ $10^{n+1}>0$، فإشارة الفرق من إشارة $1-9n$:
- عند $n=0$: $1-9n=1>0$، إذن $u_1>u_0$ ($u_0=0<u_1=\frac1{10}$).
- في حالة $n\ge1$: $9n\ge9>1$، إذن $1-9n<0$ ومنه $u_{n+1}<u_n$.

إذن المتتالية $(u_n)_{n\ge1}$ متناقصة تماماً بدءاً من الحدّ ذي الدليل $n_0=1$، أمّا $(u_n)_{n\ge0}$ فليست مطّردة ($u_0<u_1$ و $u_1>u_2$).

**Answer.** $\boxed{u_0<u_1\ \text{ثمّ}\ (u_n)_{n\ge1}\ \text{متناقصة تماماً (بدءاً من}\ n_0=1)}$
(terms: $0,\ \frac1{10},\ \frac1{50},\ \frac3{1000},\ \frac1{2500},\dots$).

**Alternative (for $n\ge1$ only).** «مقارنة النسبة بالواحد»: for $n\ge1$, $u_n>0$ and $\dfrac{u_{n+1}}{u_n}=\dfrac{n+1}{10^{n+1}}\times\dfrac{10^n}{n}=\dfrac{n+1}{10n}$; $\dfrac{n+1}{10n}<1\iff n+1<10n\iff 1<9n$, true for every $n\ge1$. The case $n=0$ must then be handled separately ($u_0=0<u_1$).

**انتبه.** The ratio cannot be written at $n=0$ ($u_0=0$: division by zero; the method needs strictly positive terms). Saying "decreasing for every $n\ge0$" is wrong because $u_0<u_1$.

### ④-7  $u_0=2,\ u_{n+1}=u_n-3$

**Domain / $n_0$.** $n_0=0$.

**Pause-beat hint.** العلاقة التدريجيّة تعطيك الفرق $u_{n+1}-u_n$ مباشرةً.

**Method.** «إشارة الفرق» (directly from the recursion).

**Exam-style solution.**
أيّاً كان $n$: $u_{n+1}-u_n=-3<0$، إذن $u_{n+1}<u_n$، فالمتتالية $(u_n)_{n\ge0}$ متناقصة تماماً.
(وهي متتالية حسابيّة أساسها $r=-3$: $u_n=2-3n$.)

**Answer.** $\boxed{(u_n)_{n\ge0}\ \text{متناقصة تماماً}}$ ($2,\,-1,\,-4,\,-7,\dots$).

**Subtlety.** General rule: an arithmetic sequence is strictly increasing iff $r>0$, strictly decreasing iff $r<0$, constant iff $r=0$.

**انتبه.** No need to compute $u_n$: the recursion already gives the difference. The ratio method is not appropriate (terms become negative).

### ④-8  $u_0=1,\ u_{n+1}=\dfrac12u_n$

**Domain / $n_0$.** $n_0=0$.

**Pause-beat hint.** هذه متتالية هندسيّة: تأكّد أوّلاً أنّ حدودها موجبة تماماً، ثمّ قارن النسبة بالواحد.

**Method.** «مقارنة النسبة بالواحد» (after proving positivity).

**Exam-style solution.**
المتتالية هندسيّة أساسها $q=\frac12$ وحدّها الأوّل $u_0=1$، إذن $u_n=u_0\,q^n=\left(\frac12\right)^n>0$ أيّاً كان $n$. ومنه
$$\frac{u_{n+1}}{u_n}=\frac12<1\ \Rightarrow\ u_{n+1}<u_n$$
فالمتتالية $(u_n)_{n\ge0}$ متناقصة تماماً.

**Answer.** $\boxed{(u_n)_{n\ge0}\ \text{متناقصة تماماً}}$ ($1,\ \frac12,\ \frac14,\ \frac18,\dots$).

**Alternative.** «إشارة الفرق»: $u_{n+1}-u_n=\frac12u_n-u_n=-\frac12u_n=-\left(\frac12\right)^{n+1}<0$.

**انتبه.** "Ratio $<1$ ⇒ decreasing" holds **only because the terms are positive**: with $u_0=-1$ the same relation gives $-1,-\frac12,-\frac14,\dots$, which is **increasing**. Always state $u_n>0$ first.

### ④-9  $u_0=1,\ u_{n+1}=2u_n$

**Domain / $n_0$.** $n_0=0$.

**Pause-beat hint.** متتالية هندسيّة أساسها $2$ وحدودها موجبة: قارن النسبة بالواحد.

**Method.** «مقارنة النسبة بالواحد» (after proving positivity).

**Exam-style solution.**
المتتالية هندسيّة أساسها $q=2$ وحدّها الأوّل $u_0=1$، إذن $u_n=2^n>0$ أيّاً كان $n$. ومنه
$$\frac{u_{n+1}}{u_n}=2>1\ \Rightarrow\ u_{n+1}>u_n$$
فالمتتالية $(u_n)_{n\ge0}$ متزايدة تماماً.

**Answer.** $\boxed{(u_n)_{n\ge0}\ \text{متزايدة تماماً}}$ ($1,\ 2,\ 4,\ 8,\dots$).

**Alternative.** «إشارة الفرق»: $u_{n+1}-u_n=2u_n-u_n=u_n=2^n>0$.

**انتبه.** Same trap as ④-8: "$q>1$ ⇒ increasing" is true only for positive terms; with $u_0=-1$ the terms $-1,-2,-4,\dots$ **decrease**.

---

## Method distribution in ④ (for the video)

- «اطّراد التابع»: ④-1 ($n_0=1$), ④-2, ④-5 ($n_0=3$)
- «إشارة الفرق»: ④-3, ④-4, ④-6 ($n_0=1$), ④-7
- «مقارنة النسبة بالواحد»: ④-8, ④-9 (and as the alternative in ④-1, ④-4, ④-6 for $n\ge1$)

Items with an explicit domain / $n_0$ statement required by the spec: ④-1 ($n_0=1$, $u_0$ undefined), ④-5 ($n_0=3$, $u_2$ undefined), ④-6 ($u_0<u_1$, decreasing from $n_0=1$).

## Reconciliation notes (two independent solutions)

All final results, domains and $n_0$ values agreed. Differences settled here:
1. **Sub-question count**: `SOLUTIONS_SPEC.md` says 19; the page has 21 (1 + 8 + 3 + 9). All 21 are solved above.
2. **④-1 primary method**: one solution used the ratio, the other the function. Both valid (verified); the function method is kept as primary because it shows the interval $[n_0,+\infty[=[1,+\infty[$ exactly as the book's method ②, the ratio and the difference are listed as alternatives.
3. **④-6 primary method**: one solution used the difference, the other the ratio for $n\ge1$. Both valid (verified: $u_{n+1}-u_n=\frac{1-9n}{10^{n+1}}$, $\frac{u_{n+1}}{u_n}=\frac{n+1}{10n}$); the difference is kept as primary because a single formula proves both $u_0<u_1$ and the decrease from $n_0=1$, without excluding $u_0=0$; the ratio is listed as the alternative with its $u_0=0$ caveat.
