
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service.js';

type AuthenticatedRequest = {
    headers: {
        authorization?: string;
    };
    user?: {
        id: number;
        role: 'STUDENT' | 'TEACHER' | 'ADMIN';
    };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) { }

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const request =
            context.switchToHttp().getRequest<AuthenticatedRequest>();

        const authorization = request.headers.authorization;
        const [type, token] = authorization?.split(' ') ?? [];

        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException('Authentication required');
        }

        let payload: { sub: number };

        try {
            payload = await this.jwtService.verifyAsync<{ sub: number }>(
                token,
                { issuer: 'consultation-system' },
            );
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        if (!payload || !Number.isInteger(payload.sub) || payload.sub <= 0) {
            throw new UnauthorizedException('Invalid token');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                role: true,
                isActive: true,
            },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedException('Account unavailable');
        }

        request.user = {
            id: user.id,
            role: user.role,
        };

        return true;
    }
}
