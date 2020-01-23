import { Definition } from 'nock';

declare module 'nock' {
  interface Definition {
    rawHeaders?: string[];
  }
}
