import { defineFunction } from '@aws-amplify/backend';

export const translateProcessor = defineFunction({
  name: 'translate-processor',
  entry: './handler.ts',
});


