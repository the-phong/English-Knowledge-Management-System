import { HttpException } from '@nestjs/common';

export class VocabularyError extends HttpException {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
    status: number,
  ) {
    super(safeMessage, status);
  }
}
