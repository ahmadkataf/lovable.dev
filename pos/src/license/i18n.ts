import { addMessages } from '../i18n'

// Every error the server (or the network) can answer with, as 'license.err.<key>'.
addMessages({
  ar: {
    'license.err.invalid_code': 'الكود غير صحيح. تأكد من كتابته كما وصلك من البائع.',
    'license.err.revoked': 'أُلغي هذا الترخيص. تواصل مع البائع.',
    'license.err.expired': 'انتهت صلاحية الترخيص.',
    'license.err.device_limit': 'هذا الكود مستخدم على جهاز آخر. اطلب من البائع نقله إلى جهازك.',
    'license.err.tampered': 'هذه النسخة من التطبيق معدّلة ولا يمكن تفعيلها. ثبّت النسخة الأصلية.',
    'license.err.rate_limited': 'محاولات كثيرة. انتظر بضع دقائق ثم أعد المحاولة.',
    'license.err.min_version': 'حدّث التطبيق إلى آخر إصدار للمتابعة.',
    'license.err.no_trial': 'التجربة المجانية غير متاحة لهذا الجهاز.',
    'license.err.invalid_token': 'بيانات الترخيص غير صالحة. أدخل الكود من جديد.',
    'license.err.device_mismatch': 'انتقل هذا الترخيص إلى جهاز آخر.',
    'license.err.move_limit': 'استُنفدت مرات النقل الذاتي. اطلب من البائع نقل الترخيص.',
    'license.err.network': 'تعذّر الاتصال بالخادم. تأكد من الإنترنت وأعد المحاولة.',
    'license.err.unknown': 'حدث خطأ غير متوقع. أعد المحاولة بعد قليل.',
  },
  en: {
    'license.err.invalid_code': 'That code is not valid. Type it exactly as the seller gave it to you.',
    'license.err.revoked': 'This license was cancelled. Contact the seller.',
    'license.err.expired': 'The license has expired.',
    'license.err.device_limit': 'This code is in use on another device. Ask the seller to move it to yours.',
    'license.err.tampered': 'This copy of the app was modified and cannot be activated. Install the original build.',
    'license.err.rate_limited': 'Too many attempts. Wait a few minutes and try again.',
    'license.err.min_version': 'Update the app to the latest version to continue.',
    'license.err.no_trial': 'The free trial is not available on this device.',
    'license.err.invalid_token': 'The stored license is not valid. Enter the code again.',
    'license.err.device_mismatch': 'This license moved to another device.',
    'license.err.move_limit': 'No self-moves left. Ask the seller to move the license.',
    'license.err.network': 'Could not reach the server. Check the internet connection and try again.',
    'license.err.unknown': 'Something unexpected happened. Try again in a moment.',
  },
})
