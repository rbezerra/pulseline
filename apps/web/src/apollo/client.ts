/// <reference types="vite/client" />
import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { useEffect, useState } from 'react';

const httpUrl = import.meta.env.VITE_GRAPHQL_HTTP_URL || 'http://localhost:4000/graphql';
const wsUrl = import.meta.env.VITE_GRAPHQL_WS_URL || 'ws://localhost:4000/graphql';

const httpLink = new HttpLink({
  uri: httpUrl,
});

let isWsConnected = false;
const wsListeners = new Set<(connected: boolean) => void>();

function notifyWs(connected: boolean) {
  isWsConnected = connected;
  wsListeners.forEach((fn) => fn(connected));
}

export function useWsStatus(): boolean {
  const [connected, setConnected] = useState(isWsConnected);
  useEffect(() => {
    const listener = (val: boolean) => setConnected(val);
    wsListeners.add(listener);
    setConnected(isWsConnected);
    return () => {
      wsListeners.delete(listener);
    };
  }, []);
  return connected;
}

const wsClient = createClient({
  url: wsUrl,
  connectionParams: () => ({}),
  on: {
    connected: () => notifyWs(true),
    closed: () => notifyWs(false),
    error: () => notifyWs(false),
  },
});

const wsLink = new GraphQLWsLink(wsClient);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink
);

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      TestLineModel: {
        keyFields: ['id'],
      },
      TestRunModel: {
        keyFields: ['id'],
      },
      TriageDiagnosisModel: {
        keyFields: ['id'],
      },
      RunbookModel: {
        keyFields: ['id'],
      },
    },
  }),
});
