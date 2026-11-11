
import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Reflector } from '@nestjs/core';

import type { PrismaService } from '../../database/prisma.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

type TestRequest = {
    headers: { authorization?: string };
    user?: {
        id: number;
        role: Role;
    };
};

function makeContext(request: TestRequest): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => request,
        }),
        getHandler: () => function testHandler() { },
        getClass: () => class TestController { },
    } as unknown as ExecutionContext;
}

function makeJwtGuard(
    payload: unknown = { sub: 1 },
    isActive = true,
) {
    const verifyAsync = vi.fn().mockResolvedValue(payload);

    const findUnique = vi.fn().mockResolvedValue({
        id: 1,
        role: 'STUDENT',
        isActive,
    });

    const jwtService = {
        verifyAsync,
    } as unknown as JwtService;

    const prisma = {
        user: {
            findUnique,
        },
    } as unknown as PrismaService;

    return {
        guard: new JwtAuthGuard(jwtService, prisma),
        verifyAsync,
        findUnique,
    };
}

describe('JwtAuthGuard', () => {
    it('rejects a request without token', async () => {
        const { guard } = makeJwtGuard();

        const request: TestRequest = {
            headers: {},
        };

        await expect(
            guard.canActivate(makeContext(request)),
        ).rejects.toMatchObject({
            status: 401,
        });
    });

    it('accepts valid token and attaches user', async () => {
        const { guard } = makeJwtGuard();

        const request: TestRequest = {
            headers: {
                authorization: 'Bearer valid-token',
            },
        };

        await expect(
            guard.canActivate(makeContext(request)),
        ).resolves.toBe(true);

        expect(request.user).toEqual({
            id: 1,
            role: 'STUDENT',
        });
    });

    it('rejects an invalid token', async () => {
        const { guard, verifyAsync } = makeJwtGuard();

        verifyAsync.mockRejectedValue(
            new Error('Invalid signature'),
        );

        const request: TestRequest = {
            headers: {
                authorization: 'Bearer invalid-token',
            },
        };

        await expect(
            guard.canActivate(makeContext(request)),
        ).rejects.toMatchObject({
            status: 401,
        });
    });

    it('rejects a blocked account', async () => {
        const { guard } = makeJwtGuard(
            { sub: 1 },
            false,
        );

        const request: TestRequest = {
            headers: {
                authorization: 'Bearer valid-token',
            },
        };

        await expect(
            guard.canActivate(makeContext(request)),
        ).rejects.toMatchObject({
            status: 401,
        });
    });
});

describe('RolesGuard', () => {
    function makeRolesGuard(requiredRoles: Role[]) {
        const reflector = {
            getAllAndOverride: vi.fn().mockReturnValue(
                requiredRoles,
            ),
        } as unknown as Reflector;

        return new RolesGuard(reflector);
    }

    it('rejects a student from admin route', () => {
        const guard = makeRolesGuard(['ADMIN']);

        const request: TestRequest = {
            headers: {},
            user: {
                id: 1,
                role: 'STUDENT',
            },
        };

        expect(
            guard.canActivate(makeContext(request)),
        ).toBe(false);
    });

    it('allows an administrator', () => {
        const guard = makeRolesGuard(['ADMIN']);

        const request: TestRequest = {
            headers: {},
            user: {
                id: 2,
                role: 'ADMIN',
            },
        };

        expect(
            guard.canActivate(makeContext(request)),
        ).toBe(true);
    });
});
