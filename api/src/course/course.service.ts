import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { FinishConsultationDto } from './dto/finish-consultation.dto.js';
import type { WeeklySlotsDto } from './dto/weekly-slots.dto.js';

const teacherBookingSelect = {
  id: true,
  topic: true,
  status: true,
  teacherComment: true,
  createdAt: true,
  student: { select: { id: true, fullName: true, email: true } },
  slot: {
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      discipline: { select: { name: true } },
      auditorium: { select: { building: true, number: true } },
    },
  },
} as const;

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  teacherBookings(userId: number) {
    return this.prisma.booking.findMany({
      where: { slot: { teacher: { userId } } },
      select: teacherBookingSelect,
      orderBy: { slot: { startsAt: 'desc' } },
      take: 2000,
    });
  }

  async finish(userId: number, id: number, dto: FinishConsultationDto) {
    return this.prisma.$transaction(async (tx) => {
      // Same locking order as booking/cancellation, avoiding races.
      const found = await tx.booking.findFirst({
        where: { id, slot: { teacher: { userId } } },
        select: { slotId: true },
      });
      if (!found) throw new NotFoundException('Consultation not found');

      await tx.$queryRaw`
        SELECT "id" FROM "slots" WHERE "id" = ${found.slotId} FOR UPDATE
      `;
      const current = await tx.booking.findFirst({
        where: { id, slot: { teacher: { userId } } },
        select: { status: true, slot: { select: { endsAt: true } } },
      });
      if (!current) throw new NotFoundException('Consultation not found');
      if (current.status !== 'BOOKED') {
        throw new ConflictException('Only booked consultations can be finished');
      }
      if (current.slot.endsAt > new Date()) {
        throw new ConflictException('Consultation has not ended yet');
      }
      return tx.booking.update({
        where: { id },
        data: {
          status: dto.status,
          teacherComment: dto.teacherComment?.trim() || null,
        },
        select: teacherBookingSelect,
      });
    });
  }

  async weekly(userId: number, dto: WeeklySlotsDto) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      select: {
        id: true,
        disciplines: {
          where: { disciplineId: dto.disciplineId },
          select: { disciplineId: true },
        },
      },
    });
    if (!teacher || teacher.disciplines.length === 0) {
      throw new ForbiddenException('Discipline is not assigned to this teacher');
    }
    const room = await this.prisma.auditorium.findUnique({
      where: { id: dto.auditoriumId }, select: { id: true },
    });
    if (!room) throw new NotFoundException('Auditorium not found');

    const periods = dto.slots.map((item) => {
      const hasZone = /(Z|[+-]\d{2}:\d{2})$/i;
      if (!hasZone.test(item.startsAt) || !hasZone.test(item.endsAt)) {
        throw new BadRequestException('Timezone required for each slot');
      }
      return { startsAt: new Date(item.startsAt), endsAt: new Date(item.endsAt) };
    });
    periods.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const now = new Date();
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (
        !Number.isFinite(p.startsAt.getTime()) ||
        !Number.isFinite(p.endsAt.getTime()) ||
        p.startsAt <= now ||
        p.endsAt <= p.startsAt ||
        p.endsAt.getTime() - p.startsAt.getTime() > 8 * 3600_000
      ) {
        throw new BadRequestException('Invalid slot dates or duration');
      }
      if (i > 0 && periods[i - 1].endsAt > p.startsAt) {
        throw new BadRequestException('Slots in the series overlap');
      }
    }
    if (
      periods.at(-1)!.startsAt.getTime() - periods[0].startsAt.getTime() >=
      7 * 24 * 3600_000
    ) {
      throw new BadRequestException('Series must fit within seven days');
    }

    // All or nothing: if a single date conflicts, the entire series rolls back.
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize bulk requests per room and per teacher in this transaction.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(11::integer, ${teacher.id}::integer)::text AS acquired`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(12::integer, ${dto.auditoriumId}::integer)::text AS acquired`;
        const created = [];
        for (const period of periods) {
          const overlap = await tx.slot.findFirst({
            where: {
              startsAt: { lt: period.endsAt },
              endsAt: { gt: period.startsAt },
              OR: [
                { teacherId: teacher.id },
                { auditoriumId: dto.auditoriumId },
              ],
            },
            select: { id: true },
          });
          if (overlap) {
            throw new ConflictException('Teacher or auditorium is busy for part of this series');
          }
          const slot = await tx.slot.create({
            data: {
              teacherId: teacher.id,
              disciplineId: dto.disciplineId,
              auditoriumId: dto.auditoriumId,
              startsAt: period.startsAt,
              endsAt: period.endsAt,
            },
            select: { id: true, startsAt: true, endsAt: true },
          });
          created.push(slot);
        }
        return { count: created.length, slots: created };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 15000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Concurrent slot creation: please retry');
      }
      throw error;
    }
  }

  async report(from: string, to: string) {
    if (!from || !to) throw new BadRequestException('from and to dates are required');
    const start = new Date(from);
    const end = new Date(to);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start >= end ||
      end.getTime() - start.getTime() > 366 * 86400_000
    ) {
      throw new BadRequestException('Invalid report date range');
    }
    const rows = await this.prisma.booking.findMany({
      where: {
        status: { in: ['COMPLETED', 'NO_SHOW'] },
        slot: { startsAt: { gte: start, lt: end } },
      },
      select: {
        id: true,
        status: true,
        topic: true,
        teacherComment: true,
        student: { select: { fullName: true, email: true } },
        slot: {
          select: {
            startsAt: true, endsAt: true,
            teacher: { select: { user: { select: { fullName: true } } } },
            discipline: { select: { name: true } },
          },
        },
      },
      orderBy: { slot: { startsAt: 'desc' } },
      take: 2000,
    });
    return {
      from: start, to: end,
      completed: rows.filter((row) => row.status === 'COMPLETED').length,
      noShow: rows.filter((row) => row.status === 'NO_SHOW').length,
      rows,
    };
  }

  async studentDisciplines(studentId: number) {
    const [disciplines, links] = await Promise.all([
      this.prisma.discipline.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.studentDiscipline.findMany({
        where: { studentId }, select: { disciplineId: true },
      }),
    ]);
    const enrolled = new Set(links.map((link) => link.disciplineId));
    return disciplines.map((discipline) => ({
      ...discipline, enrolled: enrolled.has(discipline.id),
    }));
  }
  async enrollDiscipline(studentId: number, disciplineId: number) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id: disciplineId }, select: { id: true },
    });
    if (!discipline) throw new NotFoundException('Discipline not found');
    await this.prisma.studentDiscipline.upsert({
      where: { studentId_disciplineId: { studentId, disciplineId } },
      update: {},
      create: { studentId, disciplineId },
    });
    return { disciplineId, enrolled: true };
  }
  async removeDiscipline(studentId: number, disciplineId: number) {
    await this.prisma.studentDiscipline.deleteMany({
      where: { studentId, disciplineId },
    });
    return { disciplineId, enrolled: false };
  }

  async stats() {
    const [teachers, disciplines, slots, students, bookings, studentDisciplineLinks] =
      await Promise.all([
        this.prisma.teacher.count(),
        this.prisma.discipline.count(),
        this.prisma.slot.count(),
        this.prisma.user.count({ where: { role: 'STUDENT' } }),
        this.prisma.booking.count(),
        this.prisma.studentDiscipline.count(),
      ]);
    return { teachers, disciplines, slots, students, bookings, studentDisciplineLinks };
  }
}
