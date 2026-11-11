
import { useEffect, useState } from 'react';

type Discipline = {
    id: number;
    code: string;
    name: string;
};

type Auditorium = {
    id: number;
    building: string;
    number: string;
};

type Teacher = {
    id: number;
    user: { fullName: string };
    disciplines: {
        discipline: { id: number; name: string };
    }[];
};

type Props = { token: string };
type Section = 'disciplines' | 'auditoriums' | 'teachers';

const API =
    import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

async function api<T>(
    path: string,
    token: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            ...(options.body
                ? { 'Content-Type': 'application/json' }
                : {}),
            Authorization: `Bearer ${token}`,
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

function getError(error: unknown) {
    return error instanceof Error
        ? error.message
        : 'Невідома помилка';
}

export default function AdminPanel({ token }: Props) {
    const [section, setSection] = useState<Section>('disciplines');
    const [disciplines, setDisciplines] = useState<Discipline[]>([]);
    const [auditoriums, setAuditoriums] = useState<Auditorium[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);

    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [building, setBuilding] = useState('');
    const [number, setNumber] = useState('');

    const [teacherName, setTeacherName] = useState('');
    const [teacherEmail, setTeacherEmail] = useState('');
    const [teacherPassword, setTeacherPassword] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let active = true;

        Promise.all([
            api<Discipline[]>('/disciplines', token),
            api<Auditorium[]>('/auditoriums', token),
            api<Teacher[]>('/teachers', token),
        ])
            .then(([d, a, t]) => {
                if (!active) return;
                setDisciplines(d);
                setAuditoriums(a);
                setTeachers(t);
            })
            .catch((error: unknown) => {
                if (active) setMessage(getError(error));
            });

        return () => {
            active = false;
        };
    }, [token]);

    async function refresh() {
        const [d, a, t] = await Promise.all([
            api<Discipline[]>('/disciplines', token),
            api<Auditorium[]>('/auditoriums', token),
            api<Teacher[]>('/teachers', token),
        ]);

        setDisciplines(d);
        setAuditoriums(a);
        setTeachers(t);
    }

    async function perform(
        action: () => Promise<unknown>,
        success: string,
    ) {
        setBusy(true);
        setMessage('');

        try {
            await action();
            await refresh();
            setMessage(success);
        } catch (error) {
            setMessage(`Помилка: ${getError(error)}`);
        } finally {
            setBusy(false);
        }
    }

    function editDiscipline(item: Discipline) {
        const newCode = window.prompt('Код дисципліни', item.code);
        if (newCode === null) return;

        const newName = window.prompt('Назва дисципліни', item.name);
        if (newName === null) return;

        void perform(
            () => api(`/disciplines/${item.id}`, token, {
                method: 'PATCH',
                body: JSON.stringify({
                    code: newCode,
                    name: newName,
                }),
            }),
            'Дисципліну оновлено',
        );
    }

    function editAuditorium(item: Auditorium) {
        const newBuilding = window.prompt('Корпус', item.building);
        if (newBuilding === null) return;

        const newNumber = window.prompt('Номер аудиторії', item.number);
        if (newNumber === null) return;

        void perform(
            () => api(`/auditoriums/${item.id}`, token, {
                method: 'PATCH',
                body: JSON.stringify({
                    building: newBuilding,
                    number: newNumber,
                }),
            }),
            'Аудиторію оновлено',
        );
    }

    function editTeacher(item: Teacher) {
        const newName = window.prompt(
            'ПІБ викладача',
            item.user.fullName,
        );

        if (newName === null) return;

        const currentIds = item.disciplines
            .map((d) => d.discipline.id)
            .join(',');

        const input = window.prompt(
            'ID дисциплін через кому (порожньо — без дисциплін)',
            currentIds,
        );

        if (input === null) return;

        const ids = input.trim()
            ? input.split(',').map((value) => Number(value.trim()))
            : [];

        if (
            ids.some(
                (id) =>
                    !Number.isInteger(id) ||
                    id <= 0 ||
                    !disciplines.some((d) => d.id === id),
            )
        ) {
            setMessage('Введіть правильні ID дисциплін');
            return;
        }

        void perform(
            () => api(`/teachers/${item.id}`, token, {
                method: 'PATCH',
                body: JSON.stringify({
                    fullName: newName,
                    disciplineIds: [...new Set(ids)],
                }),
            }),
            'Дані викладача оновлено',
        );
    }

    function deleteItem(path: string, title: string) {
        if (!window.confirm(`Видалити ${title}?`)) return;

        void perform(
            () => api(path, token, { method: 'DELETE' }),
            'Запис видалено',
        );
    }

    return (
        <section className="panel">
            <span className="eyebrow">АДМІНІСТРАТОР</span>
            <h2>Панель керування</h2>

            <label className="form">
                Розділ
                <select
                    className="field"
                    value={section}
                    onChange={(event) =>
                        setSection(event.target.value as Section)
                    }
                >
                    <option value="disciplines">Дисципліни</option>
                    <option value="auditoriums">Аудиторії</option>
                    <option value="teachers">Викладачі</option>
                </select>
            </label>

            {message && (
                <div className="notice" role="status"
                    style={{ marginTop: 16 }}
                >
                    {message}
                </div>
            )}

            <button
                className="button button-outline"
                style={{ marginTop: 16 }}
                disabled={busy}
                onClick={() => {
                    void refresh().catch((error: unknown) =>
                        setMessage(getError(error)),
                    );
                }}
            >
                Оновити дані
            </button>

            {section === 'disciplines' && (
                <>
                    <h3>Нова дисципліна</h3>

                    <form
                        className="form"
                        onSubmit={(event) => {
                            event.preventDefault();

                            void perform(async () => {
                                await api('/disciplines', token, {
                                    method: 'POST',
                                    body: JSON.stringify({ code, name }),
                                });

                                setCode('');
                                setName('');
                            }, 'Дисципліну створено');
                        }}
                    >
                        <input
                            className="field"
                            placeholder="Код, наприклад CS101"
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            required
                            maxLength={30}
                        />

                        <input
                            className="field"
                            placeholder="Назва дисципліни"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                            maxLength={200}
                        />

                        <button
                            className="button button-primary full"
                            disabled={busy}
                            type="submit"
                        >
                            Додати дисципліну
                        </button>
                    </form>

                    <h3 style={{ marginTop: 28 }}>
                        Список дисциплін ({disciplines.length})
                    </h3>

                    <div className="slot-list">
                        {disciplines.map((item) => (
                            <div className="slot-card" key={item.id}>
                                <strong>{item.name}</strong>
                                <p>
                                    #{item.id} · {item.code}
                                </p>

                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        className="button button-outline"
                                        disabled={busy}
                                        onClick={() => editDiscipline(item)}
                                    >
                                        Змінити
                                    </button>

                                    <button
                                        className="button button-danger"
                                        disabled={busy}
                                        onClick={() =>
                                            deleteItem(
                                                `/disciplines/${item.id}`,
                                                item.name,
                                            )
                                        }
                                    >
                                        Видалити
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {section === 'auditoriums' && (
                <>
                    <h3>Нова аудиторія</h3>

                    <form
                        className="form"
                        onSubmit={(event) => {
                            event.preventDefault();

                            void perform(async () => {
                                await api('/auditoriums', token, {
                                    method: 'POST',
                                    body: JSON.stringify({ building, number }),
                                });

                                setBuilding('');
                                setNumber('');
                            }, 'Аудиторію створено');
                        }}
                    >
                        <input
                            className="field"
                            placeholder="Корпус"
                            value={building}
                            onChange={(event) =>
                                setBuilding(event.target.value)
                            }
                            required
                            maxLength={100}
                        />

                        <input
                            className="field"
                            placeholder="Номер аудиторії"
                            value={number}
                            onChange={(event) =>
                                setNumber(event.target.value)
                            }
                            required
                            maxLength={30}
                        />

                        <button
                            className="button button-primary full"
                            disabled={busy}
                            type="submit"
                        >
                            Додати аудиторію
                        </button>
                    </form>

                    <h3 style={{ marginTop: 28 }}>
                        Список аудиторій ({auditoriums.length})
                    </h3>

                    <div className="slot-list">
                        {auditoriums.map((item) => (
                            <div className="slot-card" key={item.id}>
                                <strong>
                                    {item.building} — {item.number}
                                </strong>
                                <p>№ {item.id}</p>

                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        className="button button-outline"
                                        disabled={busy}
                                        onClick={() => editAuditorium(item)}
                                    >
                                        Змінити
                                    </button>

                                    <button
                                        className="button button-danger"
                                        disabled={busy}
                                        onClick={() =>
                                            deleteItem(
                                                `/auditoriums/${item.id}`,
                                                'аудиторію',
                                            )
                                        }
                                    >
                                        Видалити
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {section === 'teachers' && (
                <>
                    <h3>Новий викладач</h3>

                    <form
                        className="form"
                        onSubmit={(event) => {
                            event.preventDefault();

                            void perform(async () => {
                                await api('/teachers', token, {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        fullName: teacherName,
                                        email: teacherEmail,
                                        password: teacherPassword,
                                        disciplineIds: selectedIds,
                                    }),
                                });

                                setTeacherName('');
                                setTeacherEmail('');
                                setTeacherPassword('');
                                setSelectedIds([]);
                            }, 'Викладача створено');
                        }}
                    >
                        <input
                            className="field"
                            placeholder="ПІБ викладача"
                            value={teacherName}
                            onChange={(event) =>
                                setTeacherName(event.target.value)
                            }
                            required
                        />

                        <input
                            className="field"
                            type="email"
                            placeholder="Електронна пошта"
                            value={teacherEmail}
                            onChange={(event) =>
                                setTeacherEmail(event.target.value)
                            }
                            required
                        />

                        <input
                            className="field"
                            type="password"
                            placeholder="Пароль (від 8 символів)"
                            value={teacherPassword}
                            onChange={(event) =>
                                setTeacherPassword(event.target.value)
                            }
                            minLength={8}
                            required
                        />

                        <strong>Дисципліни</strong>

                        {disciplines.map((item) => (
                            <label
                                key={item.id}
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    alignItems: 'center',
                                    fontSize: 13,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={(event) => {
                                        setSelectedIds((previous) =>
                                            event.target.checked
                                                ? [...previous, item.id]
                                                : previous.filter(
                                                    (id) => id !== item.id,
                                                ),
                                        );
                                    }}
                                />
                                {item.name}
                            </label>
                        ))}

                        <button
                            className="button button-primary full"
                            disabled={busy}
                            type="submit"
                        >
                            Додати викладача
                        </button>
                    </form>

                    <h3 style={{ marginTop: 28 }}>
                        Список викладачів ({teachers.length})
                    </h3>

                    <div className="slot-list">
                        {teachers.map((item) => (
                            <div className="slot-card" key={item.id}>
                                <strong>{item.user.fullName}</strong>
                                <p>№ {item.id}</p>

                                <p>
                                    Дисципліни:{' '}
                                    {item.disciplines
                                        .map((d) => d.discipline.name)
                                        .join(', ') || 'Не призначено'}
                                </p>

                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                }}>
                                    <button
                                        className="button button-outline"
                                        disabled={busy}
                                        onClick={() => editTeacher(item)}
                                    >
                                        Змінити
                                    </button>

                                    <button
                                        className="button button-danger"
                                        disabled={busy}
                                        onClick={() =>
                                            deleteItem(
                                                `/teachers/${item.id}`,
                                                item.user.fullName,
                                            )
                                        }
                                    >
                                        Видалити
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
