/* Read-only announcements list for parents, students and teachers (the school
   and the directorate have their own composers). Notification links of the form
   «/announcements/:id» land here. */

import { Empty, ErrorBox, PageHead, Skeleton, Tag, Tile } from '../components/Ui';
import { count, fmtWhen, NOUNS } from '../format';
import { useApi } from '../hooks';
import type { Announcement } from '../types';

export function AnnouncementRow({ a }: { a: Announcement }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <span className="grow">
        <b>{a.title}</b>
        <span className="small wrap-text" style={{ display: 'block' }}>{a.body}</span>
        <small>{fmtWhen(a.created_at)}{a.notified ? ` · ${count(a.notified, a.school_id === null ? NOUNS.school : NOUNS.guardian)}` : ''}</small>
      </span>
      {a.school_id === null ? <Tag tone="teal">تعميم المديرية</Tag> : a.urgent ? <Tag tone="red">عاجل</Tag> : <Tag tone="gray">إعلان</Tag>}
    </div>
  );
}

export function AnnouncementsList() {
  const { data, error, loading, reload } = useApi<Announcement[]>('/api/announcements');
  return (
    <>
      <PageHead title="الإعلانات" sub="إعلانات المدرسة وتعاميم المديرية" />
      <Tile className="full">
        {loading && !data && <Skeleton lines={3} />}
        {error && !data && <ErrorBox error={error} retry={reload} />}
        {data && data.length === 0 && <Empty icon="megaphone" title="لا إعلانات بعد" text="تظهر هنا إعلانات المدرسة فور إرسالها." />}
        <div className="list">
          {(data ?? []).map((a) => <AnnouncementRow key={a.id} a={a} />)}
        </div>
      </Tile>
    </>
  );
}
