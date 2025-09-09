import { defineFunction } from '@aws-amplify/backend';

export const pollyProcessor = defineFunction({
  name: 'polly-processor',
  entry: './handler.ts',
});
