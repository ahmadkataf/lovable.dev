// PLACEHOLDER — the products module replaces this file.
import { useT } from '../../i18n'
export default function Screen() {
  const t = useT()
  return <div className="page"><div className="page-head"><h1>{t('nav.products')}</h1></div><div className="page-body"><div className="empty"><p>{t('common.loading')}</p></div></div></div>
}
