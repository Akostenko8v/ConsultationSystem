/**
 * ConsultationSystem coursework data seed (non-destructive, repeatable).
 * Usage (from api folder): node scripts/seed-course.mjs          - read-only counts
 *                          node scripts/seed-course.mjs --apply  - insert synthetic seed data
 * No destructive SQL, no existing passwords/accounts are changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';
import { hash } from 'bcryptjs';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const knownOptions = new Set(['--apply']);
if (process.argv.slice(2).some((flag) => !knownOptions.has(flag))) {
  console.error('Usage: node scripts/seed-course.mjs [--apply]');
  process.exit(2);
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(apiRoot, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('Missing api/.env with DATABASE_URL (not included in package).');
  }
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    .find((item) => /^\s*DATABASE_URL\s*=/.test(item));
  if (!line) throw new Error('DATABASE_URL not found in api/.env');
  let value = line.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim();
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!/^postgres(ql)?:\/\//.test(value)) throw new Error('Invalid DATABASE_URL format');
  return value;
}

function pad(num, length = 3) { return String(num).padStart(length, '0'); }
function assertCount(items, count, label) {
  if (items.length !== count) throw new Error(`Expected ${count} ${label}, got ${items.length}`);
}
function uniqueId(source) {
  const data = createHash('sha256').update(`ConsultationSystem-Course-Seed-2026-v1:${source}`).digest('hex');
  return `${data.slice(0, 8)}-${data.slice(8, 12)}-4${data.slice(13, 16)}-8${data.slice(17, 20)}-${data.slice(20, 32)}`;
}
async function counts(client) {
  const { rows } = await client.query(`
    SELECT
      (SELECT count(*)::integer FROM teachers) AS teachers,
      (SELECT count(*)::integer FROM disciplines) AS disciplines,
      (SELECT count(*)::integer FROM slots) AS slots,
      (SELECT count(*)::integer FROM users WHERE role = 'STUDENT') AS students,
      (SELECT count(*)::integer FROM bookings) AS bookings,
      (SELECT count(*)::integer FROM student_disciplines) AS student_discipline_links
  `);
  return rows[0];
}
function displayCounts(label, value) {
  console.log(`\n${label}`);
  for (const [key, threshold] of Object.entries({teachers:30, disciplines:20, slots:800, students:300, bookings:500})) {
    console.log(`  ${key.padEnd(12)} ${String(value[key]).padStart(5)} / ${threshold}`);
  }
  console.log(`  student-discipline links: ${value.student_discipline_links}`);
}

const urls = { teachers:[], students:[] };
for (let i=1; i<=30; i++) urls.teachers.push(`course.seed.teacher.${pad(i)}@example.invalid`);
for (let i=1; i<=300; i++) urls.students.push(`course.seed.student.${pad(i)}@example.invalid`);
const courses = Array.from({length:20}, (_,index) => ({code:`SEED${pad(index+1)}`, name:`Навчальна дисципліна ${pad(index+1)} (демо)`}));
const rooms = Array.from({length:20}, (_,index) => ({building:'Демонстраційний корпус', number:`D${pad(index+1)}`}));
const days = [
  '2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06',
  '2026-11-16','2026-11-17','2026-11-18',
];

async function insertMany(client, sql, input) {
  await client.query(sql, [JSON.stringify(input)]);
}
async function fetchSeedUsers(client, emails) {
  const { rows } = await client.query('SELECT id, email, role FROM users WHERE email = ANY($1::text[]) ORDER BY email', [emails]);
  return rows;
}
async function fetchSeedTeachers(client, emails) {
  const {rows} = await client.query(`
    SELECT t.id, u.email FROM teachers AS t JOIN users AS u ON t."userId" = u.id
    WHERE u.email = ANY($1::text[]) ORDER BY u.email
  `, [emails]);
  return rows;
}
async function seed(client) {
  const randomizedPassword = randomBytes(32).toString('base64url');
  const passwordHash = await hash(randomizedPassword, 10);
  await insertMany(client, `
    INSERT INTO users ("fullName", email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
    SELECT src."fullName", src.email, src."passwordHash", 'TEACHER'::"UserRole", true, now(), now()
    FROM jsonb_to_recordset($1::jsonb) AS src (email text, "fullName" text, "passwordHash" text)
    ON CONFLICT (email) DO NOTHING
  `,
  urls.teachers.map((email, index) => ({email, fullName:`Демо викладач ${pad(index+1)}`, passwordHash})));

  // Synthetic passwords are randomized and not printed; existing users remain untouched.
  await insertMany(client, `
    INSERT INTO users ("fullName", email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
    SELECT src."fullName", src.email, src."passwordHash", 'STUDENT'::"UserRole", true, now(), now()
    FROM jsonb_to_recordset($1::jsonb) AS src (email text, "fullName" text, "passwordHash" text)
    ON CONFLICT (email) DO NOTHING
  `, urls.students.map((email, index) => ({email, fullName:`Демо студент ${pad(index+1)}`, passwordHash})));

  // Ensure existing test users are never modified; only seed-namespaced profiles are created.
  const teacherUsers = await fetchSeedUsers(client, urls.teachers);
  assertCount(teacherUsers, 30, 'seed teacher users');
  if (teacherUsers.some((u) => u.role !== 'TEACHER')) throw new Error('Seed teacher email belongs to a different role');
  await client.query(`
    INSERT INTO teachers ("userId")
    SELECT id FROM users WHERE email = ANY($1::text[]) ON CONFLICT ("userId") DO NOTHING
  `, [urls.teachers]);
  const teachers = await fetchSeedTeachers(client, urls.teachers);
  assertCount(teachers, 30, 'seed teachers');

  const students = await fetchSeedUsers(client, urls.students);
  assertCount(students, 300, 'seed students');
  if (students.some((u) => u.role !== 'STUDENT')) throw new Error('Seed student email belongs to a different role');

  await insertMany(client, `
    INSERT INTO disciplines (code, name)
    SELECT code, name FROM jsonb_to_recordset($1::jsonb) AS d(code text, name text)
    ON CONFLICT (code) DO NOTHING
  `, courses);
  const courseCodes = courses.map((d) => d.code);
  const {rows: disciplines} = await client.query('SELECT id, code FROM disciplines WHERE code = ANY($1::text[]) ORDER BY code', [courseCodes]);
  assertCount(disciplines, 20, 'seed disciplines');

  await insertMany(client, `
    INSERT INTO auditoriums (building, number)
    SELECT building, number FROM jsonb_to_recordset($1::jsonb) AS a(building text, number text)
    ON CONFLICT (building, number) DO NOTHING
  `, rooms);
  const {rows: auditoriums} = await client.query(`
    SELECT id, number FROM auditoriums WHERE building = 'Демонстраційний корпус'
    AND number = ANY($1::text[]) ORDER BY number
  `,[rooms.map((room) => room.number)]);
  assertCount(auditoriums, 20, 'seed auditoriums');

  // Keep each demonstration teacher connected to at least two disciplines.
  const teacherLinks = teachers.flatMap((teacher, index) => [
    {teacherId:teacher.id, disciplineId:disciplines[index%20].id},
    {teacherId:teacher.id, disciplineId:disciplines[(index+7)%20].id},
  ]);
  await insertMany(client, `
    INSERT INTO teacher_disciplines ("teacherId", "disciplineId")
    SELECT "teacherId", "disciplineId"
    FROM jsonb_to_recordset($1::jsonb) AS l("teacherId" integer, "disciplineId" integer)
    ON CONFLICT DO NOTHING
  `, teacherLinks);

  const slotData = [];
  for (let i=0;i<800;i++) {
    const day = Math.floor(i/100);
    const hourOffset = Math.floor((i%100)/20);
    const room = i%20;
    const teacher = (hourOffset*20+room+day*3)%30;
    const startsAt = `${days[day]}T${pad(9+hourOffset,2)}:00:00+02:00`;
    const endsAt = `${days[day]}T${pad(9+hourOffset,2)}:45:00+02:00`;
    slotData.push({
      teacherId:teachers[teacher].id,
      disciplineId:disciplines[teacher%20].id,
      auditoriumId:auditoriums[room].id,
      startsAt, endsAt,
    });
  }
  assertCount(slotData, 800, 'generated slots');
  // In each 45-minute period, all 20 rooms and 20 teachers are distinct.
  await insertMany(client, `
    INSERT INTO slots ("teacherId", "disciplineId", "auditoriumId", "startsAt", "endsAt", "isBlocked", "createdAt")
    SELECT s."teacherId", s."disciplineId", s."auditoriumId", s."startsAt", s."endsAt", false, now()
    FROM jsonb_to_recordset($1::jsonb) AS s (
      "teacherId" integer, "disciplineId" integer, "auditoriumId" integer,
      "startsAt" timestamptz, "endsAt" timestamptz
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM slots AS other WHERE
      other."teacherId" = s."teacherId" AND
      other."disciplineId" = s."disciplineId" AND
      other."auditoriumId" = s."auditoriumId" AND
      other."startsAt" = s."startsAt" AND other."endsAt" = s."endsAt"
    )
  `, slotData);

  const {rows: seedSlots} = await client.query(`
    SELECT id, "teacherId", "disciplineId", "startsAt"
    FROM slots WHERE "teacherId" = ANY($1::integer[])
      AND "auditoriumId" = ANY($2::integer[])
      AND "startsAt" >= '2026-11-02T00:00:00+02:00'::timestamptz
      AND "startsAt" < '2026-11-19T00:00:00+02:00'::timestamptz
  `,[teachers.map((row) => row.id), auditoriums.map((row) => row.id)]);
  const slotByKey = new Map(seedSlots.map((slot) => [`${slot.teacherId}|${new Date(slot.startsAt).toISOString()}`, slot]));
  const bookings=[];
  const studentLinks = students.flatMap((student,index)=>[
    {studentId:student.id, disciplineId:disciplines[index%20].id},
    {studentId:student.id, disciplineId:disciplines[(index+7)%20].id},
  ]);
  for (let i=0;i<500;i++) {
    const item=slotData[i];
    const slot=slotByKey.get(`${item.teacherId}|${new Date(item.startsAt).toISOString()}`);
    if (!slot || slot.disciplineId !== item.disciplineId) throw new Error(`Seed slot not found for index ${i}`);
    const student=students[i%students.length];
    studentLinks.push({studentId:student.id, disciplineId:item.disciplineId});
    bookings.push({
      slotId:slot.id,
      studentId:student.id,
      topic:`Навчальне питання №${pad(i+1)} (демо)`,
      status:i%5===0?'NO_SHOW':'COMPLETED',
      teacherComment:i%5===0?'Студент не з’явився (демо)':'Консультацію проведено (демо)',
      idempotencyKey:uniqueId(`booking-${i+1}`),
    });
  }
  await insertMany(client, `
    INSERT INTO student_disciplines ("studentId", "disciplineId")
    SELECT DISTINCT "studentId", "disciplineId"
    FROM jsonb_to_recordset($1::jsonb) AS l("studentId" integer, "disciplineId" integer)
    ON CONFLICT DO NOTHING
  `, studentLinks);
  await insertMany(client, `
    INSERT INTO bookings ("slotId", "studentId", topic, status, "teacherComment", "idempotencyKey", "createdAt", "updatedAt")
    SELECT b."slotId", b."studentId", b.topic, b.status::"BookingStatus", b."teacherComment", b."idempotencyKey"::uuid, now(), now()
    FROM jsonb_to_recordset($1::jsonb) AS b (
      "slotId" integer, "studentId" integer, topic text, status text,
      "teacherComment" text, "idempotencyKey" text
    )
    ON CONFLICT ("idempotencyKey") DO NOTHING
  `, bookings);
  return {teacherUsers:teachers.length, studentUsers:students.length, courses:disciplines.length, rooms:auditoriums.length, slots:slotData.length, bookings:bookings.length};
}

let pool;
let client;
try {
  pool = new pg.Pool({connectionString:loadDatabaseUrl(), max:1, connectionTimeoutMillis:30000});
  client = await pool.connect();
  const before=await counts(client);
  displayCounts('Current database:',before);
  if (!apply) {
    console.log('\nREAD-ONLY CHECK: no data changed.');
    console.log('To insert synthetic coursework records, run: node scripts/seed-course.mjs --apply');
  } else {
    console.log('\nApplying course demonstration dataset (30/20/800/300/500).');
    console.log('Existing real records will not be deleted or overwritten.');
    await client.query('BEGIN');
    try {
      await client.query('SELECT pg_advisory_xact_lock(43812, 2026)');
      const inserted=await seed(client);
      const after=await counts(client);
      for (const [key,min] of Object.entries({teachers:30,disciplines:20,slots:800,students:300,bookings:500})) {
        if (after[key]<min) throw new Error(`Minimum requirement missing: ${key}`);
      }
      await client.query('COMMIT');
      displayCounts('Database after seed:',after);
      console.log(`\nSEED SUCCESS. Synthetic dataset: ${JSON.stringify(inserted)}`);
      console.log('Run again without --apply to inspect counts. Repeating --apply is idempotent.');
      console.log('To view 2026 demonstration report as ADMIN, select 2026-11-01 through 2026-11-30.');
    } catch(error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} catch (error) {
  console.error('SEED ERROR:', error instanceof Error?error.message:String(error));
  process.exitCode=1;
} finally {
  if (client) client.release();
  if (pool) await pool.end();
}
