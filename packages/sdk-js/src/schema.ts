import Ajv from 'ajv';

const ajv = new Ajv();

export const payloadSchema = {
  type: 'object',
  required: ['ver', 'user', 'agent', 'scope', 'exp', 'nonce'],
  properties: {
    ver: {
      type: 'string',
      enum: ['0.2', '0.1', 'act.v0.2', 'act.v0.3']
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
      oneOf: [
        {
          type: 'string',
          minLength: 1,
          pattern: '^[a-zA-Z0-9_:.\\-]+$'
        },
        {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1
          },
          minItems: 1
        }
      ]
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

