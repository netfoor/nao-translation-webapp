import { defineFunction } from '@aws-amplify/backend';

export const websocketHandler = defineFunction({
  name: 'websocket-handler',
  entry: './handler.ts',
});
