
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Controller('health')
export class DatabaseController {
    constructor(private readonly prisma: PrismaService) { }

    @Get()
    async checkDatabase() {
        const usersCount = await this.prisma.user.count();

        return {
            status: 'ok',
            database: 'connected',
            users: usersCount,
        };
    }
}
