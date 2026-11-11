
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateSlotDto } from './dto/create-slot.dto.js';
import type { UpdateSlotDto } from './dto/update-slot.dto.js';

const slotSelect = {
    id: true,
    teacherId: true,
    disciplineId: true,
    auditoriumId: true,
    startsAt: true,
    endsAt: true,
    isBlocked: true,
    teacher: {
        select: {
            id: true,
            user: {
                select: { fullName: true },
            },
        },
    },
    discipline: {
        select: {
            id: true,
            code: true,
            name: true,
        },
    },
    auditorium: {
        select: {
            id: true,
            building: true,
            number: true,
        },
    },
} as const;

@Injectable()
export class SlotsService {
    constructor(private readonly prisma: PrismaService) { }

    // Свободные будущие консультации
    findAll() {
        return this.prisma.slot.findMany({
            where: {
                startsAt: { gt: new Date() },
                isBlocked: false,
                bookings: {
                    none: {
                        status: { not: 'CANCELLED' },
                    },
                },
            },
            select: slotSelect,
            orderBy: { startsAt: 'asc' },
            take: 1000,
        });
    }

    // Все слоты текущего преподавателя
    findMine(userId: number) {
        return this.prisma.slot.findMany({
            where: {
                teacher: { userId },
            },
            select: slotSelect,
            orderBy: { startsAt: 'asc' },
        });
    }

    // Один доступный слот
    async findOne(id: number) {
        const slot = await this.prisma.slot.findFirst({
            where: {
                id,
                startsAt: { gt: new Date() },
                isBlocked: false,
                bookings: {
                    none: {
                        status: { not: 'CANCELLED' },
                    },
                },
            },
            select: slotSelect,
        });

        if (!slot) {
            throw new NotFoundException('Available slot not found');
        }

        return slot;
    }

    // Преподаватель публикует время
    async create(userId: number, dto: CreateSlotDto) {
        const startsAt = new Date(dto.startsAt);
        const endsAt = new Date(dto.endsAt);

        const timezonePattern = /(Z|[+-]\d{2}:\d{2})$/i;

        if (
            !timezonePattern.test(dto.startsAt) ||
            !timezonePattern.test(dto.endsAt) ||
            !Number.isFinite(startsAt.getTime()) ||
            !Number.isFinite(endsAt.getTime())
        ) {
            throw new BadRequestException(
                'Dates must include a timezone',
            );
        }

        if (startsAt <= new Date()) {
            throw new BadRequestException(
                'Slot must start in the future',
            );
        }

        if (endsAt <= startsAt) {
            throw new BadRequestException(
                'End time must be after start time',
            );
        }

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

        if (!teacher) {
            throw new ForbiddenException(
                'Teacher profile not found',
            );
        }

        if (teacher.disciplines.length === 0) {
            throw new ForbiddenException(
                'Discipline is not assigned to this teacher',
            );
        }

        const auditorium = await this.prisma.auditorium.findUnique({
            where: { id: dto.auditoriumId },
            select: { id: true },
        });

        if (!auditorium) {
            throw new NotFoundException('Auditorium not found');
        }

        // Проверяем пересечение времени
        const overlapping = await this.prisma.slot.findFirst({
            where: {
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
                OR: [
                    { teacherId: teacher.id },
                    { auditoriumId: dto.auditoriumId },
                ],
            },
            select: { id: true },
        });

        if (overlapping) {
            throw new ConflictException(
                'Teacher or auditorium is busy at this time',
            );
        }

        return this.prisma.slot.create({
            data: {
                teacherId: teacher.id,
                disciplineId: dto.disciplineId,
                auditoriumId: dto.auditoriumId,
                startsAt,
                endsAt,
            },
            select: slotSelect,
        });
    }

    // Преподаватель блокирует или разблокирует слот
    async update(
        id: number,
        userId: number,
        dto: UpdateSlotDto,
    ) {
        await this.assertOwner(id, userId);

        if (dto.isBlocked) {
            const activeBookings = await this.prisma.booking.count({
                where: {
                    slotId: id,
                    status: { not: 'CANCELLED' },
                },
            });

            if (activeBookings > 0) {
                throw new ConflictException(
                    'Cannot block a slot with an active booking',
                );
            }
        }

        return this.prisma.slot.update({
            where: { id },
            data: { isBlocked: dto.isBlocked },
            select: slotSelect,
        });
    }

    // Удаление слота без истории бронирований
    async remove(id: number, userId: number) {
        await this.assertOwner(id, userId);

        const bookingCount = await this.prisma.booking.count({
            where: { slotId: id },
        });

        if (bookingCount > 0) {
            throw new ConflictException(
                'Slot has booking history and cannot be deleted',
            );
        }

        try {
            await this.prisma.slot.delete({
                where: { id },
            });

            return { id, deleted: true };
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError
            ) {
                if (error.code === 'P2025') {
                    throw new NotFoundException('Slot not found');
                }

                if (error.code === 'P2003') {
                    throw new ConflictException(
                        'Slot has related records',
                    );
                }
            }

            throw error;
        }
    }

    // Проверка владельца слота
    private async assertOwner(id: number, userId: number) {
        const slot = await this.prisma.slot.findUnique({
            where: { id },
            select: {
                teacher: {
                    select: { userId: true },
                },
            },
        });

        if (!slot) {
            throw new NotFoundException('Slot not found');
        }

        if (slot.teacher.userId !== userId) {
            throw new ForbiddenException(
                'You do not own this slot',
            );
        }
    }
}
