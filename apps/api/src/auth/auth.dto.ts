import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CredentialsDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
