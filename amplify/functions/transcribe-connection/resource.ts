import { defineFunction } from '@aws-amplify/backend';

export const transcribeConnection = defineFunction({
  name: 'transcribe-connection',
  entry: './handler.ts',
});
