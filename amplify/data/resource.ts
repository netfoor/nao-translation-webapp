import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Healthcare Translation App Data Schema
 * Defines models for translation sessions and logs
 */
const schema = a.schema({
  TranslationSession: a
    .model({
      sessionId: a.id().required(),
      userId: a.string().required(),
      sourceLanguage: a.string().required(),
      targetLanguage: a.string().required(),
      originalText: a.string(),
      translatedText: a.string(),
      enhancedText: a.string(),
      audioFileUrl: a.string(),
      translatedAudioUrl: a.string(),
      status: a.enum(['processing', 'completed', 'failed']),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),
    
  TranslationLog: a
    .model({
      logId: a.id().required(),
      sessionId: a.string().required(),
      step: a.enum(['transcribe', 'translate', 'enhance', 'synthesize']),
      input: a.string(),
      output: a.string(),
      processingTime: a.float(),
      timestamp: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
