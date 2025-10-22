import Ajv from 'ajv';

const ajv = new Ajv();

export const payloadSchema = {
  type: 'object',
  required: ['ver', 'jti', 'user', 'agent', 'scope', 'limit', 'exp', 'nonce'],
  properties: {
    ver: {
      type: 'string',
      const: '0.2'
    },
    jti: {
      type: 'string',
      minLength: 8
    },
    user: {
      type: 'string',
      minLength: 1
    },
    agent: {
      type: 'string',
      minLength: 1
    },
    scope: {
      type: 'string',
      minLength: 1,
      pattern: '^[a-zA-Z0-9_:.\\-]+$'
    },
    limit: {
      type: 'object',
      required: ['amount', 'currency'],
      properties: {
        amount: {
          type: 'number',
          minimum: 0
        },
        currency: {
          type: 'string',
          minLength: 3,
          maxLength: 3,
          pattern: '^[A-Z]{3}$'
        }
      },
      additionalProperties: false
    },
    aud: {
      type: 'string',
      minLength: 1
    },
    exp: {
      type: 'integer',
      minimum: 0
    },
    nonce: {
      type: 'string',
      minLength: 8
    }
  },
  additionalProperties: true
};

export const validatePayload = ajv.compile(payloadSchema);

