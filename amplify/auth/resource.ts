import { defineAuth } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource for healthcare translation app
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      callbackUrls: [
        'http://localhost:3000/auth/callback',
        'https://main.d336mee7kyuyk6.amplifyapp.com/auth/callback'
      ],
      logoutUrls: [
        'http://localhost:3000/',
        'https://main.d336mee7kyuyk6.amplifyapp.com/'
      ],
    }
  },
  
  userAttributes: {
    givenName: {
      required: true,
    },
    familyName: {
      required: true,
    },
  },
  groups: ['healthcare_providers', 'patients'],
});
