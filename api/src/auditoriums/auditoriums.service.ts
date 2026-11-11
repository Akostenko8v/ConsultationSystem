
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateAuditoriumDto } from './dto/create-auditorium.dto.js';
import type { UpdateAuditoriumDto } from './dto/update-auditorium.dto.js';

@Injectable()
export class AuditoriumsService {
    constructor(private readonly prisma: PrismaService) { }

    findAll() {
        return this.prisma.auditorium.findMany({
            orderBy: [
                { building: 'asc' },
                { number: 'asc' },
            ],
        });
    }

    async findOne(id: number) {
        const auditorium = await this.prisma.auditorium.findUnique({
            where: { id },
        });

        if (!auditorium) {
            throw new NotFoundException('Auditorium not found');
        }

        return auditorium;
    }

    async create(dto: CreateAuditoriumDto) {
        const building = dto.building.trim();
        const number = dto.number.trim();

        if (!building || !number) {
            throw new BadRequestException(
                'Building and number are required',
            );
        }

        try {
            return await this.prisma.auditorium.create({
                data: { building, number },
            });
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    async update(id: number, dto: UpdateAuditoriumDto) {
        if (
            dto.building === undefined &&
            dto.number === undefined
        ) {
            throw new BadRequestException('No fields to update');
        }

        const data: {
            building?: string;
            number?: string;
        } = {};

        if (dto.building !== undefined) {
            data.building = dto.building.trim();
            if (!data.building) {
                throw new BadRequestException('Building cannot be empty');
            }
        }

        if (dto.number !== undefined) {
            data.number = dto.number.trim();
            if (!data.number) {
                throw new BadRequestException('Number cannot be empty');
            }
        }

        try {
            return await this.prisma.auditorium.update({
                where: { id },
                data,
            });
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    async remove(id: number) {
        try {
            return await this.prisma.auditorium.delete({
                where: { id },
            });
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    private handleError(error: unknown): void {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                throw new NotFoundException('Auditorium not found');
            }

            if (error.code === 'P2002') {
                throw new ConflictException(
                    'Auditorium already exists',
                );
            }

            if (error.code === 'P2003') {
                throw new ConflictException(
                    'Auditorium is used by consultation slots',
                );
            }
        }
    }
}
