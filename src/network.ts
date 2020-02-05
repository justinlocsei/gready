import querystring from 'querystring';
import superagent from 'superagent';
import { URL } from 'url';

import { NetworkError } from './errors';

/**
 * Allow network errors caused by a function to be handled
 */
export async function handleRequestErrors<T, U>(
  runAction: () => Promise<T>,
  handleError: (error: NetworkError) => Promise<U>
): Promise<T | U> {
  try {
    return await runAction();
  } catch (error) {
    if (error instanceof NetworkError) {
      return await handleError(error);
    } else {
      throw error;
    }
  }
}

/**
 * Make a GET request
 */
export async function makeGetRequest(
  url: string,
  payload?: Record<string, any>
): Promise<string> {
  const endpoint = new URL(url);
  let response: superagent.Response;

  if (payload) {
    endpoint.search = querystring.stringify(payload);
  }

  try {
    response = await superagent.get(endpoint.toString());
  } catch (error) {
    throw new NetworkError(`GET request to ${endpoint} failed:\n${error}`, error.status);
  }

  return response.text || response.body.toString();
}
