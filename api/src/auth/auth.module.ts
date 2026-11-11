
import 'dotenv/config';
import { RolesGuard } from './guards/roles.guard.js';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';

@Module({
    imports: [
        DatabaseModule,
        JwtModule.registerAsync({
            useFactory: () => {
                const secret = process.env.JWT_SECRET;

                if (!secret || secret.length < 32) {
                    throw new Error('JWT_SECRET is missing or too short');
                }

                return {
                    secret,
                    signOptions: {
                        expiresIn: '1h',
                        issuer: 'consultation-system',
                    },
                };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtAuthGuard, RolesGuard],
    exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule { }
