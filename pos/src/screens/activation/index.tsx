// PLACEHOLDER — the license module replaces this file (docs/LICENSE-SPEC.md).
import { useT } from '../../i18n'
export default function ActivationScreen({ embedded }: { embedded?: boolean }) {
  const t = useT()
  return <div className={embedded ? 'page' : 'lock-screen'}><div className="card pad"><h2>{t('nav.activation')}</h2></div></div>
}
