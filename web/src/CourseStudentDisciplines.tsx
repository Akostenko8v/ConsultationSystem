import { useEffect, useState } from 'react';

type DisciplineOption = {
  id: number;
  code: string;
  name: string;
  enrolled: boolean;
};
const API = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

export default function CourseStudentDisciplines({ token }: { token: string }) {
  const [items, setItems] = useState<DisciplineOption[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    const response = await fetch(`${API}/course/student/disciplines`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setItems(await response.json() as DisciplineOption[]);
  }

  useEffect(() => {
    let active = true;
    fetch(`${API}/course/student/disciplines`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json() as DisciplineOption[];
        if (active) setItems(result);
      })
      .catch(() => { if (active) setNotice('Не вдалося завантажити дисципліни'); });
    return () => { active = false; };
  }, [token]);

  async function change(id: number, enroll: boolean) {
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(`${API}/course/student/disciplines/${id}`, {
        method: enroll ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(typeof err?.message === 'string' ? err.message : `HTTP ${response.status}`);
      }
      await load();
      if (enroll) setSelected('');
      setNotice(enroll ? 'Дисципліну додано' : 'Дисципліну вилучено');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Помилка');
    } finally {
      setBusy(false);
    }
  }

  const enrolled = items.filter((item) => item.enrolled);
  const available = items.filter((item) => !item.enrolled);
  return (
    <section className="panel">
      <span className="eyebrow">НАВЧАННЯ</span>
      <h2>Мої дисципліни</h2>
      <p className="muted">Зв'язок студентів з дисциплінами (M:M).</p>
      {notice && <p className="muted" role="status">{notice}</p>}
      {enrolled.length === 0 && <p className="muted">Ви ще не обрали дисципліни.</p>}
      <div className="form">
        {enrolled.map((item) => (
          <div key={item.id} className="slot-card">
            <strong>{item.name}</strong>
            <div>
              <button type="button" className="button button-outline"
                disabled={busy} onClick={() => { void change(item.id, false); }}>
                Вилучити
              </button>
            </div>
          </div>
        ))}
        {available.length > 0 && (
          <>
            <label>Додати дисципліну
              <select className="field" value={selected} onChange={(event) => setSelected(event.target.value)}>
                <option value="">Оберіть дисципліну</option>
                {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <button type="button" className="button button-primary full"
              disabled={busy || !selected} onClick={() => { void change(Number(selected), true); }}>
              Додати
            </button>
          </>
        )}
      </div>
    </section>
  );
}
