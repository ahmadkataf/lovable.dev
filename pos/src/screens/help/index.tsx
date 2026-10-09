// In-app help: short answers to what shop owners ask most, plus where to get support.
import { useState } from 'react'
import { ChevronDown, LifeBuoy, MessageCircle } from 'lucide-react'
import { addMessages, useT, useLang } from '../../i18n'
import { useStore } from '../../state/store'
import { platform } from '../../lib/platform'
import { Button } from '../../components/ui'
import { DEFAULT_INFO } from '../../license/types'

addMessages({
  ar: {
    'help.title': 'المساعدة',
    'help.intro': 'إجابات سريعة عن الأسئلة الشائعة. لم تجد جوابك؟ راسل الدعم على واتساب.',
    'help.contact': 'تواصل مع الدعم',
    'help.version': 'الإصدار',
  },
  en: {
    'help.title': 'Help',
    'help.intro': 'Quick answers to the common questions. Not here? Message support on WhatsApp.',
    'help.contact': 'Contact support',
    'help.version': 'Version',
  },
})

const FAQ_AR: [string, string][] = [
  ['كيف أبدأ البيع؟', 'أضف منتجاتك من «المنتجات» (أو استوردها من ملف CSV)، ثم افتح «البيع»: اضغط على المنتج أو امسح باركوده، ثم «الدفع» واختر طريقة الدفع. الفاتورة تُطبع أو تُشارك على واتساب.'],
  ['المسح بالكاميرا لا يعمل', 'اسمح للتطبيق باستخدام الكاميرا من إعدادات الهاتف ← التطبيقات ← كاسب ← الأذونات. قرّب الباركود حتى يملأ الإطار، وفعّل الإضاءة في الأماكن المعتمة. يمكنك دائماً كتابة الرقم يدوياً أسفل شاشة المسح.'],
  ['هل يعمل مع قارئ باركود USB أو بلوتوث؟', 'نعم بدون أي إعداد: وصّل القارئ وامسح وأنت في شاشة البيع، فيُضاف المنتج فوراً. أرقام الفواتير على الإيصال تُقرأ أيضاً لفتح الفاتورة في «الفواتير».'],
  ['كيف أطبع على طابعة حرارية؟', 'على ويندوز: ثبّت تعريف الطابعة ثم اخترها من الإعدادات ← الفاتورة، وفعّل «طباعة تلقائية» ليُطبع الإيصال بعد كل بيع بلا نوافذ. على أندرويد: تُفتح نافذة الطباعة الخاصة بالنظام، أو شارك الإيصال مع تطبيق الطابعة (مثل RawBT) لطابعات البلوتوث.'],
  ['منتج بلا باركود', 'افتح بطاقة المنتج واضغط «توليد باركود داخلي»، ثم اطبع ملصقاً له من قائمة المنتج. الباركود الداخلي يبدأ بـ 200 ولا يتعارض مع باركودات الشركات.'],
  ['البيع بالوزن', 'فعّل «كميات عشرية» في بطاقة المنتج (الخضار، اللحوم) فيمكن إدخال 0.250 كغ. وإن كان لديك ميزان يطبع ملصقات، فعّل «باركود الميزان» من الإعدادات ← نقطة البيع ليُقرأ الوزن من الملصق مباشرة.'],
  ['البيع بالكرتونة أو العلبة', 'في بطاقة المنتج أضف «وحدة بيع»: الاسم (كرتونة)، العدد (24)، السعر، وباركود الكرتونة إن وُجد. تظهر الوحدة كزر صغير على بطاقة المنتج في شاشة البيع، ومسح باركود الكرتونة يبيعها مباشرة. المخزون يبقى بالقطعة ويُخصم 24 عند بيع كرتونة.'],
  ['سعر الجملة', 'ضع «سعر الجملة» في بطاقة المنتج، وصنّف العميل «جملة» من صفحته. عند اختيار هذا العميل في شاشة البيع تتحول الأسعار تلقائياً إلى سعر الجملة، وعند إزالته تعود للمفرّق.'],
  ['الدفع بالدولار', 'من الإعدادات ← العملة فعّل «عملة ثانية» وضع سعر الصرف. في شاشة الدفع اضغط رمز الدولار، أدخل المبلغ المستلم، ويظهر الباقي بالليرة والدولار معاً.'],
  ['ديون العملاء', 'عند الدفع اختر العميل ثم «دين (آجل)»، أو ادفع جزءاً نقداً ويُسجَّل الباقي ديناً. من صفحة العميل: كشف الحساب، «تسديد دفعة»، وتذكير بالرصيد على واتساب.'],
  ['إرجاع بضاعة', 'افتح الفاتورة من «الفواتير» ← «إرجاع»، اختر الأصناف والكميات، وحدّد هل تعود للمخزون. يُسترد المبلغ نقداً أو يُخصم من حساب العميل.'],
  ['الورديات وفرق الصندوق', 'افتح وردية في بداية الدوام بالنقد الموجود في الدرج. عند الإغلاق عدّ النقد؛ يحسب التطبيق النقد المتوقع ويبيّن الفرق. تقرير الوردية يُطبع أو يُشارك.'],
  ['النسخ الاحتياطي', 'من الإعدادات ← النسخ الاحتياطي: «تصدير» يحفظ ملفاً واحداً بكل بياناتك، و«استعادة» تعيده. المشتركون في التخزين السحابي تُرفع نسختهم تلقائياً كل يوم وتُستعاد من أي جهاز.'],
  ['نقل الترخيص إلى جهاز جديد', 'من الإعدادات ← حول التطبيق ← التفعيل اضغط «نقل الترخيص لجهاز آخر» على الجهاز القديم، ثم فعّل الكود نفسه على الجديد. إن ضاع الجهاز القديم يحرّره البائع من لوحته.'],
  ['التطبيق يطلب الاتصال بالإنترنت', 'يتحقق التطبيق من الترخيص دورياً بصمت. إن بقي الجهاز بلا إنترنت أكثر من فترة السماح يتوقف حتى يتصل مرة واحدة. البيع نفسه لا يحتاج إنترنت.'],
  ['الكاشير يرى التكلفة والتقارير', 'أنشئ له حساباً بدور «كاشير» من الإعدادات ← المستخدمون مع رمز PIN: الكاشير يبيع ويستلم ويرجع، ولا يرى التقارير ولا الإعدادات ولا التكلفة.'],
]
const FAQ_EN: [string, string][] = [
  ['How do I start selling?', 'Add products in Products (or import a CSV), open Sell, tap a product or scan its barcode, then Charge and pick the payment method. The receipt prints or goes to WhatsApp.'],
  ['Camera scanning does not work', 'Allow the camera in the phone settings → Apps → Kaseb → Permissions. Bring the barcode close until it fills the frame and use the torch in the dark. You can always type the number below the scanner.'],
  ['Does it work with a USB or Bluetooth scanner?', 'Yes, with no setup: plug it in and scan on the Sell screen. Receipt numbers on the printed slip can be scanned too, to open the receipt in History.'],
  ['Printing on a thermal printer', 'Windows: install the printer driver, pick it in Settings → Receipt and enable auto-print. Android: the system print dialog opens, or share the receipt with your printer app (e.g. RawBT) for Bluetooth printers.'],
  ['A product without a barcode', 'Open the product and press "Generate internal barcode", then print a label. Internal codes start with 200 and never clash with manufacturer codes.'],
  ['Selling by weight', 'Enable fractional quantities on the product (vegetables, meat) to enter 0.250 kg. With a label scale, enable Scale barcodes in Settings → Point of sale so the weight is read from the label.'],
  ['Selling by the carton or box', 'On the product card add a "sale unit": name (Carton), count (24), price and the carton barcode if it has one. The unit shows as a small button on the product in Sell, and scanning the carton barcode sells it directly. Stock stays in pieces and drops by 24 per carton sold.'],
  ['Wholesale price', 'Set a "wholesale price" on the product and mark the customer as Wholesale on their page. Picking that customer in Sell switches the prices to wholesale automatically; removing them switches back to retail.'],
  ['Paying in dollars', 'Settings → Currency: enable the second currency and set the rate. On the payment screen tap the dollar symbol, enter what you received, and the change shows in both currencies.'],
  ['Customer debts', 'At payment pick the customer and choose On credit, or take part in cash and the rest goes on the account. The customer page has the statement, Receive payment and a WhatsApp reminder.'],
  ['Returns', 'Open the receipt in History → Refund, pick the items and quantities and whether they go back to stock. The money is returned in cash or taken off the customer account.'],
  ['Shifts and cash differences', 'Open a shift with the cash in the drawer. When closing, count the cash; the app computes the expected amount and shows the difference. The shift report prints or shares.'],
  ['Backups', 'Settings → Backup: Export saves one file with everything, Restore brings it back. Cloud subscribers get a daily upload that can be restored on any device.'],
  ['Moving the license to a new device', 'Settings → About → Activation: press "Move the license" on the old device, then activate the same code on the new one. If the old device is lost, the seller frees it from the panel.'],
  ['The app asks for the internet', 'It verifies the license quietly from time to time. Offline longer than the grace period, it pauses until it connects once. Selling itself never needs the internet.'],
  ['Cashiers seeing costs and reports', 'Create a Cashier user with a PIN in Settings → Users: cashiers sell, take payments and refund, and never see reports, settings or costs.'],
]

