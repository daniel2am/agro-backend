export class CreateUserDto {
  nome: string;
  email: string;
  senha: string;
}

export class LoginDto {
  email: string;
  senha: string;
}

export class ForgotPasswordDto {
  email: string;
}

export class ResetPasswordDto {
  token: string;
  senha: string;
}
