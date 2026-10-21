import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  DictionaryController,
  TagsController,
  VocabularyController,
} from './vocabulary.controller';
import { VocabularyService } from './vocabulary.service';
import { TagsService } from './tags.service';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [AuthModule],
  controllers: [DictionaryController, VocabularyController, TagsController],
  providers: [VocabularyService, TagsService, IdempotencyService],
})
export class VocabularyModule {}
