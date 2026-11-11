
import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';

type AuthenticatedRequest = {
    user: {
        id: number;
        role: 'STUDENT' | 'TEACHER' | 'ADMIN';
    };
};

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) { }

    // Регистрация студента
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    // Вход в аккаунт
    @Post('login')
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    // Получение данных авторизованного пользователя
    @Get('me')
    @UseGuards(JwtAuthGuard)
    getProfile(@Req() request: AuthenticatedRequest) {
        return request.user;
    }

    // Проверка доступа администратора
    @Get('admin-check')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    checkAdmin() {
        return {
            status: 'ok',
            message: 'Admin access granted',
        };
    }
}
