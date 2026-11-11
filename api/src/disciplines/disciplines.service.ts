
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateDisciplineDto } from './dto/create-discipline.dto.js';
import type { UpdateDisciplineDto } from './dto/update-discipline.dto.js';

@Injectable()
export class DisciplinesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.discipline.findMany({
            select: {
                id: true,
                code: true,
                name: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async findOne(id: number) {
        const discipline = await this.prisma.discipline.findUnique({
            where: { id },
            select: {
                id: true,
                code: true,
                name: true,
            },
        });

        if (!discipline) {
            throw new NotFoundException('Discipline not found');
        }

        return discipline;
    }

    async create(dto: CreateDisciplineDto) {
        const code = dto.code.trim();
        const name = dto.name.trim();

        if (!code || !name) {
            throw new BadRequestException('Code and name are required');
        }

        try {
            return await this.prisma.discipline.create({
                data: { code, name },
                select: {
                    id: true,
                    code: true,
                    name: true,
                },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException('Discipline already exists');
            }
            throw error;
        }
    }

    async update(id: number, dto: UpdateDisciplineDto) {
        if (dto.code === undefined && dto.name === undefined) {
            throw new BadRequestException('No fields to update');
        }

        const data: { code?: string; name?: string } = {};

        if (dto.code !== undefined) {
            data.code = dto.code.trim();
            if (!data.code) {
                throw new BadRequestException('Code cannot be empty');
            }
        }

        if (dto.name !== undefined) {
            data.name = dto.name.trim();
            if (!data.name) {
                throw new BadRequestException('Name cannot be empty');
            }
        }

        try {
            return await this.prisma.discipline.update({
                where: { id },
                data,
                select: {
                    id: true,
                    code: true,
                    name: true,
                },
            });
        } catch (error) {
            this.handlePrismaError(error);
            throw error;
        }
    }

    async remove(id: number) {
        try {
            return await this.prisma.discipline.delete({
                where: { id },
                select: {
                    id: true,
                    code: true,
                    name: true,
                },
            });
        } catch (error) {
            this.handlePrismaError(error);
            throw error;
        }
    }

    private handlePrismaError(error: unknown): void {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                throw new NotFoundException('Discipline not found');
            }

            if (error.code === 'P2002') {
                throw new ConflictException('Discipline already exists');
            }

            if (error.code === 'P2003') {
                throw new ConflictException(
                    'Cannot delete discipline with related records',
                );
            }
        }
    }
}
