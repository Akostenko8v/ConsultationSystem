
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

import type { CreateTeacherDto } from './dto/create-teacher.dto.js';
import type { UpdateTeacherDto } from './dto/update-teacher.dto.js';

const teacherSelect = {
    id: true,
    userId: true,
    user: {
        select: {
            fullName: true,
        },
    },
    disciplines: {
        select: {
            discipline: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                },
            },
        },
    },
} as const;

@Injectable()
export class TeachersService {
    constructor(private readonly prisma: PrismaService) { }

    findAll() {
        return this.prisma.teacher.findMany({
            select: teacherSelect,
            orderBy: {
                user: {
                    fullName: 'asc',
                },
            },
        });
    }

    async findOne(id: number) {
        const teacher = await this.prisma.teacher.findUnique({
            where: { id },
            select: teacherSelect,
        });

        if (!teacher) {
            throw new NotFoundException('Teacher not found');
        }

        return teacher;
    }

    async create(dto: CreateTeacherDto) {
        const fullName = dto.fullName.trim();
        const email = dto.email.trim().toLowerCase();

        if (!fullName) {
            throw new BadRequestException('Name cannot be empty');
        }

        if (Buffer.byteLength(dto.password, 'utf8') > 72) {
            throw new BadRequestException('Password is too long');
        }

        const passwordHash = await hash(dto.password, 12);
        const disciplineIds = dto.disciplineIds ?? [];

        try {
            return await this.prisma.teacher.create({
                data: {
                    user: {
                        create: {
                            fullName,
                            email,
                            passwordHash,
                            role: 'TEACHER',
                        },
                    },
                    disciplines: {
                        create: disciplineIds.map((disciplineId) => ({
                            discipline: {
                                connect: { id: disciplineId },
                            },
                        })),
                    },
                },
                select: teacherSelect,
            });
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    async update(id: number, dto: UpdateTeacherDto) {
        if (
            dto.fullName === undefined &&
            dto.disciplineIds === undefined
        ) {
            throw new BadRequestException('No fields to update');
        }

        const fullName = dto.fullName?.trim();

        if (fullName !== undefined && !fullName) {
            throw new BadRequestException('Name cannot be empty');
        }

        try {
            return await this.prisma.teacher.update({
                where: { id },
                data: {
                    ...(fullName !== undefined
                        ? {
                            user: {
                                update: { fullName },
                            },
                        }
                        : {}),
                    ...(dto.disciplineIds !== undefined
                        ? {
                            disciplines: {
                                deleteMany: {},
                                create: dto.disciplineIds.map((disciplineId) => ({
                                    discipline: {
                                        connect: { id: disciplineId },
                                    },
                                })),
                            },
                        }
                        : {}),
                },
                select: teacherSelect,
            });
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    async remove(id: number) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const teacher = await tx.teacher.findUnique({
                    where: { id },
                    select: { id: true, userId: true },
                });

                if (!teacher) {
                    throw new NotFoundException('Teacher not found');
                }

                await tx.teacher.delete({
                    where: { id },
                });

                await tx.user.delete({
                    where: { id: teacher.userId },
                });

                return {
                    id: teacher.id,
                    deleted: true,
                };
            });
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    private handleError(error: unknown): void {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                throw new ConflictException(
                    'Email or teacher assignment already exists',
                );
            }

            if (error.code === 'P2025') {
                throw new NotFoundException(
                    'Teacher or discipline not found',
                );
            }

            if (error.code === 'P2003') {
                throw new ConflictException(
                    'Teacher has related records and cannot be deleted',
                );
            }
        }
    }
}
