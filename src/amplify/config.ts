import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

let isConfigured = false;

export function configureAmplify(): void {
  if (!isConfigured) {
    Amplify.configure(outputs as any);
    isConfigured = true;
  }
}


