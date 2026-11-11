
import { useEffect, useState } from 'react';

type Teacher = {
    id: number;
    userId: number;
    disciplines: {
        discipline: {
            id: number;
            code: string;
            name: string;
        };
    }[];
};

type Auditorium = {
    id: number;
    building: string;
    number: string;
};

type Slot = {
    id: number;
    startsAt: string;
    endsAt: string;
    isBlocked: boolean;
    discipline: { name: string };
    auditorium: {
        building: string;
        number: string;
    };
};

type Props = {
    token: string;
    userId: number;
};

const API =
    import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

async function api<T>(
    path: string,
    token?: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            ...(options.body
                ? { 'Content-Type': 'application/json' }
                : {}),
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {}),
        },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const message = data?.message;
        throw new Error(
            Array.isArray(message)
                ? message.join(', ')
                : message || `HTTP ${response.status}`,
        );
    }

    return data as T;
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat('uk-UA', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(date));
}

export default function TeacherPanel({ token, userId }: Props) {
    const [disciplines, setDisciplines] = useState<
        Teacher['disciplines']
    >([]);
    const [auditoriums, setAuditoriums] = useState<Auditorium[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]);

    const [disciplineId, setDisciplineId] = useState('');
    const [auditoriumId, setAuditoriumId] = useState('');
    const [startsAt, setStartsAt] = useState('');
    const [endsAt, setEndsAt] = useState('');

    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let active = true;

        Promise.all([
            api<Teacher[]>('/teachers'),
            api<Auditorium[]>('/auditoriums'),
            api<Slot[]>('/slots/mine', token),
        ])
            .then(([teachers, rooms, mySlots]) => {
                if (!active) return;

                const profile = teachers.find(
                    (teacher) => teacher.userId === userId,
                );

                setDisciplines(profile?.disciplines ?? []);
                setAuditoriums(rooms);
                setSlots(mySlots);
            })
            .catch((error: unknown) => {
                if (active) {
                    setMessage(
                        error instanceof Error
                            ? error.message
                            : 'Помилка завантаження',
                    );
                }
            });

        return () => {
            active = false;
        };
    }, [token, userId]);

    async function refreshSlots() {
        const result = await api<Slot[]>('/slots/mine', token);
        setSlots(result);
    }

    async function createSlot() {
        setBusy(true);
        setMessage('');

        try {
            if (
                !disciplineId ||
                !auditoriumId ||
                !startsAt ||
                !endsAt
            ) {
                throw new Error('Заповніть усі поля');
            }

            const start = new Date(startsAt);
            const end = new Date(endsAt);

            if (
                !Number.isFinite(start.getTime()) ||
                !Number.isFinite(end.getTime()) ||
                start <= new Date() ||
                end <= start
            ) {
                throw new Error('Перевірте дату та час консультації');
            }

            await api(
                '/slots',
                token,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        disciplineId: Number(disciplineId),
                        auditoriumId: Number(auditoriumId),
                        startsAt: start.toISOString(),
                        endsAt: end.toISOString(),
                    }),
                },
            );

            await refreshSlots();

            setStartsAt('');
            setEndsAt('');
            setMessage('Консультацію успішно створено!');
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'Помилка створення',
            );
        } finally {
            setBusy(false);
        }
    }

    async function changeSlot(
        id: number,
        action: 'block' | 'unblock' | 'delete',
    ) {
        if (
            action === 'delete' &&
            !window.confirm('Видалити консультацію?')
        ) {
            return;
        }

        setBusy(true);
        setMessage('');

        try {
            if (action === 'delete') {
                await api(`/slots/${id}`, token, {
                    method: 'DELETE',
                });
            } else {
                await api(`/slots/${id}`, token, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        isBlocked: action === 'block',
                    }),
                });
            }

            await refreshSlots();
            setMessage('Зміни успішно збережено');
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'Помилка операції',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="panel">
            <span className="eyebrow">КАБІНЕТ ВИКЛАДАЧА</span>
            <h2>Керування консультаціями</h2>

            {message && (
                <div className="notice" role="status">
                    {message}
                </div>
            )}

            <h3>Нова консультація</h3>

            <form
                className="form"
                onSubmit={(event) => {
                    event.preventDefault();
                    void createSlot();
                }}
            >
                <label>
                    Дисципліна
                    <select
                        className="field"
                        value={disciplineId}
                        onChange={(event) =>
                            setDisciplineId(event.target.value)
                        }
                        required
                    >
                        <option value="">Оберіть дисципліну</option>
                        {disciplines.map(({ discipline }) => (
                            <option
                                key={discipline.id}
                                value={discipline.id}
                            >
                                {discipline.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Аудиторія
                    <select
                        className="field"
                        value={auditoriumId}
                        onChange={(event) =>
                            setAuditoriumId(event.target.value)
                        }
                        required
                    >
                        <option value="">Оберіть аудиторію</option>
                        {auditoriums.map((room) => (
                            <option key={room.id} value={room.id}>
                                {room.building} — {room.number}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Початок
                    <input
                        className="field"
                        type="datetime-local"
                        value={startsAt}
                        onChange={(event) =>
                            setStartsAt(event.target.value)
                        }
                        required
                    />
                </label>

                <label>
                    Завершення
                    <input
                        className="field"
                        type="datetime-local"
                        value={endsAt}
                        onChange={(event) =>
                            setEndsAt(event.target.value)
                        }
                        required
                    />
                </label>

                <button
                    type="submit"
                    className="button button-primary full"
                    disabled={
                        busy ||
                        disciplines.length === 0 ||
                        auditoriums.length === 0
                    }
                >
                    Створити консультацію
                </button>
            </form>

            {disciplines.length === 0 && (
                <p className="muted">
                    Вам ще не призначено жодної дисципліни.
                </p>
            )}

            <h3 style={{ marginTop: 30 }}>Мої консультації</h3>

            <button
                className="button button-outline"
                disabled={busy}
                onClick={() => {
                    void refreshSlots().catch((error: unknown) =>
                        setMessage(
                            error instanceof Error
                                ? error.message
                                : 'Помилка оновлення',
                        ),
                    );
                }}
            >
                Оновити список
            </button>

            <div
                className="slot-list"
                style={{ marginTop: 16 }}
            >
                {slots.length === 0 && (
                    <p className="muted">
                        Консультацій поки немає.
                    </p>
                )}

                {slots.map((slot) => (
                    <article className="slot-card" key={slot.id}>
                        <div className="slot-top">
                            <span
                                className={
                                    slot.isBlocked
                                        ? 'chip chip-muted'
                                        : 'chip'
                                }
                            >
                                {slot.isBlocked
                                    ? 'Заблоковано'
                                    : 'Опубліковано'}
                            </span>
                            <span>№ {slot.id}</span>
                        </div>

                        <h3>{slot.discipline.name}</h3>

                        <p>
                            {formatDate(slot.startsAt)}
                            {' — '}
                            {formatDate(slot.endsAt)}
                        </p>

                        <p>
                            {slot.auditorium.building},{' '}
                            ауд. {slot.auditorium.number}
                        </p>

                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 8,
                                marginTop: 14,
                            }}
                        >
                            <button
                                className="button button-outline"
                                disabled={busy}
                                onClick={() =>
                                    void changeSlot(
                                        slot.id,
                                        slot.isBlocked
                                            ? 'unblock'
                                            : 'block',
                                    )
                                }
                            >
                                {slot.isBlocked
                                    ? 'Розблокувати'
                                    : 'Заблокувати'}
                            </button>

                            <button
                                className="button button-danger"
                                disabled={busy}
                                onClick={() =>
                                    void changeSlot(slot.id, 'delete')
                                }
                            >
                                Видалити
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
