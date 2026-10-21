import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { OriginGuard } from '../auth/origin.guard';
import { VocabularyService } from './vocabulary.service';
import { TagsService } from './tags.service';

@Controller('dictionary')
@UseGuards(AuthGuard)
export class DictionaryController {
  constructor(private readonly vocabulary: VocabularyService) {}

  @Get('lookup')
  lookup(@Query('q') q?: string, @Query('provider') provider?: string) {
    return this.vocabulary.lookup(q, provider);
  }
}

@Controller('vocabulary')
@UseGuards(AuthGuard, OriginGuard)
export class VocabularyController {
  constructor(private readonly vocabulary: VocabularyService) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.vocabulary.create(
      request.auth!.userId,
      key,
      body,
    );
    response.status(result.status);
    return result.body;
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.vocabulary.list(request.auth!.userId, query);
  }

  @Get(':id')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vocabulary.get(request.auth!.userId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  patch(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.vocabulary.patch(request.auth!.userId, id, body);
  }

  @Post(':id/archive')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.vocabulary.setArchived(
      request.auth!.userId,
      id,
      true,
      key,
      body,
    );
    response.status(result.status);
    return result.body;
  }

  @Post(':id/restore')
  async restore(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.vocabulary.setArchived(
      request.auth!.userId,
      id,
      false,
      key,
      body,
    );
    response.status(result.status);
    return result.body;
  }
}

@Controller('tags')
@UseGuards(AuthGuard, OriginGuard)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.tags.list(request.auth!.userId);
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.tags.create(request.auth!.userId, key, body);
    response.status(result.status);
    return result.body;
  }

  @Patch(':id')
  @HttpCode(200)
  patch(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.tags.patch(request.auth!.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  delete(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tags.delete(request.auth!.userId, id);
  }
}
