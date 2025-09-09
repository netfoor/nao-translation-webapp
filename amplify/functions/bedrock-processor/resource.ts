import { defineFunction } from '@aws-amplify/backend';

export const bedrockProcessor = defineFunction({
  name: 'bedrock-processor',
  entry: './handler.ts',
});
