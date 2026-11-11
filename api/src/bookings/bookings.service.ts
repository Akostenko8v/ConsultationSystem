
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';

const bookingSelect = {
    id: true,
    slotId: true,
    studentId: true,
    topic: true,
    status: true,
    cancelledAt: true,
    createdAt: true,
    slot: {
        select: {
            id: true,
            startsAt: true,
            endsAt: true,
            discipline: {
                select: {
                    id: true,
                    name: true,
                },
            },
            auditorium: {
                select: {
                    building: true,
                    number: true,
                },
            },
            teacher: {
                select: {
                    user: {
                        select: {
                            fullName: true,
                        },
                    },
                },
            },
        },
    },
} as const;

@Injectable()
export class BookingsService {
    constructor(private readonly prisma: PrismaService) { }

    // Записи авторизованного студента
    findMine(studentId: number) {
        return this.prisma.booking.findMany({
            where: { studentId },
            select: bookingSelect,
            orderBy: { createdAt: 'desc' },
        });
    }

    // Создание записи
    async create(studentId: number, dto: CreateBookingDto) {
        const topic = dto.topic.trim();

        if (!topic) {
            throw new BadRequestException('Topic cannot be empty');
        }

        try {
            return await this.prisma.$transaction(
                async (tx) => {
                    // Блокируем строку слота на время транзакции.
                    // Конкурирующие запросы будут обработаны по очереди.
                    const rows = await tx.$queryRaw<{ id: number }[]>`
            SELECT "id"
            FROM "slots"
            WHERE "id" = ${dto.slotId}
            FOR UPDATE
          `;

                    if (rows.length === 0) {
                        throw new NotFoundException('Slot not found');
                    }

                    // Проверяем, не является ли запрос повтором.
                    const previous = await tx.booking.findUnique({
                        where: {
                            idempotencyKey: dto.idempotencyKey,
                        },
                        select: bookingSelect,
                    });

                    if (previous) {
                        if (
                            previous.studentId === studentId &&
                            previous.slotId === dto.slotId &&
                            previous.topic === topic
                        ) {
                            return previous;
                        }

                        throw new ConflictException(
                            'Idempotency key already used',
                        );
                    }

                    const slot = await tx.slot.findUnique({
                        where: { id: dto.slotId },
                        select: {
                            startsAt: true,
                            isBlocked: true,
                        },
                    });

                    if (!slot) {
                        throw new NotFoundException('Slot not found');
                    }

                    if (slot.isBlocked) {
                        throw new ConflictException('Slot is blocked');
                    }

                    if (slot.startsAt <= new Date()) {
                        throw new ConflictException(
                            'Cannot book a past slot',
                        );
                    }

                    const existing = await tx.booking.findFirst({
                        where: {
                            slotId: dto.slotId,
                            status: {
                                not: 'CANCELLED',
                            },
                        },
                        select: { id: true },
                    });

                    if (existing) {
                        throw new ConflictException(
                            'Slot is already booked',
                        );
                    }

                    return tx.booking.create({
                        data: {
                            slotId: dto.slotId,
                            studentId,
                            topic,
                            idempotencyKey: dto.idempotencyKey,
                            status: 'BOOKED',
                        },
                        select: bookingSelect,
                    });
                },
                {
                    maxWait: 10000,
                    timeout: 15000,
                },
            );
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError
            ) {
                if (error.code === 'P2002') {
                    // Повторяем проверку ключа после конфликта.
                    const previous = await this.prisma.booking.findUnique({
                        where: {
                            idempotencyKey: dto.idempotencyKey,
                        },
                        select: bookingSelect,
                    });

                    if (
                        previous &&
                        previous.studentId === studentId &&
                        previous.slotId === dto.slotId &&
                        previous.topic === topic
                    ) {
                        return previous;
                    }

                    throw new ConflictException(
                        'Slot is already booked or key is reused',
                    );
                }

                if (error.code === 'P2034') {
                    throw new ConflictException(
                        'Concurrent booking conflict. Please retry',
                    );
                }
            }

            throw error;
        }
    }

    // Отмена собственной записи
    async cancel(id: number, studentId: number) {
        const booking = await this.prisma.booking.findFirst({
            where: { id, studentId },
            select: { slotId: true },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        return this.prisma.$transaction(
            async (tx) => {
                // Используем ту же блокировку, что и при бронировании.
                await tx.$queryRaw`
          SELECT "id"
          FROM "slots"
          WHERE "id" = ${booking.slotId}
          FOR UPDATE
        `;

                const current = await tx.booking.findFirst({
                    where: { id, studentId },
                    select: {
                        status: true,
                        slot: {
                            select: { startsAt: true },
                        },
                    },
                });

                if (!current) {
                    throw new NotFoundException('Booking not found');
                }

                if (current.status === 'CANCELLED') {
                    return tx.booking.findUniqueOrThrow({
                        where: { id },
                        select: bookingSelect,
                    });
                }

                if (current.status !== 'BOOKED') {
                    throw new ConflictException(
                        'Booking cannot be cancelled',
                    );
                }

                if (current.slot.startsAt <= new Date()) {
                    throw new ConflictException(
                        'Consultation has already started',
                    );
                }

                return tx.booking.update({
                    where: { id },
                    data: {
                        status: 'CANCELLED',
                        cancelledAt: new Date(),
                    },
                    select: bookingSelect,
                });
            },
            {
                maxWait: 10000,
                timeout: 15000,
            },
        );
    }
}
