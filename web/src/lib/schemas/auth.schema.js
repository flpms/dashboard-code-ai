import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('E-mail inválido.'),
  password: z.string().min(8, 'Mínimo de 8 caracteres.'),
});
