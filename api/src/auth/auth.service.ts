
import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    async register(dto: RegisterDto) {
        const fullName = dto.fullName.trim();
        const email = dto.email.trim().toLowerCase();

        if (!fullName) {
            throw new BadRequestException('Name cannot be empty');
        }

        if (Buffer.byteLength(dto.password, 'utf8') > 72) {
            throw new BadRequestException('Password is too long');
        }

        const passwordHash = await hash(dto.password, 12);

        try {
            return await this.prisma.user.create({
                data: {
                    fullName,
                    email,
                    passwordHash,
                    role: 'STUDENT',
                },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    role: true,
                    createdAt: true,
                },
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException('Email already registered');
            }

            throw error;
        }
    }

    async login(dto: LoginDto) {
        const email = dto.email.trim().toLowerCase();

        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const passwordValid = await compare(
            dto.password,
            user.passwordHash,
        );

        if (!passwordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const accessToken = await this.jwtService.signAsync({
            sub: user.id,
            role: user.role,
        });

        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 3600,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
            },
        };
    }
}
