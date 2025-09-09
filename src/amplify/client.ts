import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { configureAmplify } from './config';

export function getDataClient() {
  configureAmplify();
  return generateClient<Schema>();
}