export default function HelpScreen() {
  const t = useT()
  const lang = useLang()
  const lic = useStore(s => s.license)
  const [open, setOpen] = useState<number | null>(0)
  const faq = lang === 'ar' ? FAQ_AR : FAQ_EN
  const wa = (lic.info?.whatsapp ?? DEFAULT_INFO.whatsapp).replace(/\D/g, '')
  return (
    <div className="page">
      <div className="page-head"><h1>{t('help.title')}</h1></div>
      <div className="page-body narrow">
        <div className="card pad row" style={{ gap: 12, marginBottom: 14 }}>
          <LifeBuoy size={28} style={{ color: 'var(--primary)', flex: 'none' }} />
          <p className="small muted grow">{t('help.intro')}</p>
          {wa && <Button variant="primary" icon={<MessageCircle size={16} />} onClick={() => platform.openUrl(`https://wa.me/${wa}`)}>{t('help.contact')}</Button>}
        </div>
        <div className="card flat">
          {faq.map(([q, a], i) => (
            <div key={i} style={{ borderBottom: i < faq.length - 1 ? '1px solid var(--line)' : undefined }}>
              <button type="button" className="list-row" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <span className="title grow">{q}</span>
                <ChevronDown size={18} className="faint" style={{ transform: open === i ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
              </button>
              {open === i && <p className="muted" style={{ padding: '0 14px 14px', lineHeight: 1.8 }}>{a}</p>}
            </div>
          ))}
        </div>
        <p className="xs faint center" style={{ marginTop: 16 }}>{t('help.version')} <span className="num">{platform.appVersion()}</span> · {platform.kind}</p>
      </div>
    </div>
  )
}
