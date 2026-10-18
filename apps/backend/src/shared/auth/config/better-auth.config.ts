import {
  normalizeProfileInput,
  ProfileInputError,
} from '@/shared/auth/utils/profile-input';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { openAPI, username } from 'better-auth/plugins';
import { BetterAuthOptions } from 'better-auth/types';

export const betterAuthCoreConfig: BetterAuthOptions = {
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: false,
      },
      // Profile settings. Both are checked and normalised in the hook below
      // (empty bio / "no mood" are stored as null).
      bio: {
        type: 'string',
        required: false,
        input: true,
      },
      defaultMood: {
        type: 'string',
        required: false,
        input: true,
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      try {
        normalizeProfileInput(ctx.path, ctx.body);
      } catch (error) {
        if (error instanceof ProfileInputError) {
          throw APIError.from('BAD_REQUEST', {
            code: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    }),
  },
  plugins: [openAPI(), username()],
};
