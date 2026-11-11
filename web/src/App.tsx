
import AdminPanel from './AdminPanel';
import { useEffect, useState } from 'react';
import TeacherPanel from './TeacherPanel';

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

type Session = {
    access_token: string;
    user: {
        id: number;
        fullName: string;
        email: string;
        role: Role;
    };
};

type Slot = {
    id: number;
    startsAt: string;
    endsAt: string;
    discipline: { name: string };
    teacher: { user: { fullName: string } };
    auditorium: { building: string; number: string };
};

type Booking = {
    id: number;
    topic: string;
    status: string;
    slot: {
        startsAt: string;
        discipline: { name: string };
        teacher: { user: { fullName: string } };
    };
};

const API =
    import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api';

async function request<T>(
    path: string,
    options: RequestInit = {},
    token?: string,
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

function formatDate(value: string) {
    return new Intl.DateTimeFormat('uk-UA', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function errorText(error: unknown) {
    return error instanceof Error
        ? error.message
        : 'Невідома помилка';
}

const roleNames: Record<Role, string> = {
    STUDENT: 'Студент',
    TEACHER: 'Викладач',
    ADMIN: 'Адміністратор',
};


const SESSION_KEY = 'consultation-session';

function readSavedSession(): Session | null {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;

        const saved = JSON.parse(raw) as Session;

        if (
            !saved ||
            typeof saved.access_token !== 'string' ||
            !saved.user ||
            typeof saved.user.id !== 'number' ||
            typeof saved.user.fullName !== 'string' ||
            typeof saved.user.email !== 'string' ||
            !['STUDENT', 'TEACHER', 'ADMIN'].includes(saved.user.role)
        ) {
            return null;
        }

        return saved;
    } catch {
        return null;
    }
}


export default function App() {
    const [session, setSession] = useState<Session | null>(readSavedSession);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [fullName, setFullName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [slots, setSlots] = useState<Slot[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [topics, setTopics] = useState<Record<number, string>>({});
    const [search, setSearch] = useState('');
    const [notice, setNotice] = useState('');
    const [working, setWorking] = useState(false);

    async function loadSlots() {
        const result = await request<Slot[]>('/slots');
        setSlots(result);
    }

    async function loadBookings(token: string) {
        const result = await request<Booking[]>(
            '/bookings/mine',
            {},
            token,
        );
        setBookings(result);
    }


    useEffect(() => {
        let active = true;

        request<Slot[]>('/slots')
            .then((result) => {
                if (active) setSlots(result);
            })
            .catch((error: unknown) => {
                if (active) {
                    setNotice(`Помилка завантаження: ${errorText(error)}`);
                }
            });

        return () => {
            active = false;
        };
    }, []);



    useEffect(() => {
        if (session?.user.role !== 'STUDENT') {
            return;
        }

        let active = true;

        request<Booking[]>(
            '/bookings/mine',
            {},
            session.access_token,
        )
            .then((result) => {
                if (active) setBookings(result);
            })
            .catch((error: unknown) => {
                if (active) setNotice(errorText(error));
            });

        return () => {
            active = false;
        };
    }, [session]);


    useEffect(() => {
        if (!session) return;

        let active = true;

        fetch(`${API}/auth/me`, {
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
        })
            .then(async (response) => {
                if (!active) return;

                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem(SESSION_KEY);
                    setSession(null);
                    setBookings([]);
                    setNotice('Сесію завершено. Увійдіть повторно.');
                    return;
                }

                if (!response.ok) {
                    setNotice('Не вдалося перевірити сесію. Спробуйте оновити сторінку.');
                    return;
                }

                const profile = await response.json() as {
                    id: number;
                    role: Role;
                };

                if (!active) return;

                if (
                    profile.id !== session.user.id ||
                    profile.role !== session.user.role
                ) {
                    localStorage.removeItem(SESSION_KEY);
                    setSession(null);
                    setBookings([]);
                    setNotice('Дані авторизації змінилися. Увійдіть повторно.');
                }
            })
            .catch(() => {
                if (active) {
                    setNotice('Не вдалося перевірити з’єднання із сервером.');
                }
            });

        return () => {
            active = false;
        };
    }, [session]);



    async function login(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setWorking(true);
        setNotice('');

        const registering = authMode === 'register';

        try {
            if (registering) {
                if (password !== confirmPassword) {
                    throw new Error('Паролі не збігаються');
                }

                if (fullName.trim().length < 2) {
                    throw new Error('Вкажіть повне ім’я');
                }

                await request('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({
                        fullName: fullName.trim(),
                        email: email.trim(),
                        password,
                    }),
                });
            }

            const result = await request<Session>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: email.trim(),
                    password,
                }),
            });

            localStorage.setItem(SESSION_KEY, JSON.stringify(result));
            setSession(result);

            setPassword('');
            setConfirmPassword('');
            setFullName('');
            setAuthMode('login');

            setNotice(
                registering
                    ? 'Реєстрація успішна! Ви увійшли до системи.'
                    : 'Вхід виконано успішно',
            );
        } catch (error) {
            setNotice(
                `${registering ? 'Помилка реєстрації' : 'Помилка входу'}: ${errorText(error)}`,
            );
        } finally {
            setWorking(false);
        }
    }


    async function book(slotId: number) {
        if (!session) return;

        setWorking(true);
        setNotice('');

        try {
            await request(
                '/bookings',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        slotId,
                        topic: topics[slotId]?.trim(),
                        idempotencyKey: crypto.randomUUID(),
                    }),
                },
                session.access_token,
            );

            await Promise.all([
                loadSlots(),
                loadBookings(session.access_token),
            ]);

            setNotice('Ви успішно записалися на консультацію!');
        } catch (error) {
            setNotice(`Помилка запису: ${errorText(error)}`);
        } finally {
            setWorking(false);
        }
    }

    async function cancelBooking(id: number) {
        if (!session) return;

        setWorking(true);
        setNotice('');

        try {
            await request(
                `/bookings/${id}/cancel`,
                { method: 'PATCH' },
                session.access_token,
            );

            await Promise.all([
                loadSlots(),
                loadBookings(session.access_token),
            ]);

            setNotice('Запис скасовано. Час знову доступний.');
        } catch (error) {
            setNotice(`Помилка скасування: ${errorText(error)}`);
        } finally {
            setWorking(false);
        }
    }

    const filteredSlots = slots.filter((slot) => {
        const text =
            `${slot.discipline.name} ${slot.teacher.user.fullName}`
                .toLowerCase();

        return text.includes(search.toLowerCase());
    });

    return (
        <div className="app">
            <header className="topbar">
                <div className="brand">
                    <span className="brand-icon">C</span>
                    <span>ConsultationSystem</span>
                </div>

                <div className="top-actions">
                    {session ? (
                        <>
                            <span className="user-tag">
                                {session.user.fullName} ·{' '}
                                {roleNames[session.user.role]}
                            </span>
                            <button
                                className="button button-outline"
                                onClick={() => {
                                    localStorage.removeItem(SESSION_KEY);
                                    setSession(null);
                                    setBookings([]);
                                    setNotice('');
                                }}
                            >
                                Вийти
                            </button>
                        </>
                    ) : (
                        <span className="user-tag">Навчальний портал</span>
                    )}
                </div>
            </header>

            <main className="container">
                <section className="hero">
                    <div>
                        <span className="eyebrow">ОНЛАЙН-ЗАПИС</span>
                        <h1>Консультації викладачів</h1>
                        <p>
                            Знаходьте вільний час, записуйтеся на консультації
                            та керуйте своїми записами в одному місці.
                        </p>
                    </div>
                    <div className="hero-stat">
                        <strong>{slots.length}</strong>
                        <span>вільних консультацій</span>
                    </div>
                </section>

                {notice && (
                    <div className="notice" role="status">
                        {notice}
                        <button
                            onClick={() => setNotice('')}
                            aria-label="Закрити повідомлення"
                        >
                            ×
                        </button>
                    </div>
                )}

                <div className="layout">
                    <section className="panel">
                        <div className="panel-heading">
                            <div>
                                <span className="eyebrow">РОЗКЛАД</span>
                                <h2>Доступні консультації</h2>
                            </div>
                            <button
                                className="button button-outline"
                                onClick={() =>
                                    loadSlots().catch((error) =>
                                        setNotice(errorText(error)),
                                    )
                                }
                            >
                                Оновити
                            </button>
                        </div>

                        <input
                            className="field search"
                            placeholder="Пошук за дисципліною або викладачем"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />

                        <div className="slot-list">
                            {filteredSlots.length === 0 && (
                                <div className="empty">
                                    Вільних консультацій поки немає.
                                </div>
                            )}

                            {filteredSlots.map((slot) => (
                                <article className="slot-card" key={slot.id}>
                                    <div className="slot-top">
                                        <span className="chip">Вільний час</span>
                                        <span className="slot-id">№ {slot.id}</span>
                                    </div>

                                    <h3>{slot.discipline.name}</h3>
                                    <p>Викладач: {slot.teacher.user.fullName}</p>

                                    <div className="slot-details">
                                        <span>📅 {formatDate(slot.startsAt)}</span>
                                        <span>
                                            📍 {slot.auditorium.building},{' '}
                                            ауд. {slot.auditorium.number}
                                        </span>
                                    </div>

                                    {session?.user.role === 'STUDENT' && (
                                        <div className="booking-form">
                                            <input
                                                className="field"
                                                placeholder="Тема консультації"
                                                value={topics[slot.id] ?? ''}
                                                onChange={(event) =>
                                                    setTopics((previous) => ({
                                                        ...previous,
                                                        [slot.id]: event.target.value,
                                                    }))
                                                }
                                            />
                                            <button
                                                className="button button-primary"
                                                disabled={
                                                    working ||
                                                    !topics[slot.id]?.trim()
                                                }
                                                onClick={() => book(slot.id)}
                                            >
                                                Записатися
                                            </button>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    </section>

                    <aside className="sidebar">
                        {!session ? (

                            <section className="panel">
                                <span className="eyebrow">ОСОБИСТИЙ КАБІНЕТ</span>

                                <h2>
                                    {authMode === 'register'
                                        ? 'Реєстрація студента'
                                        : 'Вхід до системи'}
                                </h2>

                                <p className="muted">
                                    {authMode === 'register'
                                        ? 'Створіть акаунт для запису на консультації.'
                                        : 'Увійдіть, щоб записатися на консультацію.'}
                                </p>

                                <form className="form" onSubmit={login}>
                                    {authMode === 'register' && (
                                        <label>
                                            Повне ім’я
                                            <input
                                                className="field"
                                                type="text"
                                                value={fullName}
                                                onChange={(event) => setFullName(event.target.value)}
                                                minLength={2}
                                                maxLength={150}
                                                autoComplete="name"
                                                required
                                            />
                                        </label>
                                    )}

                                    <label>
                                        Електронна пошта
                                        <input
                                            className="field"
                                            type="email"
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            autoComplete="email"
                                            required
                                        />
                                    </label>

                                    <label>
                                        Пароль
                                        <input
                                            className="field"
                                            type="password"
                                            value={password}
                                            onChange={(event) => setPassword(event.target.value)}
                                            minLength={authMode === 'register' ? 8 : undefined}
                                            maxLength={72}
                                            autoComplete={
                                                authMode === 'register'
                                                    ? 'new-password'
                                                    : 'current-password'
                                            }
                                            required
                                        />
                                    </label>

                                    {authMode === 'register' && (
                                        <label>
                                            Підтвердження пароля
                                            <input
                                                className="field"
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(event) => setConfirmPassword(event.target.value)}
                                                minLength={8}
                                                maxLength={72}
                                                autoComplete="new-password"
                                                required
                                            />
                                        </label>
                                    )}

                                    <button
                                        className="button button-primary full"
                                        type="submit"
                                        disabled={working}
                                    >
                                        {working
                                            ? 'Зачекайте...'
                                            : authMode === 'register'
                                                ? 'Зареєструватися'
                                                : 'Увійти'}
                                    </button>

                                    <button
                                        className="button button-outline full"
                                        type="button"
                                        disabled={working}
                                        onClick={() => {
                                            setAuthMode((previous) =>
                                                previous === 'login' ? 'register' : 'login',
                                            );
                                            setPassword('');
                                            setConfirmPassword('');
                                            setNotice('');
                                        }}
                                    >
                                        {authMode === 'register'
                                            ? 'Вже є акаунт? Увійти'
                                            : 'Немає акаунта? Зареєструватися'}
                                    </button>
                                </form>
                            </section>

                        ) : (
                            <section className="panel">
                                <span className="eyebrow">МІЙ ПРОФІЛЬ</span>
                                <h2>{session.user.fullName}</h2>
                                <p className="muted">{session.user.email}</p>
                                <span className="chip">
                                    {roleNames[session.user.role]}
                                </span>
                            </section>
                        )}

                        {session?.user.role === 'STUDENT' && (
                            <section className="panel">
                                <span className="eyebrow">ІСТОРІЯ</span>
                                <h2>Мої записи</h2>

                                {bookings.length === 0 ? (
                                    <p className="muted">
                                        Ви ще не записувалися на консультації.
                                    </p>
                                ) : (
                                    <div className="my-bookings">
                                        {bookings.map((booking) => (
                                            <div className="my-booking" key={booking.id}>
                                                <strong>
                                                    {booking.slot.discipline.name}
                                                </strong>

                                                <span className="muted">
                                                    {formatDate(booking.slot.startsAt)}
                                                </span>

                                                <span
                                                    className={
                                                        booking.status === 'BOOKED'
                                                            ? 'chip'
                                                            : 'chip chip-muted'
                                                    }
                                                >
                                                    {booking.status === 'BOOKED'
                                                        ? 'Записано'
                                                        : booking.status === 'CANCELLED'
                                                            ? 'Скасовано'
                                                            : booking.status}
                                                </span>

                                                {booking.status === 'BOOKED' &&
                                                    new Date(booking.slot.startsAt) >
                                                    new Date() && (
                                                        <button
                                                            className="button button-danger"
                                                            disabled={working}
                                                            onClick={() =>
                                                                cancelBooking(booking.id)
                                                            }
                                                        >
                                                            Скасувати запис
                                                        </button>
                                                    )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}


                        {session?.user.role === 'TEACHER' && (
                            <TeacherPanel
                                token={session.access_token}
                                userId={session.user.id}
                            />
                        )}

                        {session?.user.role === 'ADMIN' && (
                            <AdminPanel token={session.access_token} />
                        )}

                    </aside>
                </div>
            </main>
        </div>
    );
}
