import { useMemo, useState } from 'react';
import * as api from '../api';
import { Icon } from '../components/Icon';
import { Btn, Empty, ErrorBox, PageHead, Skeleton, Tag, Tile } from '../components/Ui';
import { addDays, fmtDate, fmtTime, NOTIFICATION_KIND_LABEL, parseServerTime, todayISO, unreadLabel } from '../format';
import { useApi } from '../hooks';
import { navigate } from '../router';
import { refreshUnread, toast } from '../store';
import type { Notification } from '../types';

const TONE: Record<string, 'sun' | 'mint' | 'rose' | 'violet' | 'gray' | 'red' | 'teal' | undefined> = {
  homework: undefined, absence: 'red', substitution: 'violet', change: 'sun', announcement: 'teal', circular: 'teal', message: 'rose', alert: 'sun', attendance: 'mint',
};
const ICON: Record<string, string> = {
  homework: 'book', absence: 'alert', substitution: 'swap', change: 'swap', announcement: 'megaphone', circular: 'megaphone', message: 'msg', alert: 'alert', attendance: 'check',
};

function dayLabel(created: string): string {
  const d = parseServerTime(created);
  if (!d) return '';
  const iso = todayISO(d);
  const today = todayISO();
  if (iso === today) return 'اليوم';
  if (iso === addDays(today, -1)) return 'أمس';
  return fmtDate(iso);
}

export function Notifications() {
  const { data, error, loading, reload } = useApi<Notification[]>('/api/notifications');
  const [busy, setBusy] = useState(false);
  const unread = useMemo(() => (data ?? []).filter((n) => !n.read_at), [data]);

  const groups = useMemo(() => {
    const out: { label: string; items: Notification[] }[] = [];
    for (const n of data ?? []) {
      const label = dayLabel(n.created_at);
      const g = out[out.length - 1];
      if (g && g.label === label) g.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [data]);

  const markAll = async () => {
    if (!unread.length) return;
    setBusy(true);
    try {
      await api.post('/api/notifications/read', { ids: unread.map((n) => n.id) }, { queueable: false });
      toast('عُلّمت كلّ الإشعارات كمقروءة');
      reload();
      void refreshUnread();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'تعذّر التحديث', 'error');
    } finally {
      setBusy(false);
    }
  };

  const open = async (n: Notification) => {
    if (!n.read_at) {
      try { await api.post('/api/notifications/read', { ids: [n.id] }, { queueable: false }); reload(); void refreshUnread(); } catch { /* ignore */ }
    }
    if (n.link && n.link.startsWith('/')) navigate(n.link);
  };

  return (
    <>
      <PageHead
        title="الإشعارات"
        sub={data ? unreadLabel(unread.length) : undefined}
        actions={unread.length ? <Btn variant="light" size="sm" icon="check" loading={busy} onClick={() => { void markAll(); }}>تعليم الكلّ كمقروء</Btn> : undefined}
      />
      <Tile className="full nlist">
        {loading && !data && <Skeleton lines={4} />}
        {error && !data && <ErrorBox error={error} retry={reload} />}
        {data && data.length === 0 && <Empty icon="bell" title="لا إشعارات بعد" text="ستصلك هنا الواجبات والغياب والتغييرات والإعلانات." />}
        {groups.map((g) => (
          <div key={g.label} className="list" style={{ marginBottom: 10 }}>
            <div className="daysep">{g.label}</div>
            {g.items.map((n) => (
              <button type="button" key={n.id} className={`row ${n.read_at ? '' : 'unread'}`} onClick={() => { void open(n); }}>
                <span className="ic"><Icon name={ICON[n.kind] ?? 'bell'} /></span>
                <span className="grow">
                  <span className="wrap-text">{n.body}</span>
                  <small>{fmtTime(n.created_at)}{n.link ? ' · اضغط للانتقال' : ''}</small>
                </span>
                <Tag tone={TONE[n.kind]}>{NOTIFICATION_KIND_LABEL[n.kind] ?? n.kind}</Tag>
              </button>
            ))}
          </div>
        ))}
      </Tile>
    </>
  );
}
