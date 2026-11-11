
import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

type AuthenticatedRequest = {
    user: {
        id: number;
        role: 'STUDENT' | 'TEACHER' | 'ADMIN';
    };
};

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STUDENT')
export class BookingsController {
    constructor(
        private readonly bookingsService: BookingsService,
    ) { }

    @Get('mine')
    findMine(@Req() request: AuthenticatedRequest) {
        return this.bookingsService.findMine(request.user.id);
    }

    @Post()
    create(
        @Req() request: AuthenticatedRequest,
        @Body() dto: CreateBookingDto,
    ) {
        return this.bookingsService.create(
            request.user.id,
            dto,
        );
    }

    @Patch(':id/cancel')
    cancel(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.bookingsService.cancel(
            id,
            request.user.id,
        );
    }
}
