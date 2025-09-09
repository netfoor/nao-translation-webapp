import { defineStorage } from '@aws-amplify/backend';

/**
 * Define and configure your storage resource for healthcare translation app
 * @see https://docs.amplify.aws/gen2/build-a-backend/storage
 */
export const storage = defineStorage({
  name: 'healthcareTranslationStorage',
  access: (allow) => ({
    'audio-files/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'translated-files/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});
