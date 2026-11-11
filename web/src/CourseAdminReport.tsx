import { useState } from 'react';

type Row = {
  id: number;
  status: 'COMPLETED' | 'NO_SHOW';
  topic: string;
  teacherComment: string | null;
  student: { fullName: string; email: string };
  slot: {
    startsAt: string;
    endsAt: string;
    teacher: { user: { fullName: string } };
    discipline: { name: string };
  };
};
type Report = { completed: number; noShow: number; rows: Row[] };
type Stats = {
  teachers: number;
  disciplines: number;
  slots: number;
  students: number;
  bookings: number;
  studentDisciplineLinks: number;
};
const API = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

function localDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Невідома помилка';
}
function csvField(value: string | number | null | undefined) {
  let cell = String(value ?? '').replace(/[\r\n]/g, ' ');
  if (/^[\s]*[=+\-@]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
}
function downloadCsv(rows: Row[]) {
  const headers = [
    'ID', 'Дата', 'Викладач', 'Студент', 'Email студента',
    'Дисципліна', 'Тема', 'Статус', 'Коментар',
  ];
  const lines = [headers.map(csvField).join(';')];
  for (const row of rows) {
    lines.push([
      row.id, new Date(row.slot.startsAt).toLocaleString('uk-UA'),
      row.slot.teacher.user.fullName, row.student.fullName, row.student.email,
      row.slot.discipline.name, row.topic, row.status, row.teacherComment ?? '',
    ].map(csvField).join(';'));
  }
  const blob = new Blob(['\ufeff', ...lines.map((line) => `${line}\r\n`)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `consultations-report-${localDate(new Date())}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function CourseAdminReport({ token }: { token: string }) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [fromDate, setFromDate] = useState(localDate(monthStart));
  const [toDate, setToDate] = useState(localDate(today));
  const [report, setReport] = useState<Report | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    setBusy(true);
    setNotice('');
    try {
      if (!fromDate || !toDate || fromDate > toDate) throw new Error('Перевірте дати періоду');
      const from = new Date(`${fromDate}T00:00:00`).toISOString();
      const dayAfter = new Date(`${toDate}T00:00:00`);
      dayAfter.setDate(dayAfter.getDate() + 1);
      const to = dayAfter.toISOString();
      const headers = { Authorization: `Bearer ${token}` };
      const [reportResponse, statsResponse] = await Promise.all([
        fetch(`${API}/course/admin/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers }),
        fetch(`${API}/course/admin/stats`, { headers }),
      ]);
      if (!reportResponse.ok || !statsResponse.ok) {
        const error = await (!reportResponse.ok ? reportResponse : statsResponse).json().catch(() => ({}));
        throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message || 'Помилка завантаження звіту');
      }
      setReport(await reportResponse.json() as Report);
      setStats(await statsResponse.json() as Stats);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 26 }}>
      <h3>Звіт про консультації</h3>
      <p className="muted">У звіт потрапляють консультації зі статусом «Проведено» або «Неявка» за вказаний період.</p>
      <div className="form">
        <label>Початок періоду
          <input className="field" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label>Кінець періоду
          <input className="field" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <button className="button button-primary" type="button" disabled={busy} onClick={() => { void load(); }}>
          {busy ? 'Завантаження...' : 'Сформувати звіт'}
        </button>
      </div>
      {notice && <div className="notice" role="status" style={{ marginTop: 16 }}>{notice}</div>}
      {stats && (
        <div style={{ marginTop: 24 }}>
          <h3>Наповнення бази даних</h3>
          <p className="muted">Викладачі: {stats.teachers}/30 · Дисципліни: {stats.disciplines}/20 · Слоти: {stats.slots}/800</p>
          <p className="muted">Студенти: {stats.students}/300 · Записи: {stats.bookings}/500 · Зв'язки студент–дисципліна: {stats.studentDisciplineLinks}</p>
          <p className="muted">Це фактичні значення в базі. Позначення /30, /20 тощо — вимоги технічного завдання, а не обмеження.</p>
        </div>
      )}
      {report && (
        <div style={{ marginTop: 24 }}>
          <h3>Результати: проведено — {report.completed}, неявка — {report.noShow}</h3>
          <button className="button button-outline" disabled={report.rows.length === 0} onClick={() => downloadCsv(report.rows)}>Експорт CSV</button>
          <div className="slot-list" style={{ marginTop: 16 }}>
            {report.rows.length === 0 && <p className="muted">Записів за цей період немає.</p>}
            {report.rows.map((row) => (
              <article className="slot-card" key={row.id}>
                <strong>{row.slot.discipline.name}</strong>
                <p>{new Date(row.slot.startsAt).toLocaleString('uk-UA')} · {row.status === 'COMPLETED' ? 'Проведено' : 'Неявка'}</p>
                <p>Викладач: {row.slot.teacher.user.fullName}</p>
                <p>Студент: {row.student.fullName}</p>
                <p>Тема: {row.topic}</p>
                {row.teacherComment && <p>Коментар: {row.teacherComment}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
