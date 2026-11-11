import { useEffect, useState } from 'react';

type DisciplineOption = { discipline: { id: number; name: string } };
type RoomOption = { id: number; building: string; number: string };
type TeacherBooking = {
  id: number;
  topic: string;
  status: 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  teacherComment: string | null;
  student: { fullName: string; email: string };
  slot: {
    startsAt: string;
    endsAt: string;
    discipline: { name: string };
    auditorium: { building: string; number: string };
  };
};
type Props = {
  token: string;
  disciplines: DisciplineOption[];
  auditoriums: RoomOption[];
  onSlotsChanged: () => Promise<void>;
};
const API = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

async function call<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message;
    throw new Error(Array.isArray(message) ? message.join(', ') : message || `HTTP ${response.status}`);
  }
  return data as T;
}

const weekDays = [
  { id: 1, label: 'Пн' }, { id: 2, label: 'Вт' }, { id: 3, label: 'Ср' },
  { id: 4, label: 'Чт' }, { id: 5, label: 'Пт' }, { id: 6, label: 'Сб' },
  { id: 0, label: 'Нд' },
];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function CourseTeacherTools({ token, disciplines, auditoriums, onSlotsChanged }: Props) {
  const [bookings, setBookings] = useState<TeacherBooking[]>([]);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [disciplineId, setDisciplineId] = useState('');
  const [auditoriumId, setAuditoriumId] = useState('');
  const [monday, setMonday] = useState('');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('14:30');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function refreshBookings() {
    const result = await call<TeacherBooking[]>('/course/teacher/bookings', token);
    setBookings(result);
    setComments(Object.fromEntries(result.map((booking) => [booking.id, booking.teacherComment || ''])));
  }

  useEffect(() => {
    let active = true;
    void call<TeacherBooking[]>('/course/teacher/bookings', token)
      .then((result) => {
        if (!active) return;
        setBookings(result);
        setComments(Object.fromEntries(result.map((booking) => [booking.id, booking.teacherComment || ''])));
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : 'Помилка завантаження записів');
      });
    return () => { active = false; };
  }, [token]);

  async function createWeek(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      if (!monday || !disciplineId || !auditoriumId || days.length === 0) {
        throw new Error('Заповніть усі поля та оберіть дні');
      }
      const mondayDate = new Date(`${monday}T12:00:00`);
      if (!Number.isFinite(mondayDate.getTime()) || mondayDate.getDay() !== 1) {
        throw new Error('Оберіть понеділок потрібного тижня');
      }
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      if (sh * 60 + sm >= eh * 60 + em) throw new Error('Кінець має бути пізніше початку');

      const slots = days.map((weekday) => {
        const start = new Date(mondayDate);
        start.setDate(mondayDate.getDate() + (weekday === 0 ? 6 : weekday - 1));
        start.setHours(sh, sm, 0, 0);
        const end = new Date(start);
        end.setHours(eh, em, 0, 0);
        if (start <= new Date()) throw new Error('Усі дати повинні бути в майбутньому');
        return { startsAt: start.toISOString(), endsAt: end.toISOString() };
      });

      const result = await call<{ count: number }>('/course/teacher/slots/weekly', token, {
        method: 'POST',
        body: JSON.stringify({ disciplineId: Number(disciplineId), auditoriumId: Number(auditoriumId), slots }),
      });
      await onSlotsChanged();
      setNotice(`Створено ${result.count} консультацій за один запит.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Помилка створення серії');
    } finally {
      setBusy(false);
    }
  }

  async function finish(id: number, status: 'COMPLETED' | 'NO_SHOW') {
    setBusy(true);
    setNotice('');
    try {
      await call(`/course/teacher/bookings/${id}/finish`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status, teacherComment: comments[id]?.trim() || '' }),
      });
      await refreshBookings();
      setNotice('Результат консультації збережено.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Помилка збереження');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #d8e2e9' }} />
      <h3>Створити серію консультацій на тиждень</h3>
      <p className="muted">Оберіть понеділок і дні. Уся серія створюється однією операцією, кожен слот — окремий запис у базі.</p>
      {notice && <div className="notice" role="status">{notice}</div>}
      <form className="form" onSubmit={(event) => { void createWeek(event); }}>
        <label>Дисципліна
          <select className="field" required value={disciplineId} onChange={(event) => setDisciplineId(event.target.value)}>
            <option value="">Оберіть дисципліну</option>
            {disciplines.map(({ discipline }) => <option key={discipline.id} value={discipline.id}>{discipline.name}</option>)}
          </select>
        </label>
        <label>Аудиторія
          <select className="field" required value={auditoriumId} onChange={(event) => setAuditoriumId(event.target.value)}>
            <option value="">Оберіть аудиторію</option>
            {auditoriums.map((room) => <option key={room.id} value={room.id}>{room.building} — {room.number}</option>)}
          </select>
        </label>
        <label>Понеділок тижня
          <input className="field" type="date" required value={monday} onChange={(event) => setMonday(event.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label>Початок <input className="field" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          <label>Кінець <input className="field" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        </div>
        <strong>Дні проведення</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {weekDays.map((day) => (
            <label key={day.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="checkbox" checked={days.includes(day.id)} onChange={(event) => setDays((prev) => event.target.checked ? [...prev, day.id] : prev.filter((v) => v !== day.id))} />
              {day.label}
            </label>
          ))}
        </div>
        <button className="button button-primary full" disabled={busy || !disciplines.length || !auditoriums.length} type="submit">
          Створити серію слотів
        </button>
      </form>

      <h3 style={{ marginTop: 34 }}>Записи студентів на мої консультації</h3>
      <button className="button button-outline" disabled={busy} onClick={() => { void refreshBookings().catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Помилка')); }}>Оновити записи</button>
      <div className="slot-list" style={{ marginTop: 16 }}>
        {bookings.length === 0 && <p className="muted">Записів студентів поки немає.</p>}
        {bookings.map((booking) => (
          <article className="slot-card" key={booking.id}>
            <strong>{booking.student.fullName}</strong> <span className="muted">({booking.student.email})</span>
            <p>{booking.slot.discipline.name} · {dateLabel(booking.slot.startsAt)}</p>
            <p><strong>Тема питання:</strong> {booking.topic}</p>
            <p>Статус: {booking.status}</p>
            {booking.status === 'BOOKED' && new Date(booking.slot.endsAt) <= new Date() ? (
              <div className="form">
                <label>Коментар після консультації
                  <textarea className="field" value={comments[booking.id] ?? ''} maxLength={2000} rows={2} onChange={(event) => setComments((prev) => ({ ...prev, [booking.id]: event.target.value }))} />
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="button button-primary" disabled={busy} onClick={() => { void finish(booking.id, 'COMPLETED'); }}>Проведено</button>
                  <button className="button button-outline" disabled={busy} onClick={() => { void finish(booking.id, 'NO_SHOW'); }}>Неявка</button>
                </div>
              </div>
            ) : booking.status === 'BOOKED' ? (
              <p className="muted">Відмітка доступна після завершення консультації.</p>
            ) : booking.teacherComment ? (
              <p><strong>Коментар:</strong> {booking.teacherComment}</p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
